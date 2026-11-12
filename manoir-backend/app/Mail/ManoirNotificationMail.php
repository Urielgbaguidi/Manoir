<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Mail transactionnel du Manoir, envoye en file d'attente.
 *
 * Tout le contenu passe par Blade et est echappe : un nom ou un motif saisi
 * par un utilisateur ne peut pas injecter de HTML dans le mail.
 */
class ManoirNotificationMail extends Mailable implements ShouldQueue
{
    use Queueable, SerializesModels;

    /** Nouvelles tentatives si le serveur SMTP refuse temporairement. */
    public int $tries = 3;

    /** @var array<int, int> */
    public array $backoff = [60, 300];

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

    /**
     * Echec definitif apres toutes les tentatives : journalise, sans jamais
     * remonter jusqu'a l'utilisateur.
     */
    public function failed(Throwable $exception): void
    {
        Log::error('Echec definitif d\'envoi de mail', [
            'subject' => $this->mailSubject,
            'error' => $exception->getMessage(),
        ]);
    }
}
