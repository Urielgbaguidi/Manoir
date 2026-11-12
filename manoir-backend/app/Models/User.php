<?php

namespace App\Models;

use App\Notifications\ResetPasswordNotification;
use App\Notifications\VerifyEmailCodeNotification;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Fillable(['name', 'email', 'phone', 'country', 'password'])]
#[Hidden([
    'password',
    'remember_token',
    'google_id',
    'two_factor_secret',
    'two_factor_recovery_codes',
    'two_factor_last_used_step',
])]
class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * Indicateurs utiles au frontend, calcules cote serveur.
     *
     * @var array<int, string>
     */
    protected $appends = ['has_password', 'two_factor_enabled', 'profile_completed'];

    /**
     * Un compte ne se supprime jamais (voir UserPolicy) : ce garde-fou bloque
     * aussi tout appel direct a delete(), d'ou qu'il vienne.
     */
    protected static function booted(): void
    {
        static::deleting(function (User $user): never {
            throw new \LogicException("La suppression d'un compte utilisateur est interdite.");
        });
    }

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
            'two_factor_secret' => 'encrypted',
            'two_factor_recovery_codes' => 'encrypted:array',
            'two_factor_confirmed_at' => 'datetime',
            'two_factor_last_used_step' => 'integer',
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

    public function authSessions(): HasMany
    {
        return $this->hasMany(AuthSession::class);
    }

    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class);
    }

    public function hasTwoFactorEnabled(): bool
    {
        return $this->two_factor_confirmed_at !== null && ! empty($this->two_factor_secret);
    }

    /**
     * Un super-administrateur possede toujours les droits d'un administrateur.
     */
    public function isAdmin(): bool
    {
        return (bool) ($this->is_admin || $this->is_super_admin);
    }

    /**
     * Un numero de telephone est obligatoire pour acceder a l'espace client :
     * c'est le moyen de joindre le client pendant son sejour. Les comptes
     * administrateur et super-administrateur en sont dispenses : leur role est
     * de gerer le back-office, pas d'accueillir un sejour.
     */
    public function hasCompletedProfile(): bool
    {
        return $this->isAdmin() || filled($this->phone);
    }

    protected function hasPassword(): Attribute
    {
        return Attribute::get(fn () => filled($this->attributes['password'] ?? null));
    }

    protected function twoFactorEnabled(): Attribute
    {
        return Attribute::get(fn () => $this->hasTwoFactorEnabled());
    }

    protected function profileCompleted(): Attribute
    {
        return Attribute::get(fn () => $this->hasCompletedProfile());
    }
}
