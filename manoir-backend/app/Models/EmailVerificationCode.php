<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Hash;

class EmailVerificationCode extends Model
{
    /** Duree de validite d'un code. Court volontairement : c'est un secret a usage immediat. */
    public const DUREE_MINUTES = 15;

    /** Au-dela, le code est brule et il faut en redemander un. */
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
     * Cree un code pour l'utilisateur et renvoie sa version en clair.
     *
     * Le clair n'existe que le temps de l'envoi du mail : seul le hachage est
     * conserve. Redemander un code invalide le precedent.
     */
    public static function genererPour(User $user): string
    {
        // random_int est cryptographiquement sur, contrairement a rand().
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        self::updateOrCreate(
            ['user_id' => $user->id],
            [
                'code_hash' => Hash::make($code),
                'expires_at' => now()->addMinutes(self::DUREE_MINUTES),
                'attempts' => 0,
            ]
        );

        return $code;
    }

    public function estExpire(): bool
    {
        return $this->expires_at->isPast();
    }

    public function tropDeTentatives(): bool
    {
        return $this->attempts >= self::MAX_TENTATIVES;
    }

    public function correspond(string $code): bool
    {
        return Hash::check($code, $this->code_hash);
    }
}
