<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * Session d'authentification d'un appareil.
 *
 * @property string $id
 * @property int $user_id
 * @property Carbon|null $revoked_at
 * @property Carbon $expires_at
 * @property Carbon|null $reauthenticated_at
 */
class AuthSession extends Model
{
    use HasUuids;

    protected $fillable = [
        'user_id',
        'device_name',
        'ip_address',
        'user_agent',
        'last_used_at',
        'reauthenticated_at',
        'expires_at',
        'revoked_at',
        'revoked_reason',
    ];

    protected $hidden = ['user_agent'];

    protected function casts(): array
    {
        return [
            'last_used_at' => 'datetime',
            'reauthenticated_at' => 'datetime',
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function refreshTokens(): HasMany
    {
        return $this->hasMany(RefreshToken::class);
    }

    /**
     * @param  Builder<AuthSession>  $query
     */
    public function scopeActive(Builder $query): void
    {
        $query->whereNull('revoked_at')->where('expires_at', '>', now());
    }

    public function isActive(): bool
    {
        return $this->revoked_at === null && $this->expires_at->isFuture();
    }

    public function revoke(string $reason): void
    {
        if ($this->revoked_at !== null) {
            return;
        }

        $this->forceFill([
            'revoked_at' => now(),
            'revoked_reason' => $reason,
        ])->save();
    }

    public function wasRecentlyReauthenticated(): bool
    {
        return $this->reauthenticated_at !== null
            && $this->reauthenticated_at->greaterThan(now()->subMinutes((int) config('jwt.reauth_ttl_minutes', 10)));
    }
}
