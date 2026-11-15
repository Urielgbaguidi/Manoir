<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * Lien de confirmation d'adresse e-mail.
 *
 * Envoye immediatement (pas de file d'attente) : le client attend ce mail
 * devant son ecran pour activer son compte.
 */
class VerifyEmailMail extends Mailable
{
    public function __construct(
        public string $name,
        public string $url,
        public int $minutes,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Confirmez votre adresse e-mail - Le Manoir');
    }

    public function content(): Content
    {
        return new Content(view: 'emails.verify-email');
    }
}
