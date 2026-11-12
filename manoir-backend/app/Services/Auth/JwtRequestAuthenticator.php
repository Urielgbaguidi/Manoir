<?php

namespace App\Services\Auth;

use App\Models\AuthSession;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * Resolution de l'utilisateur pour le guard `jwt`.
 *
 * Le jeton d'acces est lu dans le cookie HttpOnly (navigateur) ou, a defaut,
 * dans l'en-tete Authorization (clients non navigateur). A chaque requete :
 * signature et claims verifies, puis session controlee en base, pour qu'une
 * revocation prenne effet immediatement.
 */
class JwtRequestAuthenticator
{
    public const ATTRIBUTE_SESSION = 'auth_session';

    /** 'cookie' ou 'bearer' : seul le mode cookie exige le jeton CSRF. */
    public const ATTRIBUTE_TRANSPORT = 'auth_transport';

    public function __construct(private readonly JwtService $jwt) {}

    public function __invoke(Request $request): ?User
    {
        [$token, $transport] = $this->extractToken($request);

        if ($token === null) {
            return null;
        }

        $claims = $this->jwt->decode($token, JwtService::TYPE_ACCESS);

        if ($claims === null) {
            return null;
        }

        $session = AuthSession::with('user')->find((string) $claims['sid']);

        if (! $session || ! $session->isActive() || (string) $session->user_id !== (string) $claims['sub']) {
            return null;
        }

        // Evite une ecriture par requete : la trace d'activite a la minute suffit.
        if ($session->last_used_at === null || $session->last_used_at->lessThan(now()->subMinute())) {
            $session->forceFill(['last_used_at' => now()])->saveQuietly();
        }

        $request->attributes->set(self::ATTRIBUTE_SESSION, $session);
        $request->attributes->set(self::ATTRIBUTE_TRANSPORT, $transport);

        return $session->user;
    }

    /**
     * @return array{0: string|null, 1: string|null}
     */
    private function extractToken(Request $request): array
    {
        $cookie = $request->cookie((string) config('jwt.cookies.access'));

        if (is_string($cookie) && $cookie !== '') {
            return [$cookie, 'cookie'];
        }

        $bearer = $request->bearerToken();

        if (is_string($bearer) && $bearer !== '') {
            return [$bearer, 'bearer'];
        }

        return [null, null];
    }

    public static function currentSession(Request $request): ?AuthSession
    {
        $session = $request->attributes->get(self::ATTRIBUTE_SESSION);

        return $session instanceof AuthSession ? $session : null;
    }
}
