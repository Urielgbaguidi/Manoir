<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\ReservationCancelled;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\RoomCategory;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class ReservationController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        Reservation::expireOverduePaymentRequests();

        $request->validate([
            'category_type' => 'required|string|in:'.implode(',', RoomCategory::TYPES),
            'check_in' => 'required|date|after_or_equal:today',
            'check_out' => 'required|date|after:check_in',
            'room_id' => 'nullable|integer|exists:rooms,id',
            'special_requests' => 'nullable|string|max:1000',
        ]);

        $category = RoomCategory::where('type', $request->category_type)->firstOrFail();

        if ($category->is_blocked) {
            return response()->json([
                'message' => 'Cette categorie est indisponible pour le moment.',
            ], 422);
        }

        $preferredRoomId = $request->integer('room_id') ?: null;
        $room = $category->availableRoomForDates($request->check_in, $request->check_out, $preferredRoomId);

        if (! $room) {
            return response()->json([
                'message' => 'Aucun appartement disponible pour ces dates. Veuillez choisir d\'autres dates.',
            ], 422);
        }

        $checkIn = Carbon::parse($request->check_in)->startOfDay();
        $checkOut = Carbon::parse($request->check_out)->startOfDay();
        $today = now()->startOfDay();
        $nights = max(1, $checkIn->diffInDays($checkOut));
        $daysBeforeArrival = max(0, $today->diffInDays($checkIn, false));
        $depositPerDay = (int) ($room->deposit ?: $category->deposit_per_day);
        $pricePerNight = (int) ($room->base_price ?: $category->price_per_night);
        $depositAmount = $daysBeforeArrival * $depositPerDay;
        $stayAmount = $nights * $pricePerNight;

        $reservation = Reservation::create([
            'user_id' => Auth::id(),
            'room_id' => $room->id,
            'category_type' => $category->type,
            'check_in' => $request->check_in,
            'check_out' => $request->check_out,
            'guests' => $room->max_occupants,
            'total_price' => $depositAmount,
            'deposit_daily_rate' => $depositPerDay,
            'deposit_amount' => $depositAmount,
            'stay_amount' => $stayAmount,
            'status' => 'EN_ATTENTE',
            'special_requests' => $request->special_requests,
        ]);

        return response()->json([
            'message' => $room->apartment_number
                ? "Appartement N°{$room->apartment_number} vous sera attribué pour votre séjour. Votre demande est en cours d'examen."
                : 'Votre demande est en cours d\'examen.',
            'reservation' => $reservation->load('room'),
        ], 201);
    }

    public function myReservations(): JsonResponse
    {
        Reservation::expireOverduePaymentRequests(Auth::id());

        $reservations = Reservation::where('user_id', Auth::id())
            ->with(['room', 'payments', 'user'])
            ->orderByDesc('created_at')
            ->get();

        return response()->json($reservations);
    }

    public function show(string $id): JsonResponse
    {
        $reservation = Reservation::where('user_id', Auth::id())
            ->with(['room', 'payments', 'notifications', 'user'])
            ->findOrFail($id);

        $reservation->expireIfPaymentDeadlinePassed();

        return response()->json($reservation);
    }

    public function payments(string $id): JsonResponse
    {
        $reservation = Reservation::where('user_id', Auth::id())->findOrFail($id);
        $reservation->expireIfPaymentDeadlinePassed();

        $payments = Payment::where('reservation_id', $reservation->id)
            ->orderByDesc('created_at')
            ->get();

        return response()->json($payments);
    }

    public function cancel(string $id): JsonResponse
    {
        $reservation = Reservation::where('user_id', Auth::id())
            ->with(['room', 'payments', 'user'])
            ->findOrFail($id);

        $reservation->expireIfPaymentDeadlinePassed();

        if (! in_array($reservation->status, ['EN_ATTENTE', 'VALIDEE_PAIEMENT_REQUIS', 'CONFIRMEE'], true)) {
            return response()->json([
                'message' => 'Cette reservation ne peut pas etre annulee.',
            ], 422);
        }

        $calculation = $this->calculateCancellation($reservation);
        $documentNumber = 'ANN-'.now()->format('Y').'-'.str_pad((string) $reservation->id, 5, '0', STR_PAD_LEFT);

        $reservation->update([
            'status' => 'ANNULEE',
            'cancelled_at' => now(),
            'cancellation_consumed_days' => $calculation['consumed_days'],
            'cancellation_retained_amount' => $calculation['retained_amount'],
            'cancellation_refund_amount' => $calculation['refund_amount'],
            'cancellation_document_number' => $documentNumber,
        ]);

        $reservation = $reservation->fresh(['room', 'payments', 'user']);

        try {
            Mail::to($reservation->user->email)->send(new ReservationCancelled($reservation));
            $adminEmail = config('mail.from.address');
            if ($adminEmail) {
                Mail::to($adminEmail)->send(new ReservationCancelled($reservation, true));
            }
        } catch (\Exception $exception) {
            Log::warning('Failed to send cancellation email: '.$exception->getMessage());
        }

        return response()->json([
            'message' => 'Reservation annulee avec succes.',
            'reservation' => $reservation,
            'cancellation' => $calculation,
        ]);
    }

    private function calculateCancellation(Reservation $reservation): array
    {
        $depositAmount = $reservation->status === 'CONFIRMEE'
            ? (int) ($reservation->deposit_amount ?? $reservation->total_price)
            : 0;
        $dailyRate = (int) ($reservation->deposit_daily_rate ?: $reservation->room?->deposit ?: 0);
        $createdAt = Carbon::parse($reservation->created_at)->startOfDay();
        $cancelledAt = now()->startOfDay();
        $checkIn = Carbon::parse($reservation->check_in)->startOfDay();

        if ($reservation->status !== 'CONFIRMEE') {
            return [
                'deposit_amount' => 0,
                'consumed_days' => 0,
                'retained_amount' => 0,
                'refund_amount' => 0,
            ];
        }

        if ($cancelledAt->greaterThanOrEqualTo($checkIn)) {
            return [
                'deposit_amount' => $depositAmount,
                'consumed_days' => max(0, $createdAt->diffInDays($cancelledAt, false)),
                'retained_amount' => $depositAmount,
                'refund_amount' => 0,
            ];
        }

        $consumedDays = max(0, $createdAt->diffInDays($cancelledAt, false));
        $retainedAmount = min($depositAmount, $consumedDays * $dailyRate);
        $refundAmount = max(0, $depositAmount - $retainedAmount);

        return [
            'deposit_amount' => $depositAmount,
            'consumed_days' => $consumedDays,
            'retained_amount' => $retainedAmount,
            'refund_amount' => $refundAmount,
        ];
    }

    public function markInvoiceDownloaded(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'payment_type' => 'required|in:deposit,stay',
        ]);

        $reservation = Reservation::where('user_id', Auth::id())->findOrFail($id);
        $reservation->expireIfPaymentDeadlinePassed();

        $isStay = $request->payment_type === 'stay';
        $invoiceNumberField = $isStay ? 'stay_invoice_number' : 'deposit_invoice_number';
        $downloadedField = $isStay ? 'stay_invoice_downloaded' : 'deposit_invoice_downloaded';

        if (! $reservation->{$invoiceNumberField}) {
            return response()->json([
                'message' => 'Cette facture n\'est pas encore disponible.',
            ], 422);
        }

        $reservation->update([
            $downloadedField => true,
        ]);

        return response()->json([
            'message' => 'Facture marquee comme telechargee.',
            'reservation' => $reservation->fresh(['room', 'payments', 'user']),
        ]);
    }
}
