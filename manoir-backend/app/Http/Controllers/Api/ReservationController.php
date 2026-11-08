<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\ReservationCancelled;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\RoomCategory;
use App\Services\GoogleCalendarWriter;
use App\Services\ReservationNotificationService;
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
            'guests' => 'nullable|integer|min:1',
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
            // Le client choisit desormais un appartement precis : lui repondre
            // « aucun appartement disponible » serait faux si un autre de la
            // meme categorie est libre.
            if ($preferredRoomId) {
                $libres = $category->rooms()
                    ->where('status', 'available')
                    ->whereNotNull('apartment_number')
                    ->orderBy('apartment_number')
                    ->get()
                    ->filter(fn (Room $autre) => $autre->isAvailableForDates($request->check_in, $request->check_out))
                    ->pluck('apartment_number')
                    ->values();

                return response()->json([
                    'message' => $libres->isEmpty()
                        ? 'Cet appartement n\'est pas disponible sur ces dates, et aucun autre de cette categorie ne l\'est non plus.'
                        : 'Cet appartement n\'est pas disponible sur ces dates. Appartement(s) libre(s) : N°'.$libres->join(', N°'),
                    'alternatives' => $libres->all(),
                ], 422);
            }

            return response()->json([
                'message' => 'Aucun appartement disponible pour ces dates. Veuillez choisir d\'autres dates.',
            ], 422);
        }

        $checkIn = Carbon::parse($request->check_in)->startOfDay();
        $checkOut = Carbon::parse($request->check_out)->startOfDay();
        $nights = max(1, $checkIn->diffInDays($checkOut));

        // Garde-fou: duree de sejour raisonnable.
        if ($nights > (int) config('booking.max_nights', 90)) {
            return response()->json([
                'message' => 'La duree du sejour ne peut exceder '.config('booking.max_nights', 90).' nuits.',
            ], 422);
        }

        // Nombre de voyageurs reellement controle (<= capacite de l'appartement).
        $maxGuests = (int) $room->max_occupants;
        $guests = (int) ($request->integer('guests') ?: $maxGuests);
        if ($guests < 1 || $guests > $maxGuests) {
            return response()->json([
                'message' => "Le nombre de voyageurs doit etre compris entre 1 et {$maxGuests}.",
            ], 422);
        }

        // Les tarifs de l'appartement priment sur ceux de la categorie : chaque
        // appartement est choisi individuellement et affiche son propre prix.
        $pricePerNight = (int) ($room->base_price ?: $category->price_per_night);
        $stayAmount = $nights * $pricePerNight;

        // Acompte : une part du sejour, versee a l'avance et DEDUITE du total.
        // L'ancienne formule multipliait une caution journaliere par le delai
        // avant l'arrivee, sans aucun rapport avec le prix du sejour.
        $rate = (float) config('booking.deposit_rate', 0.30);
        $depositAmount = (int) round($stayAmount * $rate);

        // Reserver retient l'appartement et ouvre le paiement dans la foulee.
        // L'attente d'une validation par l'administration a ete supprimee :
        // elle immobilisait le logement sans qu'aucune somme ne soit engagee,
        // et laissait le client sans reponse.
        $echeance = $this->echeanceDePaiement($checkIn);

        $reservation = Reservation::create([
            'user_id' => Auth::id(),
            'room_id' => $room->id,
            'category_type' => $category->type,
            'check_in' => $request->check_in,
            'check_out' => $request->check_out,
            'guests' => $guests,
            'total_price' => $stayAmount,
            'deposit_daily_rate' => 0,
            'deposit_amount' => $depositAmount,
            'stay_amount' => $stayAmount,
            'status' => 'VALIDEE_PAIEMENT_REQUIS',
            'approved_at' => now(),
            'payment_deadline' => $echeance,
            'special_requests' => $request->special_requests,
        ]);

        $montant = number_format($depositAmount, 0, ',', ' ');
        $limite = $echeance->format('d/m/Y a H:i');

        ReservationNotificationService::sendOnce(
            $reservation,
            'reservation_submitted',
            "Votre réservation #{$reservation->id} est enregistrée. L’appartement vous est réservé jusqu’au {$limite} : réglez l’acompte de {$montant} FCFA avant cette heure, sans quoi il sera remis à la location."
        );

        return response()->json([
            'message' => $room->apartment_number
                ? "Appartement N°{$room->apartment_number} retenu jusqu'au {$limite}. Réglez l'acompte de {$montant} FCFA avant cette heure pour confirmer votre séjour."
                : "Appartement retenu jusqu'au {$limite}. Réglez l'acompte de {$montant} FCFA avant cette heure pour confirmer votre séjour.",
            'payment_deadline' => $echeance->toIso8601String(),
            'deposit_amount' => $depositAmount,
            'reservation' => $reservation->load('room'),
        ], 201);
    }

    /**
     * Fin du blocage : le client a ce delai pour regler son acompte.
     *
     * L'echeance ne depasse jamais le jour d'arrivee, sinon la reservation
     * expirerait avant l'heure limite et le client paierait dans le vide.
     */
    private function echeanceDePaiement(Carbon $arrivee): Carbon
    {
        $heures = max(1, (int) config('booking.hold_hours', 12));

        return now()->addHours($heures)->min($arrivee->copy()->endOfDay());
    }

    public function myReservations(): JsonResponse
    {
        Reservation::expireOverduePaymentRequests(Auth::id());

        $reservations = Reservation::where('user_id', Auth::id())
            // Masquees par le client : elles restent en base et visibles cote
            // administration, mais n'encombrent plus sa liste.
            ->whereNull('client_hidden_at')
            ->with(['room', 'payments', 'user'])
            ->orderByDesc('created_at')
            ->get();

        return response()->json($reservations);
    }

    /**
     * Retire une reservation terminee de l'historique du client.
     *
     * Rien n'est supprime : factures, bons et montants encaisses doivent rester
     * consultables par l'administration et opposables en cas de litige.
     */
    public function masquer(string $id): JsonResponse
    {
        $reservation = Reservation::where('user_id', Auth::id())->findOrFail($id);

        $reservation->expireIfPaymentDeadlinePassed();
        $reservation->refresh();

        if (! $reservation->peutEtreMasquee()) {
            return response()->json([
                'message' => 'Cette reservation est encore en cours : elle ne peut pas etre retiree de votre historique.',
            ], 422);
        }

        $reservation->forceFill(['client_hidden_at' => now()])->save();

        return response()->json(['message' => 'Reservation retiree de votre historique.']);
    }

    /**
     * Vide l'historique : masque d'un coup tout ce qui est termine.
     */
    public function viderHistorique(): JsonResponse
    {
        Reservation::expireOverduePaymentRequests(Auth::id());

        $terminees = Reservation::where('user_id', Auth::id())
            ->whereNull('client_hidden_at')
            ->whereIn('status', Reservation::STATUTS_TERMINES)
            ->get()
            ->filter(fn (Reservation $reservation) => $reservation->peutEtreMasquee());

        foreach ($terminees as $reservation) {
            $reservation->forceFill(['client_hidden_at' => now()])->save();
        }

        $nombre = $terminees->count();

        return response()->json([
            'message' => $nombre === 0
                ? 'Votre historique est deja vide.'
                : ($nombre === 1
                    ? 'Une reservation a ete retiree de votre historique.'
                    : "{$nombre} reservations ont ete retirees de votre historique."),
            'hidden' => $nombre,
        ]);
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

        // Une arrivee prevue aujourd'hui reste annulable : le client doit
        // pouvoir se retracter dans la journee, et l'appartement se relouer le
        // soir meme. Seule une date d'arrivee DEPASSEE ferme l'annulation.
        if ($reservation->check_in->copy()->startOfDay()->lessThan(now()->startOfDay())) {
            return response()->json([
                'message' => 'La date d\'arrivee est passee. Cette reservation ne peut plus etre annulee.',
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

        // L'appartement redevient libre sur le site : il doit l'etre aussi dans
        // l'agenda, sinon la periode resterait barree sans raison.
        app(GoogleCalendarWriter::class)->retirer($reservation);

        ReservationNotificationService::sendOnce(
            $reservation,
            'reservation_cancelled',
            "Votre réservation #{$reservation->id} est annulée. Le remboursement prévu est de ".number_format((int) $calculation['refund_amount'], 0, ',', ' ').' FCFA sous 48h à 72h.'
        );

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

    public function requestExtension(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'new_check_out' => 'required|date',
        ]);

        $reservation = Reservation::where('user_id', Auth::id())
            ->with(['room', 'payments', 'user'])
            ->findOrFail($id);

        $reservation->expireIfPaymentDeadlinePassed();

        if (! $reservation->canRequestStayExtension()) {
            return response()->json([
                'message' => 'Cette reservation ne peut pas etre prolongee pour le moment.',
            ], 422);
        }

        $newCheckOut = Carbon::parse($request->new_check_out)->startOfDay();
        $currentCheckOut = $reservation->check_out->copy()->startOfDay();

        if ($newCheckOut->lessThanOrEqualTo($currentCheckOut)) {
            return response()->json([
                'message' => 'La nouvelle date de depart doit etre apres la date de depart actuelle.',
            ], 422);
        }

        if (! $reservation->room->isAvailableForDates(
            $currentCheckOut->toDateString(),
            $newCheckOut->toDateString(),
            $reservation->id
        )) {
            return response()->json([
                'message' => 'Cet appartement n\'est pas disponible jusqu\'a cette nouvelle date de depart.',
            ], 422);
        }

        $reservation->update([
            'extension_status' => 'EN_ATTENTE',
            'extension_previous_check_out' => $reservation->check_out,
            'extension_requested_check_out' => $newCheckOut,
            'extension_requested_at' => now(),
            'extension_processed_at' => null,
            'extension_admin_notes' => null,
        ]);

        ReservationNotificationService::sendOnce(
            $reservation,
            'extension_requested',
            "Votre demande de prolongation pour la réservation #{$reservation->id}, jusqu’au {$newCheckOut->format('d/m/Y')}, a été envoyée à l’administration."
        );

        return response()->json([
            'message' => 'Votre demande de prolongation a ete envoyee a l\'administrateur.',
            'reservation' => $reservation->fresh(['room', 'payments', 'user']),
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
