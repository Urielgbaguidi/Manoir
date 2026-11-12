<?php

namespace App\Services\Auth;

use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Verifie localement un jeton d'identite Google (Google Identity Services).
 *
 * Signature RS256 contre les cles publiques de Google, emetteur, audience
 * (notre identifiant client), expiration et email verifie. Aucune confiance
 * n'est accordee a ce que le navigateur affirme en dehors du jeton signe.
 */
class GoogleIdTokenVerifier
{
    private const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

    private const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

    /**
     * @return array{sub: string, email: string, name: string|null}|null
     */
    public function verify(string $credential): ?array
    {
        $clientId = (string) config('services.google.client_id');

        if ($clientId === '' || $credential === '' || strlen($credential) > 4096) {
            return null;
        }

        try {
            $keys = JWK::parseKeySet($this->jwks(), 'RS256');
        } catch (Throwable $exception) {
            Log::error('Impossible de charger les cles publiques Google.', [
                'reason' => $exception->getMessage(),
            ]);

            return null;
        }

        try {
            $claims = (array) JWT::decode($credential, $keys);
        } catch (Throwable) {
            return null;
        }

        if (! in_array($claims['iss'] ?? null, self::ISSUERS, true)) {
            return null;
        }

        if (($claims['aud'] ?? null) !== $clientId) {
            return null;
        }

        $emailVerified = $claims['email_verified'] ?? false;
        if (! ($emailVerified === true || $emailVerified === 'true')) {
            return null;
        }

        if (empty($claims['sub']) || empty($claims['email'])) {
            return null;
        }

        return [
            'sub' => (string) $claims['sub'],
            'email' => strtolower((string) $claims['email']),
            'name' => isset($claims['name']) ? (string) $claims['name'] : null,
        ];
    }

    /**
     * Cles publiques de Google, mises en cache une heure (Google les fait
     * tourner regulierement mais publie les nouvelles a l'avance).
     *
     * @return array<string, mixed>
     */
    private function jwks(): array
    {
        return Cache::remember('google-oauth-jwks', 3600, function () {
            return Http::timeout(5)->get(self::JWKS_URL)->throw()->json();
        });
    }
}
