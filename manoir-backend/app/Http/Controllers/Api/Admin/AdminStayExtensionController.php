<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminTableRequest;
use App\Models\Room;
use App\Models\StayExtension;
use App\Services\Notifications\RequestMailer;
use App\Services\ReservationNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Demandes de prolongation cote administration.
 */
class AdminStayExtensionController extends Controller
{
    public function index(AdminTableRequest $request): JsonResponse
    {
        StayExtension::expireOverdue();

        $query = StayExtension::query()
            ->with(['user', 'reservation.room', 'reservation.user', 'payments', 'voucher'])
            ->when($request->validated('status'), fn ($q, $statuses) => $q->whereIn('status', $statuses))
            ->when($request->validated('room_id'), fn ($q, $roomId) => $q->whereHas('reservation', fn ($r) => $r->where('room_id', $roomId)));

        $from = $request->validated('date_from');
        $to = $request->validated('date_to');

        if ($request->validated('date_field') === 'created') {
            $query->when($from, fn ($q) => $q->whereDate('created_at', '>=', $from))
                ->when($to, fn ($q) => $q->whereDate('created_at', '<=', $to));
        } else {
            // Chevauchement entre la periode et les nuits demandees.
            $query->when($to, fn ($q) => $q->whereDate('previous_check_out', '<=', $to))
                ->when($from, fn ($q) => $q->whereDate('requested_check_out', '>=', $from));
        }

        if ($client = $request->validated('client')) {
            $term = $request->likeTerm($client);
            $query->whereHas('user', fn ($q) => $q->where(fn ($q) => $q
                ->where('name', 'like', $term)
                ->orWhere('email', 'like', $term)
                ->orWhere('phone', 'like', $term)));
        }

        if ($search = $request->validated('search')) {
            $term = $request->likeTerm($search);
            $digits = ltrim($search, '#');
            $query->where(fn ($q) => $q
                ->when(ctype_digit($digits), fn ($q) => $q->orWhere('id', (int) $digits)->orWhere('reservation_id', (int) $digits))
                ->orWhereHas('user', fn ($q) => $q->where('name', 'like', $term)->orWhere('email', 'like', $term)->orWhere('phone', 'like', $term))
                ->orWhereHas('reservation.room', fn ($q) => $q->where('name', 'like', $term)->orWhere('apartment_number', 'like', $term)));
        }

        $sort = $request->sortColumn([
            'id' => 'id',
            'created_at' => 'created_at',
            'requested_check_out' => 'requested_check_out',
            'status' => 'status',
            'amount' => 'amount',
        ], 'created_at');

        return response()->json(
            $query->orderBy($sort, $request->direction())->orderByDesc('id')->paginate($request->perPage())
        );
    }

    /**
     * Valide la prolongation : les nuits sont retenues et le paiement s'ouvre.
     */
    public function approve(Request $request, string $id, RequestMailer $mailer): JsonResponse
    {
        $data = $request->validate(['admin_notes' => ['nullable', 'string', 'max:1000']]);

        $result = DB::transaction(function () use ($id, $data) {
            /** @var StayExtension $extension */
            $extension = StayExtension::with('reservation.room')->lockForUpdate()->findOrFail($id);
            $reservation = $extension->reservation;

            if ($extension->status !== StayExtension::STATUS_PENDING) {
                return response()->json(['message' => 'Cette demande de prolongation a deja ete traitee.'], 422);
            }

            if (! in_array($reservation->status, ['CONFIRMEE', 'SEJOUR_PAYE'], true)) {
                return response()->json(['message' => 'Le sejour lie a cette demande n\'est plus actif.'], 422);
            }

            // Le depart a pu changer depuis la demande (autre prolongation).
            if (! $reservation->check_out->isSameDay($extension->previous_check_out)) {
                return response()->json(['message' => 'La date de depart du sejour a change depuis la demande : elle doit etre refaite.'], 422);
            }

            Room::whereKey($reservation->room_id)->lockForUpdate()->first();

            if (! $reservation->room->isAvailableForDates(
                $extension->previous_check_out->toDateString(),
                $extension->requested_check_out->toDateString(),
                $reservation->id
            )) {
                return response()->json(['message' => 'L\'appartement n\'est plus disponible sur les nuits demandees.'], 422);
            }

            $extension->update([
                'status' => StayExtension::STATUS_AWAITING_PAYMENT,
                'admin_notes' => $data['admin_notes'] ?? null,
                'approved_at' => now(),
                'processed_at' => now(),
                // Le client est sur place : le delai de paiement ne depasse
                // pas la fin de son sejour actuel.
                'payment_deadline' => now()
                    ->addHours(max(1, (int) config('booking.hold_hours', 12)))
                    ->min($extension->previous_check_out->copy()->endOfDay()),
            ]);

            return $extension;
        });

        if ($result instanceof JsonResponse) {
            return $result;
        }

        $extension = $result->fresh(['reservation.user', 'reservation.room']);
        $amount = number_format((int) $extension->amount, 0, ',', ' ');

        ReservationNotificationService::sendOnce(
            $extension->reservation,
            'extension_approved_'.$extension->id,
            "Votre prolongation jusqu’au {$extension->requested_check_out->format('d/m/Y')} est validée. Réglez {$amount} FCFA dans votre espace client avant le {$extension->payment_deadline->format('d/m/Y à H:i')}."
        );

        $mailer->extensionApproved($extension);

        return response()->json([
            'message' => 'Prolongation validee. Le client a ete prevenu par email et peut maintenant payer.',
            'extension' => $extension,
        ]);
    }

    public function reject(Request $request, string $id, RequestMailer $mailer): JsonResponse
    {
        $data = $request->validate(['admin_notes' => ['required', 'string', 'max:1000']]);

        $extension = StayExtension::with(['reservation.user'])->findOrFail($id);

        if (! in_array($extension->status, [StayExtension::STATUS_PENDING, StayExtension::STATUS_AWAITING_PAYMENT], true)) {
            return response()->json(['message' => 'Cette demande de prolongation a deja ete traitee.'], 422);
        }

        if ($extension->payments()->whereIn('status', ['pending', 'success'])->exists()) {
            return response()->json(['message' => 'Un paiement est en cours pour cette prolongation : elle ne peut pas etre refusee.'], 422);
        }

        $extension->update([
            'status' => StayExtension::STATUS_REJECTED,
            'admin_notes' => $data['admin_notes'],
            'processed_at' => now(),
        ]);

        ReservationNotificationService::sendOnce(
            $extension->reservation,
            'extension_rejected_'.$extension->id,
            "Votre demande de prolongation du séjour #{$extension->reservation_id} a été refusée. Motif : {$data['admin_notes']}."
        );

        $mailer->extensionRejected($extension->fresh(['reservation.user']));

        return response()->json([
            'message' => 'Prolongation refusee. Le motif a ete envoye au client.',
            'extension' => $extension->fresh(['reservation.user', 'reservation.room']),
        ]);
    }
}
