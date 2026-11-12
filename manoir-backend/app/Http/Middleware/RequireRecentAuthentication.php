<?php

namespace App\Http\Middleware;

use App\Services\Auth\JwtRequestAuthenticator;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Exige une authentification recente pour les actions sensibles.
 *
 * Un jeton vole ou un poste laisse ouvert ne doit pas suffire a changer le mot
 * de passe, l'adresse email, la double authentification ou a couper les
 * autres sessions : l'utilisateur doit d'abord confirmer son identite
 * (POST /api/auth/reauthenticate).
 */
class RequireRecentAuthentication
{
    public function handle(Request $request, Closure $next): Response
    {
        $session = JwtRequestAuthenticator::currentSession($request);

        if (! $session || ! $session->wasRecentlyReauthenticated()) {
            return response()->json([
                'message' => 'Confirmez votre identite pour effectuer cette action.',
                'reason' => 'reauthentication_required',
            ], 403);
        }

        return $next($request);
    }
}
