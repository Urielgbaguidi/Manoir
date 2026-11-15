<?php

namespace App\Notifications;

use App\Mail\VerifyEmailMail;
use App\Models\EmailVerificationCode;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

/**
 * Mail contenant le lien de confirmation d'adresse.
 *
 * Le lien mene a la page de confirmation du site, qui transmet le jeton a
 * l'API. Le jeton en clair n'existe que dans ce mail : seul son hachage est
 * conserve en base.
 */
class VerifyEmailLinkNotification extends Notification
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

    public function toMail(object $notifiable): VerifyEmailMail
    {
        return (new VerifyEmailMail(
            name: (string) $notifiable->name,
            url: $this->url($notifiable->email),
            minutes: EmailVerificationCode::DUREE_MINUTES,
        ))->to($notifiable->email);
    }

    private function url(string $email): string
    {
        return rtrim((string) config('app.frontend_url'), '/').'/auth/confirmer-email?'.http_build_query([
            'email' => $email,
            'token' => $this->token,
        ]);
    }
}
