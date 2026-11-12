<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Empreinte d'un refresh token. Le jeton en clair n'est jamais stocke.
 */
class RefreshToken extends Model
{
    protected $fillable = ['auth_session_id', 'token_hash', 'expires_at', 'used_at'];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'used_at' => 'datetime',
        ];
    }

    public function authSession(): BelongsTo
    {
        return $this->belongsTo(AuthSession::class);
    }

    public static function hash(string $plainToken): string
    {
        return hash('sha256', $plainToken);
    }
}
