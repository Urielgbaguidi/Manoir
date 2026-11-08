<?php

namespace App\Http\Middleware;

use App\Services\CalendarSyncService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Maintient les disponibilites a jour au fil des visites.
 *
 * Pose sur les routes publiques qui exposent une disponibilite. La
 * resynchronisation ne part qu'apres l'envoi de la reponse : le visiteur
 * n'attend rien, et le suivant voit des donnees fraiches.
 */
class RefreshCalendarIfStale
{
    public function __construct(private CalendarSyncService $sync) {}

    public function handle(Request $request, Closure $next): Response
    {
        // Programme avant de traiter la requete : la reponse part d'abord,
        // le travail differe s'execute ensuite.
        $this->sync->synchroniserSiObsolete();

        return $next($request);
    }
}
