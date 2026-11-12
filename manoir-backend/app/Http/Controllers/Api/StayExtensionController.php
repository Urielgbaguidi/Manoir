<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Reservations\StoreStayExtensionRequest;
use App\Models\Reservation;
use App\Models\RoomCategory;
use App\Models\StayExtension;
use App\Services\Notifications\RequestMailer;
use App\Services\ReservationNotificationService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Demandes de prolongation cote client.
 *
 * Regles verifiees ici, pas seulement dans l'interface :
 *  1. le client occupe deja l'appartement (sejour paye, arrivee passee) ;
 *  2. au moins une journee du sejour est deja passee ;
 *  3. il saisit une nouvelle date de depart, posterieure a l'actuelle ;
 *  4. la demande attend la validation de l'administration ;
 *  5. le paiement n'est possible qu'apres cette validation.
 */
class StayExtensionController extends Controller
{
    public function index(Request $request, string $id): JsonResponse
    {
        $reservation = Reservation::where('user_id', $request->user()->id)->findOrFail($id);

        StayExtension::expireOverdue();

        return response()->json([
            'extensions' => $reservation->extensions()->with(['payments', 'voucher'])->get(),
            'can_request' => $reservation->canRequestStayExtension(),
            'refusal_reason' => $reservation->stayExtensionRefusal(),
        ]);
    }

    public function store(StoreStayExtensionRequest $request, string $id, RequestMailer $mailer): JsonResponse
    {
        StayExtension::expireOverdue();

        $result = DB::transaction(function () use ($request, $id) {
            /** @var Reservation $reservation */
            $reservation = Reservation::where('user_id', $request->user()->id)
                ->with('room')
                ->lockForUpdate()
                ->findOrFail($id);

            if ($refusal = $reservation->stayExtensionRefusal()) {
                return response()->json(['message' => $refusal], 422);
            }

            $currentCheckOut = $reservation->check_out->copy()->startOfDay();
            $newCheckOut = Carbon::parse($request->validated('new_check_out'))->startOfDay();

            if ($newCheckOut->lessThanOrEqualTo($currentCheckOut)) {
                return response()->json([
                    'message' => 'La nouvelle date de depart doit etre posterieure a la date de depart actuelle ('.$currentCheckOut->format('d/m/Y').').',
                ], 422);
            }

            $nights = (int) $currentCheckOut->diffInDays($newCheckOut);
            $totalNights = (int) $reservation->check_in->copy()->startOfDay()->diffInDays($newCheckOut);

            if ($totalNights > (int) config('booking.max_nights', 90)) {
                return response()->json([
                    'message' => 'La duree totale du sejour ne peut exceder '.config('booking.max_nights', 90).' nuits.',
                ], 422);
            }

            if (! $reservation->room->isAvailableForDates(
                $currentCheckOut->toDateString(),
                $newCheckOut->toDateString(),
                $reservation->id
            )) {
                return response()->json([
                    'message' => 'L\'appartement n\'est pas disponible jusqu\'a cette date. Essayez une date de depart plus proche.',
                ], 422);
            }

            $category = RoomCategory::where('type', $reservation->category_type ?: $reservation->room->type)->first();
            $pricePerNight = (int) ($reservation->room->base_price ?: $category?->price_per_night ?: 0);

            return StayExtension::create([
                'reservation_id' => $reservation->id,
                'user_id' => $reservation->user_id,
                'previous_check_out' => $currentCheckOut->toDateString(),
                'requested_check_out' => $newCheckOut->toDateString(),
                'nights' => $nights,
                'price_per_night' => $pricePerNight,
                'amount' => $nights * $pricePerNight,
                'status' => StayExtension::STATUS_PENDING,
            ]);
        });

        if ($result instanceof JsonResponse) {
            return $result;
        }

        $extension = $result->load('reservation');

        ReservationNotificationService::sendOnce(
            $extension->reservation,
            'extension_requested_'.$extension->id,
            "Votre demande de prolongation du séjour #{$extension->reservation_id} jusqu’au {$extension->requested_check_out->format('d/m/Y')} a été envoyée. Le paiement s’ouvrira après validation par l’équipe du Manoir."
        );

        $mailer->newExtensionRequest($extension);

        return response()->json([
            'message' => 'Votre demande de prolongation a ete envoyee. Vous serez prevenu des sa validation.',
            'extension' => $extension->fresh(),
        ], 201);
    }
}
