<?php

namespace App\Notifications;

use App\Models\EmailVerificationCode;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Mail contenant le code de confirmation a 6 chiffres.
 *
 * Volontairement sans lien cliquable : le code se recopie a la main, ce qui
 * evite les liens tronques par les messageries et fonctionne meme si le client
 * ouvre ses mails sur un autre appareil que celui ou il s'est inscrit.
 */
class VerifyEmailCodeNotification extends Notification
{
    use Queueable;

    public function __construct(private string $code) {}

    /**
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $minutes = EmailVerificationCode::DUREE_MINUTES;

        return (new MailMessage)
            ->subject('Votre code de confirmation - Le Manoir')
            ->greeting('Bienvenue '.$notifiable->name.',')
            ->line('Voici votre code de confirmation :')
            ->line('**'.$this->code.'**')
            ->line("Saisissez-le sur le site pour confirmer votre adresse. Il expire dans {$minutes} minutes.")
            ->line("Si vous n'avez pas cree de compte au Manoir, ignorez ce message.")
            ->salutation('A bientot, Le Manoir');
    }
}
