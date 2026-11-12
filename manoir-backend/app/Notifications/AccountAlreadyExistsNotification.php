<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Envoye quand quelqu'un tente de s'inscrire avec une adresse deja utilisee.
 *
 * L'inscription repond la meme chose dans tous les cas (pas d'enumeration des
 * comptes) : c'est par ce mail que le vrai proprietaire de l'adresse apprend
 * qu'il a deja un compte.
 */
class AccountAlreadyExistsNotification extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $frontend = rtrim((string) config('app.frontend_url'), '/');

        return (new MailMessage)
            ->subject('Vous avez deja un compte - Le Manoir')
            ->greeting('Bonjour,')
            ->line('Une inscription vient d\'etre tentee avec cette adresse, mais un compte existe deja.')
            ->action('Me connecter', $frontend.'/auth/login')
            ->line('Mot de passe oublie ? Utilisez le lien « Mot de passe oublie » sur la page de connexion.')
            ->line("Si vous n'etes pas a l'origine de cette demande, ignorez ce message : votre compte n'a pas ete modifie.")
            ->salutation('A bientot, Le Manoir');
    }
}
