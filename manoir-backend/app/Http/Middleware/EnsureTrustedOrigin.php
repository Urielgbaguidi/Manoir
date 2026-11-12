<?php

namespace App\Http\Middleware;

use App\Services\Auth\SecurityLogger;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Refuse les requetes envoyees depuis une origine non approuvee.
 *
 * Complete la protection CSRF sur les routes qui s'appuient sur le seul cookie
 * de refresh (renouvellement, deconnexion) et ne peuvent donc pas exiger le
 * jeton CSRF. Un navigateur envoie toujours l'en-tete Origin sur un POST ;
 * son absence designe un client non navigateur, non concerne par le CSRF.
 */
class EnsureTrustedOrigin
{
    public function __construct(private readonly SecurityLogger $securityLogger) {}

    public function handle(Request $request, Closure $next): Response
    {
        $origin = $request->headers->get('Origin');

        if ($origin === null || $request->isMethodSafe() || $this->isAllowed($origin)) {
            return $next($request);
        }

        $this->securityLogger->warning('auth.untrusted_origin', ['origin' => mb_substr($origin, 0, 200)]);

        return response()->json(['message' => 'Origine non autorisee.'], 403);
    }

    private function isAllowed(string $origin): bool
    {
        if (in_array($origin, (array) config('cors.allowed_origins', []), true)) {
            return true;
        }

        foreach ((array) config('cors.allowed_origins_patterns', []) as $pattern) {
            if (@preg_match($pattern, $origin) === 1) {
                return true;
            }
        }

        return false;
    }
}
