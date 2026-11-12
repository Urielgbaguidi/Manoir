<?php

namespace App\Http\Middleware;

use App\Services\Auth\JwtRequestAuthenticator;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * En-tetes de securite HTTP de l'API.
 *
 * L'API ne sert que du JSON et des PDF : la CSP interdit tout chargement de
 * ressource et tout affichage dans un cadre. HSTS force HTTPS en production.
 * En dehors de la production, HTTP reste accepte pour le developpement local.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($this->mustUseHttps() && ! $request->isSecure()) {
            return response()->json(['message' => 'HTTPS obligatoire.'], 426);
        }

        $response = $next($request);

        $headers = $response->headers;
        $headers->set('X-Content-Type-Options', 'nosniff');
        $headers->set('X-Frame-Options', 'DENY');
        $headers->set('Referrer-Policy', 'no-referrer');
        $headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
        $headers->set('Cross-Origin-Opener-Policy', 'same-origin');

        if (! $headers->has('Content-Security-Policy')) {
            $headers->set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
        }

        if ($request->isSecure()) {
            $headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        // Les reponses authentifiees ne doivent jamais finir dans un cache partage.
        if (JwtRequestAuthenticator::currentSession($request) !== null) {
            $headers->set('Cache-Control', 'no-store, private');
        }

        $headers->remove('X-Powered-By');

        return $response;
    }

    private function mustUseHttps(): bool
    {
        return (bool) config('app.force_https', false);
    }
}
