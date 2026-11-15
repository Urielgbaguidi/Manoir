<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Jeton du lien de confirmation d'adresse e-mail (un seul actif par compte).
 *
 * Le jeton (256 bits aleatoires) n'existe en clair que dans le mail : seul
 * son empreinte SHA-256 est conservee (colonne `code_hash`). Redemander un
 * lien invalide le precedent.
 */
class EmailVerificationCode extends Model
{
    /** Duree de validite d'un lien. */
    public const DUREE_MINUTES = 60;

    /** Au-dela, le lien est brule et il faut en redemander un. */
    public const MAX_TENTATIVES = 5;

    protected $fillable = ['user_id', 'code_hash', 'expires_at', 'attempts'];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'attempts' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Cree un jeton pour l'utilisateur et renvoie sa version en clair.
     */
    public static function genererPour(User $user): string
    {
        $token = bin2hex(random_bytes(32));

        self::updateOrCreate(
            ['user_id' => $user->id],
            [
                'code_hash' => hash('sha256', $token),
                'expires_at' => now()->addMinutes(self::DUREE_MINUTES),
                'attempts' => 0,
            ]
        );

        return $token;
    }

    public function estExpire(): bool
    {
        return $this->expires_at->isPast();
    }

    public function tropDeTentatives(): bool
    {
        return $this->attempts >= self::MAX_TENTATIVES;
    }

    /** Comparaison a temps constant. */
    public function correspond(string $token): bool
    {
        return hash_equals($this->code_hash, hash('sha256', $token));
    }
}
