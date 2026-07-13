<?php

namespace App\Mail;

use App\Models\Reservation;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class ReservationCancelled extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Reservation $reservation, public bool $forAdmin = false) {}

    public function build(): self
    {
        $reservation = $this->reservation->loadMissing(['user', 'room']);
        $refund = number_format((int) $reservation->cancellation_refund_amount, 0, ',', ' ');
        $apartment = $reservation->room?->apartment_number
            ? "Appartement N°{$reservation->room->apartment_number}"
            : ($reservation->room?->name ?? 'Appartement');

        if ($this->forAdmin) {
            return $this->subject('Reservation annulee - remboursement a traiter')
                ->html("
                    <p>Le client {$reservation->user->name} a annule sa reservation.</p>
                    <p><strong>{$apartment}</strong></p>
                    <p>Montant a rembourser : <strong>{$refund} FCFA</strong></p>
                ");
        }

        return $this->subject('Votre reservation a ete annulee')
            ->html("
                <p>Votre reservation a ete annulee.</p>
                <p>Vous serez rembourse de <strong>{$refund} FCFA</strong> dans un delai de 48h a 72h via le meme moyen de paiement utilise.</p>
            ");
    }
}
