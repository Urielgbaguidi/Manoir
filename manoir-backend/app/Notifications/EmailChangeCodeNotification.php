<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Code de confirmation envoye a la nouvelle adresse lors d'un changement
 * d'email. Envoye immediatement (pas de file) : le client attend le code.
 */
class EmailChangeCodeNotification extends Notification
{
    use Queueable;

    public function __construct(private readonly string $code) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Confirmez votre nouvelle adresse - Le Manoir')
            ->greeting('Bonjour,')
            ->line('Voici le code pour confirmer votre nouvelle adresse email :')
            ->line('**'.$this->code.'**')
            ->line('Il expire dans 15 minutes.')
            ->line("Si vous n'etes pas a l'origine de cette demande, ignorez ce message.")
            ->salutation('A bientot, Le Manoir');
    }
}
