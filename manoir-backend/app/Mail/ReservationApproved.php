<?php

namespace App\Mail;

use App\Models\Reservation;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ReservationApproved extends Mailable
{
    use Queueable, SerializesModels;

    public Reservation $reservation;

    public function __construct(Reservation $reservation)
    {
        $reservation->loadMissing(['user', 'room']);
        $this->reservation = $reservation;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Votre demande a ete acceptee - Le Manoir',
        );
    }

    public function content(): Content
    {
        $label = $this->formatApartmentLabel();
        $deposit = number_format((int) $this->reservation->deposit_amount, 0, ',', ' ');
        $stay = number_format((int) $this->reservation->stay_amount, 0, ',', ' ');

        return new Content(
            htmlString: "
                <h2>Votre demande a ete acceptee</h2>
                <p>Bonjour {$this->reservation->user->name},</p>
                <p>Votre demande pour <strong>{$label}</strong> a ete acceptee.</p>
                <ul>
                    <li>Arrivee : {$this->reservation->check_in}</li>
                    <li>Depart : {$this->reservation->check_out}</li>
                    <li>Caution a regler : {$deposit} FCFA</li>
                    <li>Montant du sejour : {$stay} FCFA</li>
                </ul>
                <p>Autorisation de payer valable 24h depuis la validation.</p>
                <p>Connectez-vous a votre espace client pour regler la caution et confirmer definitivement votre reservation.</p>
                <p>L'equipe du Manoir</p>
            ",
        );
    }

    private function formatApartmentLabel(): string
    {
        $room = $this->reservation->room;

        if (! $room) {
            return (string) $this->reservation->category_type;
        }

        $label = match ($this->reservation->category_type ?: $room->type) {
            'vip' => $room->name,
            'deux_chambres' => '2 Chambres',
            'une_chambre' => '1 Chambre',
            default => $room->name,
        };

        return $room->apartment_number
            ? "Appartement N°{$room->apartment_number} — {$label}"
            : $room->name;
    }
}
