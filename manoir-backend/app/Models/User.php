<?php

namespace App\Models;

use App\Notifications\ResetPasswordNotification;
use App\Notifications\VerifyEmailCodeNotification;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'phone', 'country', 'password', 'is_admin', 'is_super_admin'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_admin' => 'boolean',
            'is_super_admin' => 'boolean',
        ];
    }

    /**
     * Mail de reinitialisation : lien vers le frontend, pas vers l'API.
     */
    public function sendPasswordResetNotification($token): void
    {
        $this->notify(new ResetPasswordNotification($token));
    }

    /**
     * Confirmation d'adresse par code a 6 chiffres, et non par lien.
     *
     * Le code en clair ne vit que le temps de l'envoi du mail : seul son
     * hachage est conserve en base.
     */
    public function sendEmailVerificationNotification(): void
    {
        $this->notify(new VerifyEmailCodeNotification(
            EmailVerificationCode::genererPour($this)
        ));
    }

    public function emailVerificationCode(): HasOne
    {
        return $this->hasOne(EmailVerificationCode::class);
    }
}
