<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Bloque l'espace client tant que le numero de telephone n'est pas renseigne.
 *
 * Concerne surtout les comptes crees via Google, qui ne fournit pas de
 * numero : leur inscription n'est consideree comme confirmee qu'une fois le
 * telephone saisi. Les comptes administrateur et super-administrateur sont
 * exemptes (voir User::hasCompletedProfile).
 */
class EnsureProfileIsComplete
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && ! $user->hasCompletedProfile()) {
            return response()->json([
                'message' => 'Renseignez votre numero de telephone pour finaliser votre inscription.',
                'reason' => 'phone_required',
            ], 403);
        }

        return $next($request);
    }
}
