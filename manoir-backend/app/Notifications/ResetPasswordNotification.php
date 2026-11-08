<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Mail de reinitialisation de mot de passe.
 *
 * Le lien pointe vers le frontend Next.js (et non vers une route Laravel),
 * car c'est lui qui affiche le formulaire de nouveau mot de passe.
 */
class ResetPasswordNotification extends Notification
{
    use Queueable;

    public function __construct(private string $token) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $minutes = config('auth.passwords.'.config('auth.defaults.passwords').'.expire', 60);

        $url = rtrim(config('app.frontend_url'), '/')
            .'/auth/nouveau-mot-de-passe?token='.$this->token
            .'&email='.urlencode($notifiable->getEmailForPasswordReset());

        return (new MailMessage)
            ->subject('Reinitialisation de votre mot de passe - Le Manoir')
            ->greeting('Bonjour '.$notifiable->name.',')
            ->line('Vous avez demande la reinitialisation de votre mot de passe sur Le Manoir.')
            ->action('Choisir un nouveau mot de passe', $url)
            ->line("Ce lien expire dans {$minutes} minutes.")
            ->line("Si vous n'etes pas a l'origine de cette demande, ignorez ce message : votre mot de passe reste inchange.")
            ->salutation('A bientot, Le Manoir');
    }
}
