<?php

namespace App\Mail;

use App\Models\Reservation;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class RefundCompleted extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Reservation $reservation) {}

    public function build(): self
    {
        $refund = number_format((int) $this->reservation->cancellation_refund_amount, 0, ',', ' ');

        return $this->subject('Votre remboursement a ete effectue')
            ->html("
                <p>Votre remboursement de <strong>{$refund} FCFA</strong> a ete effectue avec succes.</p>
                <p>Merci de votre confiance.</p>
            ");
    }
}
