<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Mail\RefundCompleted;
use App\Mail\ReservationApproved;
use App\Mail\ReservationRejected;
use App\Models\Reservation;
use App\Models\RoomCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class AdminReservationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        Reservation::expireOverduePaymentRequests();

        $query = Reservation::with(['user', 'room', 'payments', 'releasedByAdmin']);

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('room_id')) {
            $query->where('room_id', $request->room_id);
        }

        if ($request->filled('category_type')) {
            $query->where('category_type', $request->category_type);
        }

        return response()->json($query->orderByDesc('created_at')->paginate(20));
    }

    public function occupiedRooms(): JsonResponse
    {
        Reservation::expireOverduePaymentRequests();

        $today = now()->toDateString();

        $reservations = Reservation::with(['user', 'room', 'payments'])
            ->whereIn('status', ['CONFIRMEE', 'SEJOUR_PAYE'])
            ->whereDate('check_in', '<=', $today)
            ->whereDate('check_out', '>', $today)
            ->orderBy('check_out')
            ->get();

        return response()->json([
            'data' => $reservations,
        ]);
    }

    public function releaseRoom(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'release_notes' => 'nullable|string|max:1000',
        ]);

        $reservation = Reservation::with(['room', 'user', 'payments'])->findOrFail($id);

        if (! in_array($reservation->status, ['CONFIRMEE', 'SEJOUR_PAYE'], true)) {
            return response()->json([
                'message' => 'Seule une reservation confirmee ou un sejour paye peut liberer un appartement.',
            ], 422);
        }

        if (now()->toDateString() < $reservation->check_in->toDateString()) {
            return response()->json([
                'message' => 'Ce sejour n\'a pas encore commence. Il ne peut pas etre libere depuis la liste des appartements occupes.',
            ], 422);
        }

        if (now()->toDateString() >= $reservation->check_out->toDateString()) {
            return response()->json([
                'message' => 'Ce sejour est deja termine. L\'appartement n\'est plus considere comme occupe.',
            ], 422);
        }

        $reservation->update([
            'status' => 'LIBEREE',
            'released_at' => now(),
            'released_by_admin_id' => $request->user()?->id,
            'release_notes' => $request->release_notes,
        ]);

        return response()->json([
            'message' => 'Appartement libere. Il est de nouveau disponible pour les prochaines demandes.',
            'reservation' => $reservation->fresh(['room', 'user', 'payments', 'releasedByAdmin']),
        ]);
    }

    public function approve(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'admin_notes' => 'nullable|string|max:1000',
        ]);

        $reservation = Reservation::with(['room', 'user'])->findOrFail($id);
        Reservation::expireOverduePaymentRequests();

        if ($reservation->status !== 'EN_ATTENTE') {
            return response()->json([
                'message' => 'Cette demande ne peut plus etre confirmee.',
            ], 422);
        }

        if (now()->startOfDay()->greaterThanOrEqualTo($reservation->check_in->copy()->startOfDay())) {
            $reservation->update(['status' => 'EXPIREE']);

            return response()->json([
                'message' => 'La date d\'arrivee est deja atteinte. Cette demande a expire et ne peut plus etre confirmee.',
            ], 422);
        }

        $category = RoomCategory::where('type', $reservation->category_type ?: $reservation->room->type)->first();

        if (! $category) {
            return response()->json(['message' => 'Categorie introuvable pour cette demande.'], 422);
        }

        if ($category->is_blocked) {
            return response()->json([
                'message' => 'Cette categorie est indisponible pour le moment.',
            ], 422);
        }

        $checkIn = $reservation->check_in->toDateString();
        $checkOut = $reservation->check_out->toDateString();

        if (! $reservation->room->isAvailableForDates($checkIn, $checkOut, $reservation->id)) {
            if ($category->type === 'vip') {
                return response()->json([
                    'message' => 'Cet appartement VIP est deja bloque pour ces dates.',
                ], 422);
            }

            $alternateRoom = $category->availableRoomForDates($checkIn, $checkOut, null, $reservation->id);

            if (! $alternateRoom) {
                return response()->json([
                    'message' => 'Aucun appartement libre pour ces dates.',
                ], 422);
            }

            $reservation->update([
                'room_id' => $alternateRoom->id,
            ]);
            $reservation->setRelation('room', $alternateRoom);
        }

        DB::transaction(function () use ($reservation, $request) {
            $reservation->update([
                'status' => 'VALIDEE_PAIEMENT_REQUIS',
                'admin_notes' => $request->admin_notes,
                'approved_at' => now(),
                'payment_deadline' => now()->addHours(24),
            ]);
        });

        try {
            Mail::to($reservation->user->email)->send(new ReservationApproved($reservation->fresh(['room', 'user'])));
        } catch (\Exception $exception) {
            Log::warning('Failed to send approval email: '.$exception->getMessage());
        }

        return response()->json([
            'message' => 'Demande confirmee. Le client a 24h pour payer la caution de réservation.',
            'reservation' => $reservation->fresh(['room', 'user', 'payments']),
        ]);
    }

    public function reject(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'admin_notes' => 'required|string|max:1000',
        ]);

        $reservation = Reservation::with(['room', 'user'])->findOrFail($id);

        if (! in_array($reservation->status, ['EN_ATTENTE', 'VALIDEE_PAIEMENT_REQUIS'], true)) {
            return response()->json([
                'message' => 'Cette demande ne peut plus etre refusee.',
            ], 422);
        }

        $reservation->update([
            'status' => 'REFUSEE',
            'admin_notes' => $request->admin_notes,
        ]);

        try {
            Mail::to($reservation->user->email)->send(new ReservationRejected($reservation->fresh(['room', 'user'])));
        } catch (\Exception $exception) {
            Log::warning('Failed to send rejection email: '.$exception->getMessage());
        }

        return response()->json([
            'message' => 'Demande refusee. Le motif a ete envoye au client.',
            'reservation' => $reservation->fresh(['room', 'user', 'payments']),
        ]);
    }

    public function markRefunded(string $id): JsonResponse
    {
        $reservation = Reservation::with(['room', 'user', 'payments'])->findOrFail($id);

        if ($reservation->status !== 'ANNULEE') {
            return response()->json([
                'message' => 'Cette reservation ne peut pas etre marquee comme remboursee.',
            ], 422);
        }

        $reservation->update([
            'status' => 'REMBOURSEE',
            'refunded_at' => now(),
        ]);

        $reservation = $reservation->fresh(['room', 'user', 'payments']);

        try {
            Mail::to($reservation->user->email)->send(new RefundCompleted($reservation));
        } catch (\Exception $exception) {
            Log::warning('Failed to send refund completed email: '.$exception->getMessage());
        }

        return response()->json([
            'message' => 'Remboursement marque comme effectue.',
            'reservation' => $reservation,
        ]);
    }

    public function approveExtension(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'admin_notes' => 'nullable|string|max:1000',
        ]);

        $reservation = Reservation::with(['room', 'user', 'payments'])->findOrFail($id);

        if ($reservation->extension_status !== 'EN_ATTENTE' || ! $reservation->extension_requested_check_out) {
            return response()->json([
                'message' => 'Aucune demande de prolongation en attente pour cette reservation.',
            ], 422);
        }

        if ($reservation->status !== 'CONFIRMEE') {
            return response()->json([
                'message' => 'Seule une reservation confirmee peut etre prolongee.',
            ], 422);
        }

        $currentCheckOut = $reservation->check_out->copy()->startOfDay();
        $requestedCheckOut = $reservation->extension_requested_check_out->copy()->startOfDay();

        if ($requestedCheckOut->lessThanOrEqualTo($currentCheckOut)) {
            return response()->json([
                'message' => 'La nouvelle date de depart n\'est plus valide.',
            ], 422);
        }

        if (! $reservation->room->isAvailableForDates(
            $currentCheckOut->toDateString(),
            $requestedCheckOut->toDateString(),
            $reservation->id
        )) {
            return response()->json([
                'message' => 'Cet appartement n\'est plus disponible jusqu\'a la date demandee.',
            ], 422);
        }

        $category = RoomCategory::where('type', $reservation->category_type ?: $reservation->room->type)->first();
        $pricePerNight = (int) ($reservation->room->base_price ?: $category?->price_per_night ?: 0);
        $nights = max(1, $reservation->check_in->copy()->startOfDay()->diffInDays($requestedCheckOut));

        $reservation->update([
            'check_out' => $requestedCheckOut,
            'stay_amount' => $nights * $pricePerNight,
            'extension_status' => 'APPROUVEE',
            'extension_processed_at' => now(),
            'extension_admin_notes' => $request->admin_notes,
        ]);

        return response()->json([
            'message' => 'Prolongation acceptee. La date de depart et le montant du sejour ont ete mis a jour.',
            'reservation' => $reservation->fresh(['room', 'user', 'payments']),
        ]);
    }

    public function rejectExtension(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'admin_notes' => 'required|string|max:1000',
        ]);

        $reservation = Reservation::with(['room', 'user', 'payments'])->findOrFail($id);

        if ($reservation->extension_status !== 'EN_ATTENTE') {
            return response()->json([
                'message' => 'Aucune demande de prolongation en attente pour cette reservation.',
            ], 422);
        }

        $reservation->update([
            'extension_status' => 'REFUSEE',
            'extension_processed_at' => now(),
            'extension_admin_notes' => $request->admin_notes,
        ]);

        return response()->json([
            'message' => 'Prolongation refusee avec motif.',
            'reservation' => $reservation->fresh(['room', 'user', 'payments']),
        ]);
    }

    public function checkConflicts(Request $request): JsonResponse
    {
        $request->validate([
            'category_type' => 'required|string|in:'.implode(',', RoomCategory::TYPES),
            'check_in' => 'required|date',
            'check_out' => 'required|date|after:check_in',
            'exclude_reservation_id' => 'nullable|exists:reservations,id',
        ]);

        $query = Reservation::with(['user', 'room'])
            ->where('category_type', $request->category_type)
            ->where(function ($query) {
                $query->whereIn('status', ['CONFIRMEE', 'SEJOUR_PAYE'])
                    ->orWhere(function ($query) {
                        $query->where('status', 'VALIDEE_PAIEMENT_REQUIS')
                            ->whereDate('check_in', '>', now()->toDateString())
                            ->where(function ($query) {
                                $query->whereNull('payment_deadline')
                                    ->orWhere('payment_deadline', '>', now());
                            });
                    });
            })
            ->where(function ($query) use ($request) {
                $query->where('check_in', '<', $request->check_out)
                    ->where('check_out', '>', $request->check_in);
            });

        if ($request->filled('exclude_reservation_id')) {
            $query->where('id', '!=', $request->exclude_reservation_id);
        }

        $conflicts = $query->get();

        return response()->json([
            'has_conflicts' => $conflicts->isNotEmpty(),
            'conflicts' => $conflicts,
        ]);
    }
}
