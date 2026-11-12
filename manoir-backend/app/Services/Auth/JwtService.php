<?php

namespace App\Services\Auth;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

/**
 * Emission et validation stricte des jetons d'acces (JWT HS256).
 *
 * Validation : signature, algorithme fige (HS256, `none` refuse), `exp`,
 * `nbf`, `iat`, `iss`, `aud`, type de jeton et presence de `sub`/`sid`.
 */
class JwtService
{
    public const TYPE_ACCESS = 'access';

    public const TYPE_TWO_FACTOR = '2fa_challenge';

    /** Tolerance d'horloge entre serveurs, en secondes. */
    private const LEEWAY_SECONDS = 30;

    public function issueAccessToken(int $userId, string $sessionId): string
    {
        $now = time();

        return JWT::encode([
            'iss' => config('jwt.issuer'),
            'aud' => config('jwt.audience'),
            'sub' => (string) $userId,
            'sid' => $sessionId,
            'typ' => self::TYPE_ACCESS,
            'iat' => $now,
            'nbf' => $now,
            'exp' => $now + ((int) config('jwt.access_ttl_minutes')) * 60,
            'jti' => (string) Str::uuid(),
        ], $this->secret(), (string) config('jwt.algorithm'));
    }

    /**
     * Jeton intermediaire remis apres un mot de passe correct quand la double
     * authentification est active. Il ne donne acces a rien d'autre qu'a la
     * saisie du code.
     */
    public function issueTwoFactorChallenge(int $userId): string
    {
        $now = time();

        return JWT::encode([
            'iss' => config('jwt.issuer'),
            'aud' => config('jwt.audience'),
            'sub' => (string) $userId,
            'typ' => self::TYPE_TWO_FACTOR,
            'iat' => $now,
            'nbf' => $now,
            'exp' => $now + ((int) config('jwt.two_factor_challenge_ttl_minutes')) * 60,
            'jti' => (string) Str::uuid(),
        ], $this->secret(), (string) config('jwt.algorithm'));
    }

    /**
     * Decode et valide un jeton. Renvoie null pour tout jeton invalide,
     * expire, falsifie ou d'un autre type que celui attendu.
     *
     * @return array<string, mixed>|null
     */
    public function decode(string $token, string $expectedType): ?array
    {
        if ($token === '' || substr_count($token, '.') !== 2) {
            return null;
        }

        try {
            $previousLeeway = JWT::$leeway;
            JWT::$leeway = self::LEEWAY_SECONDS;

            // La cle impose l'algorithme : un en-tete annoncant `none` ou un
            // autre algorithme (confusion RS256/HS256) est rejete.
            $claims = (array) JWT::decode($token, new Key($this->secret(), (string) config('jwt.algorithm')));
        } catch (Throwable) {
            return null;
        } finally {
            JWT::$leeway = $previousLeeway ?? 0;
        }

        if (($claims['iss'] ?? null) !== config('jwt.issuer')) {
            return null;
        }

        $audience = $claims['aud'] ?? null;
        $audiences = is_array($audience) ? $audience : [$audience];
        if (! in_array(config('jwt.audience'), $audiences, true)) {
            return null;
        }

        if (($claims['typ'] ?? null) !== $expectedType || empty($claims['sub']) || ! isset($claims['exp'])) {
            return null;
        }

        if ($expectedType === self::TYPE_ACCESS && empty($claims['sid'])) {
            return null;
        }

        return $claims;
    }

    private function secret(): string
    {
        $secret = (string) config('jwt.secret');

        if (str_starts_with($secret, 'base64:')) {
            $secret = (string) base64_decode(substr($secret, 7), true);
        }

        if (strlen($secret) < 32) {
            throw new RuntimeException('JWT_SECRET absent ou trop court (32 octets minimum).');
        }

        return $secret;
    }
}
