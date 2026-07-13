<?php

namespace App\Mail;

use App\Models\Reservation;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ReservationRejected extends Mailable
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
            subject: 'Votre demande de reservation - Le Manoir',
        );
    }

    public function content(): Content
    {
        $label = $this->formatApartmentLabel();

        return new Content(
            htmlString: "
                <h2>Bonjour {$this->reservation->user->name},</h2>
                <p>Votre demande pour <strong>{$label}</strong> a ete examinee.</p>
                <p>Elle ne peut pas etre confirmee pour le motif suivant :</p>
                <blockquote style='background:#f8f4eb;border-left:4px solid #7f1d1d;padding:12px;margin:16px 0;'>
                    {$this->reservation->admin_notes}
                </blockquote>
                <p>Dates demandees : du {$this->reservation->check_in} au {$this->reservation->check_out}</p>
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
