<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/**
 * Mail transactionnel du Manoir (envoye par RequestMailer, juste apres la
 * reponse HTTP).
 *
 * Tout le contenu passe par Blade et est echappe : un nom ou un motif saisi
 * par un utilisateur ne peut pas injecter de HTML dans le mail.
 */
class ManoirNotificationMail extends Mailable
{
    /**
     * @param  array<int, string>  $paragraphs
     * @param  array<string, string>  $details
     */
    public function __construct(
        public string $mailSubject,
        public string $title,
        public array $paragraphs,
        public array $details = [],
        public ?string $greeting = null,
        public ?string $actionUrl = null,
        public ?string $actionLabel = null,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: $this->mailSubject);
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.notification',
            with: [
                'title' => $this->title,
                'greeting' => $this->greeting,
                'paragraphs' => $this->paragraphs,
                'details' => $this->details,
                'actionUrl' => $this->actionUrl,
                'actionLabel' => $this->actionLabel,
            ],
        );
    }
}
