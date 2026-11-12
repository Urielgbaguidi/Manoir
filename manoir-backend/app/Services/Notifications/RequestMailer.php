<?php

namespace App\Services\Notifications;

use App\Mail\ManoirNotificationMail;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\StayExtension;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Mails lies aux demandes : notification a l'admin a chaque nouvelle demande,
 * confirmation au client apres validation, confirmation de paiement.
 *
 * Tous partent en file d'attente. Un echec d'envoi ne bloque jamais la
 * requete : il est journalise.
 */
class RequestMailer
{
    public function newReservationRequest(Reservation $reservation): void
    {
        $reservation->loadMissing(['user', 'room']);

        $this->toAdmins(new ManoirNotificationMail(
            mailSubject: "Nouvelle demande de réservation #{$reservation->id}",
            title: 'Nouvelle demande de réservation',
            paragraphs: ['Une nouvelle demande de réservation attend votre validation.'],
            details: [
                'Type de demande' => 'Réservation',
                'Client' => $this->clientLabel($reservation->user),
                'Téléphone' => (string) ($reservation->user?->phone ?? '—'),
                'Appartement' => $this->apartmentLabel($reservation),
                'Arrivée' => $reservation->check_in->format('d/m/Y'),
                'Départ' => $reservation->check_out->format('d/m/Y'),
                'Voyageurs' => (string) $reservation->guests,
                'Montant du séjour' => $this->money((int) $reservation->stay_amount),
            ],
            actionUrl: $this->adminUrl('reservation', $reservation->id),
            actionLabel: 'Voir la demande',
        ));
    }

    public function newExtensionRequest(StayExtension $extension): void
    {
        $extension->loadMissing(['reservation.user', 'reservation.room']);
        $reservation = $extension->reservation;

        $this->toAdmins(new ManoirNotificationMail(
            mailSubject: "Nouvelle demande de prolongation — séjour #{$reservation->id}",
            title: 'Nouvelle demande de prolongation de séjour',
            paragraphs: ['Un client en séjour demande à prolonger. La demande attend votre validation.'],
            details: [
                'Type de demande' => 'Prolongation de séjour',
                'Client' => $this->clientLabel($reservation->user),
                'Téléphone' => (string) ($reservation->user?->phone ?? '—'),
                'Appartement' => $this->apartmentLabel($reservation),
                'Départ actuel' => $extension->previous_check_out->format('d/m/Y'),
                'Nouveau départ demandé' => $extension->requested_check_out->format('d/m/Y'),
                'Nuits supplémentaires' => (string) $extension->nights,
                'Montant' => $this->money((int) $extension->amount),
            ],
            actionUrl: $this->adminUrl('extension', $extension->id),
            actionLabel: 'Voir la demande',
        ));
    }

    public function reservationApproved(Reservation $reservation): void
    {
        $reservation->loadMissing(['user', 'room']);

        $this->toClient($reservation->user, new ManoirNotificationMail(
            mailSubject: 'Votre demande de réservation est validée — Le Manoir',
            title: 'Votre demande est validée',
            greeting: 'Bonjour '.$reservation->user->name.',',
            paragraphs: array_filter([
                'Bonne nouvelle : votre demande de réservation a été validée. Le paiement de votre séjour est maintenant ouvert dans votre espace client.',
                $reservation->payment_deadline
                    ? 'L\'appartement vous est réservé jusqu\'au '.$reservation->payment_deadline->format('d/m/Y à H:i').' : passé ce délai sans paiement, il sera remis à la location.'
                    : null,
                $reservation->admin_notes ? 'Message de l\'équipe : '.$reservation->admin_notes : null,
            ]),
            details: [
                'Réservation' => '#'.$reservation->id,
                'Appartement' => $this->apartmentLabel($reservation),
                'Arrivée' => $reservation->check_in->format('d/m/Y'),
                'Départ' => $reservation->check_out->format('d/m/Y'),
                'Montant à régler' => $this->money($reservation->amountDue()),
            ],
            actionUrl: $this->frontendUrl('/espace-client/reservations?reservation='.$reservation->id),
            actionLabel: 'Payer mon séjour',
        ));
    }

    public function reservationRejected(Reservation $reservation): void
    {
        $reservation->loadMissing(['user', 'room']);

        $this->toClient($reservation->user, new ManoirNotificationMail(
            mailSubject: 'Votre demande de réservation — Le Manoir',
            title: 'Votre demande n\'a pas pu être acceptée',
            greeting: 'Bonjour '.$reservation->user->name.',',
            paragraphs: array_filter([
                'Nous sommes désolés : votre demande de réservation #'.$reservation->id.' n\'a pas pu être acceptée. Aucun paiement n\'a été demandé.',
                $reservation->admin_notes ? 'Motif : '.$reservation->admin_notes : null,
                'N\'hésitez pas à choisir d\'autres dates depuis notre site.',
            ]),
            actionUrl: $this->frontendUrl('/rooms'),
            actionLabel: 'Voir les disponibilités',
        ));
    }

    public function extensionApproved(StayExtension $extension): void
    {
        $extension->loadMissing(['reservation.user', 'reservation.room']);
        $reservation = $extension->reservation;

        $this->toClient($reservation->user, new ManoirNotificationMail(
            mailSubject: 'Votre prolongation est validée — Le Manoir',
            title: 'Votre demande de prolongation est validée',
            greeting: 'Bonjour '.$reservation->user->name.',',
            paragraphs: array_filter([
                'Votre demande de prolongation a été validée. Réglez-la depuis votre espace client pour confirmer les nuits supplémentaires.',
                $extension->payment_deadline
                    ? 'Les nuits vous sont réservées jusqu\'au '.$extension->payment_deadline->format('d/m/Y à H:i').'.'
                    : null,
                $extension->admin_notes ? 'Message de l\'équipe : '.$extension->admin_notes : null,
            ]),
            details: [
                'Séjour' => '#'.$reservation->id,
                'Appartement' => $this->apartmentLabel($reservation),
                'Nouveau départ' => $extension->requested_check_out->format('d/m/Y'),
                'Nuits supplémentaires' => (string) $extension->nights,
                'Montant à régler' => $this->money((int) $extension->amount),
            ],
            actionUrl: $this->frontendUrl('/espace-client/reservations?reservation='.$reservation->id),
            actionLabel: 'Payer ma prolongation',
        ));
    }

    public function extensionRejected(StayExtension $extension): void
    {
        $extension->loadMissing(['reservation.user']);
        $reservation = $extension->reservation;

        $this->toClient($reservation->user, new ManoirNotificationMail(
            mailSubject: 'Votre demande de prolongation — Le Manoir',
            title: 'Votre prolongation n\'a pas pu être acceptée',
            greeting: 'Bonjour '.$reservation->user->name.',',
            paragraphs: array_filter([
                'Nous sommes désolés : votre demande de prolongation du séjour #'.$reservation->id.' n\'a pas pu être acceptée. Votre départ reste prévu le '.$extension->previous_check_out->format('d/m/Y').'.',
                $extension->admin_notes ? 'Motif : '.$extension->admin_notes : null,
            ]),
        ));
    }

    public function paymentConfirmed(Payment $payment): void
    {
        $payment->loadMissing(['reservation.user', 'reservation.room', 'voucher']);
        $reservation = $payment->reservation;

        $this->toClient($reservation->user, new ManoirNotificationMail(
            mailSubject: 'Paiement confirmé — votre Bon de Séjour',
            title: 'Paiement confirmé',
            greeting: 'Bonjour '.$reservation->user->name.',',
            paragraphs: [
                'Nous avons bien reçu votre paiement. Votre Bon de Séjour est disponible et téléchargeable depuis votre espace client.',
            ],
            details: [
                'Bon de Séjour' => (string) ($payment->voucher?->number ?? $payment->invoice_number),
                'Montant payé' => $this->money((int) $payment->amount),
                'Appartement' => $this->apartmentLabel($reservation),
                'Arrivée' => $reservation->check_in->format('d/m/Y'),
                'Départ' => $reservation->check_out->format('d/m/Y'),
            ],
            actionUrl: $this->frontendUrl('/espace-client/reservations?reservation='.$reservation->id),
            actionLabel: 'Télécharger mon Bon de Séjour',
        ));
    }

    private function toClient(?User $user, ManoirNotificationMail $mail): void
    {
        if (! $user?->email) {
            return;
        }

        try {
            Mail::to($user->email)->queue($mail);
        } catch (Throwable $exception) {
            Log::error('Mail client non mis en file : '.$exception->getMessage(), ['subject' => $mail->mailSubject]);
        }
    }

    private function toAdmins(ManoirNotificationMail $mail): void
    {
        $recipients = array_values(array_filter(array_map(
            'trim',
            explode(',', (string) config('mail.admin_notification_address', ''))
        )));

        if ($recipients === []) {
            $recipients = User::query()
                ->where(fn ($query) => $query->where('is_admin', true)->orWhere('is_super_admin', true))
                ->pluck('email')
                ->all();
        }

        if ($recipients === []) {
            Log::warning('Aucun destinataire admin pour : '.$mail->mailSubject);

            return;
        }

        try {
            Mail::to($recipients)->queue($mail);
        } catch (Throwable $exception) {
            Log::error('Mail admin non mis en file : '.$exception->getMessage(), ['subject' => $mail->mailSubject]);
        }
    }

    private function adminUrl(string $type, int $id): string
    {
        return $this->frontendUrl('/admin/reservations?type='.$type.'&id='.$id);
    }

    private function frontendUrl(string $path): string
    {
        return rtrim((string) config('app.frontend_url'), '/').$path;
    }

    private function clientLabel(?User $user): string
    {
        return $user ? $user->name.' ('.$user->email.')' : '—';
    }

    private function apartmentLabel(Reservation $reservation): string
    {
        $room = $reservation->room;

        if (! $room) {
            return (string) $reservation->category_type;
        }

        return $room->apartment_number
            ? 'Appartement N°'.$room->apartment_number.' — '.$room->name
            : (string) $room->name;
    }

    private function money(int $amount): string
    {
        return number_format($amount, 0, ',', ' ').' FCFA';
    }
}
