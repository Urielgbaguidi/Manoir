<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminTableRequest;
use App\Mail\RefundCompleted;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\RoomCategory;
use App\Services\Notifications\RequestMailer;
use App\Services\ReservationNotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class AdminReservationController extends Controller
{
    /**
     * Demandes de reservation, filtrees et paginees cote serveur.
     *
     * Filtres : statut (liste), periode (sejour ou date de demande),
     * appartement, client (nom, email, telephone), recherche libre.
     */
    public function index(AdminTableRequest $request): JsonResponse
    {
        Reservation::expireOverduePaymentRequests();

        $query = Reservation::query()
            ->with(['user', 'room', 'payments', 'releasedByAdmin', 'extensions', 'vouchers'])
            ->when($request->validated('status'), fn ($q, $statuses) => $q->whereIn('status', $statuses))
            ->when($request->validated('room_id'), fn ($q, $roomId) => $q->where('room_id', $roomId))
            ->when($request->filled('category_type'), fn ($q) => $q->where('category_type', (string) $request->input('category_type')));

        $this->applyPeriod($query, $request, 'check_in', 'check_out');

        if ($client = $request->validated('client')) {
            $term = $request->likeTerm($client);
            $query->whereHas('user', fn ($q) => $q->where(fn ($q) => $q
                ->where('name', 'like', $term)
                ->orWhere('email', 'like', $term)
                ->orWhere('phone', 'like', $term)));
        }

        if ($search = $request->validated('search')) {
            $term = $request->likeTerm($search);
            $query->where(fn ($q) => $q
                ->when(ctype_digit(ltrim($search, '#')), fn ($q) => $q->orWhere('id', (int) ltrim($search, '#')))
                ->orWhereHas('user', fn ($q) => $q->where('name', 'like', $term)->orWhere('email', 'like', $term)->orWhere('phone', 'like', $term))
                ->orWhereHas('room', fn ($q) => $q->where('name', 'like', $term)->orWhere('apartment_number', 'like', $term)));
        }

        $sort = $request->sortColumn([
            'id' => 'id',
            'created_at' => 'created_at',
            'check_in' => 'check_in',
            'check_out' => 'check_out',
            'status' => 'status',
            'amount' => 'stay_amount',
        ], 'created_at');

        return response()->json(
            $query->orderBy($sort, $request->direction())->orderByDesc('id')->paginate($request->perPage())
        );
    }

    /**
     * Periode : chevauchement avec le sejour, ou date de la demande.
     *
     * @param  \Illuminate\Database\Eloquent\Builder<*>  $query
     */
    private function applyPeriod($query, AdminTableRequest $request, string $startColumn, string $endColumn): void
    {
        $from = $request->validated('date_from');
        $to = $request->validated('date_to');

        if (! $from && ! $to) {
            return;
        }

        if ($request->validated('date_field') === 'created') {
            $query->when($from, fn ($q) => $q->whereDate('created_at', '>=', $from))
                ->when($to, fn ($q) => $q->whereDate('created_at', '<=', $to));

            return;
        }

        $query->when($to, fn ($q) => $q->whereDate($startColumn, '<=', $to))
            ->when($from, fn ($q) => $q->whereDate($endColumn, '>=', $from));
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

        ReservationNotificationService::sendOnce(
            $reservation,
            'stay_released',
            "Votre séjour lié à la réservation #{$reservation->id} est terminé. Merci d’avoir choisi Le Manoir."
        );

        return response()->json([
            'message' => 'Appartement libere. Il est de nouveau disponible pour les prochaines demandes.',
            'reservation' => $reservation->fresh(['room', 'user', 'payments', 'releasedByAdmin']),
        ]);
    }

    public function approve(Request $request, string $id, RequestMailer $mailer): JsonResponse
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

        // L'arrivee du jour meme est acceptee : c'est le cas courant d'un
        // appartement qui se libere le matin et se reloue le soir. Seule une
        // date deja passee condamne la demande.
        if ($reservation->check_in->copy()->startOfDay()->lessThan(now()->startOfDay())) {
            $reservation->update(['status' => 'EXPIREE']);

            return response()->json([
                'message' => 'La date d\'arrivee est deja passee. Cette demande a expire et ne peut plus etre confirmee.',
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

        // Verrou + verification + mise a jour dans UNE seule transaction : deux
        // validations concurrentes de la meme chambre sont serialisees (anti double-booking).
        try {
            DB::transaction(function () use ($reservation, $request, $category, $checkIn, $checkOut) {
                // Verrouille la chambre visee pour la duree de la transaction.
                Room::whereKey($reservation->room_id)->lockForUpdate()->first();

                if (! $reservation->room->isAvailableForDates($checkIn, $checkOut, $reservation->id)) {
                    if ($category->type === 'vip') {
                        throw new \RuntimeException('Cet appartement VIP est deja bloque pour ces dates.');
                    }

                    $alternateRoom = $category->availableRoomForDates($checkIn, $checkOut, null, $reservation->id);

                    if (! $alternateRoom) {
                        throw new \RuntimeException('Aucun appartement libre pour ces dates.');
                    }

                    $reservation->update([
                        'room_id' => $alternateRoom->id,
                    ]);
                    $reservation->setRelation('room', $alternateRoom);
                }

                $reservation->update([
                    'status' => 'VALIDEE_PAIEMENT_REQUIS',
                    'admin_notes' => $request->admin_notes,
                    'approved_at' => now(),
                    // Meme delai que celui accorde a la reservation directe,
                    // sans jamais deborder du jour d'arrivee : au-dela la
                    // demande expirerait avant l'echeance et le client paierait
                    // dans le vide.
                    'payment_deadline' => now()
                        ->addHours(max(1, (int) config('booking.hold_hours', 12)))
                        ->min($reservation->check_in->copy()->endOfDay()),
                ]);
            });
        } catch (\RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        $approvedReservation = $reservation->fresh(['room', 'user', 'payments']);
        $amount = number_format($approvedReservation->amountDue(), 0, ',', ' ');
        ReservationNotificationService::sendOnce(
            $approvedReservation,
            'reservation_approved',
            "Votre demande #{$approvedReservation->id} a été validée. Réglez votre séjour ({$amount} FCFA) dans votre espace client avant le {$approvedReservation->payment_deadline->format('d/m/Y à H:i')}."
        );

        // Confirmation au client par email (file d'attente, sans bloquer).
        $mailer->reservationApproved($approvedReservation);

        return response()->json([
            'message' => 'Demande validee. Le client a ete prevenu par email et peut maintenant payer son sejour.',
            'reservation' => $approvedReservation,
        ]);
    }

    public function reject(Request $request, string $id, RequestMailer $mailer): JsonResponse
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

        $hasPaymentInProgress = $reservation->payments()
            ->whereIn('status', ['pending', 'success'])
            ->where('created_at', '>', now()->subMinutes(30))
            ->exists();

        if ($hasPaymentInProgress) {
            return response()->json([
                'message' => 'Un paiement est en cours pour cette demande : elle ne peut pas etre refusee pour le moment.',
            ], 422);
        }

        $reservation->update([
            'status' => 'REFUSEE',
            'admin_notes' => $request->admin_notes,
        ]);

        $mailer->reservationRejected($reservation->fresh(['room', 'user']));

        ReservationNotificationService::sendOnce(
            $reservation,
            'reservation_rejected',
            "Votre demande de réservation #{$reservation->id} a été refusée. Motif : {$request->admin_notes}."
        );

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

        ReservationNotificationService::sendOnce(
            $reservation,
            'refund_completed',
            'Le remboursement de '.number_format((int) ($reservation->cancellation_refund_amount ?? 0), 0, ',', ' ')." FCFA pour la réservation #{$reservation->id} a été confirmé."
        );

        return response()->json([
            'message' => 'Remboursement marque comme effectue.',
            'reservation' => $reservation,
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
            // Meme regle que la disponibilite publique : le blocage d'attente
            // compte tant que l'echeance de paiement n'est pas passee.
            ->where(function ($query) {
                $query->whereIn('status', ['CONFIRMEE', 'SEJOUR_PAYE'])
                    ->orWhere(function ($query) {
                        $query->where('status', 'VALIDEE_PAIEMENT_REQUIS')
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
