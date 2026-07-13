<?php

namespace App\Mail;

use App\Models\Reservation;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PaymentReminder extends Mailable
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
            subject: 'Il vous reste 2h pour payer votre reservation - Le Manoir',
        );
    }

    public function content(): Content
    {
        $deposit = number_format((int) $this->reservation->deposit_amount, 0, ',', ' ');

        return new Content(
            htmlString: "
                <h2>Il vous reste 2h pour effectuer votre paiement de reservation</h2>
                <p>Bonjour {$this->reservation->user->name},</p>
                <p>Votre autorisation de paiement expire le <strong>{$this->reservation->payment_deadline}</strong>.</p>
                <p><strong>Montant de la caution :</strong> {$deposit} FCFA</p>
                <p>Connectez-vous a votre espace client pour finaliser la reservation.</p>
                <p>L'equipe du Manoir</p>
            ",
        );
    }
}
