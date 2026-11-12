<?php

namespace App\Services\Auth;

use App\Models\AuthSession;

/**
 * Jetons emis pour une session. N'est jamais serialise dans une reponse JSON :
 * les jetons partent uniquement dans des cookies HttpOnly.
 */
final readonly class IssuedTokens
{
    public function __construct(
        public AuthSession $session,
        public string $accessToken,
        public string $refreshToken,
        public string $csrfToken,
    ) {}
}
