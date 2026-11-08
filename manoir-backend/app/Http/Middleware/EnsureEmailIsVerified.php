<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Interdit les actions engageantes tant que l'adresse email n'est pas confirmee.
 *
 * Version API du middleware `verified` de Laravel, qui lui redirige vers une
 * page web inexistante ici. On repond en JSON, avec un code que le frontend
 * reconnait pour amener le client vers la saisie de son code.
 */
class EnsureEmailIsVerified
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Non authentifie.'], 401);
        }

        if (! $user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Confirmez votre adresse email avant de reserver. Un code a 6 chiffres vous a ete envoye.',
                'reason' => 'email_not_verified',
            ], 403);
        }

        return $next($request);
    }
}
