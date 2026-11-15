<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Espace d'administration.
 *
 * Un non-administrateur recoit un 404, comme pour une page qui n'existe pas :
 * la reponse ne revele pas qu'un espace d'administration se trouve ici.
 */
class AdminMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->isAdmin()) {
            return response()->json(['message' => 'Page introuvable.'], 404);
        }

        return $next($request);
    }
}
