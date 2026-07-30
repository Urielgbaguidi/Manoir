<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\Reservation;

class ReservationNotificationService
{
    public static function sendOnce(
        Reservation $reservation,
        string $type,
        string $content,
        array $metadata = []
    ): Notification {
        $notification = Notification::firstOrCreate(
            [
                'user_id' => $reservation->user_id,
                'reservation_id' => $reservation->id,
                'type' => $type,
            ],
            [
                'channel' => 'system',
                'status' => 'sent',
                'content' => $content,
                'metadata' => array_merge(['action_url' => '/reservations'], $metadata),
                'sent_at' => now(),
            ]
        );

        if (! $notification->wasRecentlyCreated) {
            $notification->update([
                'content' => $content,
                'metadata' => array_merge(['action_url' => '/reservations'], $metadata),
            ]);
        }

        return $notification;
    }

    public static function syncForUser(int $userId): void
    {
        Reservation::where('user_id', $userId)
            ->with('payments')
            ->orderByDesc('created_at')
            ->limit(30)
            ->get()
            ->each(function (Reservation $reservation) {
                $paidDeposit = $reservation->payments
                    ->first(fn ($payment) => $payment->payment_type === 'deposit' && $payment->status === 'success');
                $depositValue = (int) ($reservation->deposit_amount
                    ?: $reservation->total_price
                    ?: $paidDeposit?->amount
                    ?: 0);
                $amount = number_format(
                    $depositValue,
                    0,
                    ',',
                    ' '
                );

                match ($reservation->status) {
                    'EN_ATTENTE' => self::sendOnce(
                        $reservation,
                        'reservation_submitted',
                        "Votre demande de réservation #{$reservation->id} a bien été envoyée. L’administration va l’examiner."
                    ),
                    'VALIDEE_PAIEMENT_REQUIS' => self::sendOnce(
                        $reservation,
                        'reservation_approved',
                        "Votre demande #{$reservation->id} a été acceptée. Payez la caution de {$amount} FCFA dans votre espace client avant l’expiration du délai pour confirmer la réservation."
                    ),
                    'CONFIRMEE' => self::sendOnce(
                        $reservation,
                        'deposit_paid',
                        "Votre caution de {$amount} FCFA pour la réservation #{$reservation->id} est payée. Votre réservation est maintenant confirmée."
                    ),
                    'SEJOUR_PAYE' => self::sendOnce(
                        $reservation,
                        'stay_paid',
                        "Le paiement de votre séjour pour la réservation #{$reservation->id} est confirmé. Votre facture est disponible dans votre espace client."
                    ),
                    'REFUSEE' => self::sendOnce(
                        $reservation,
                        'reservation_rejected',
                        "Votre demande de réservation #{$reservation->id} a été refusée. Motif : ".($reservation->admin_notes ?: 'non précisé').'.'
                    ),
                    'EXPIREE' => self::sendOnce(
                        $reservation,
                        'reservation_expired',
                        "La réservation #{$reservation->id} a expiré : la caution n’a pas été payée dans le délai prévu. L’appartement a été remis à disposition."
                    ),
                    'ANNULEE' => self::sendOnce(
                        $reservation,
                        'reservation_cancelled',
                        "Votre réservation #{$reservation->id} est annulée. Le montant prévu pour le remboursement est de ".number_format((int) ($reservation->cancellation_refund_amount ?? 0), 0, ',', ' ')." FCFA."
                    ),
                    'REMBOURSEE' => self::sendOnce(
                        $reservation,
                        'refund_completed',
                        "Le remboursement de ".number_format((int) ($reservation->cancellation_refund_amount ?? 0), 0, ',', ' ')." FCFA pour la réservation #{$reservation->id} a été confirmé."
                    ),
                    'LIBEREE' => self::sendOnce(
                        $reservation,
                        'stay_released',
                        "Votre séjour lié à la réservation #{$reservation->id} est terminé. Merci d’avoir choisi Le Manoir."
                    ),
                    default => null,
                };

                if ($reservation->extension_status === 'APPROUVEE') {
                    self::sendOnce(
                        $reservation,
                        'extension_approved',
                        "Votre demande de prolongation #{$reservation->id} a été acceptée. Votre nouveau départ est prévu le {$reservation->check_out->format('d/m/Y')} et le montant du séjour a été mis à jour."
                    );
                } elseif ($reservation->extension_status === 'REFUSEE') {
                    self::sendOnce(
                        $reservation,
                        'extension_rejected',
                        "Votre demande de prolongation #{$reservation->id} a été refusée. Motif : ".($reservation->extension_admin_notes ?: 'non précisé').'.'
                    );
                }
            });
    }
}
