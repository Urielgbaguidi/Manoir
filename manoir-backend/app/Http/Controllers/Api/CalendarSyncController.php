<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CalendarSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Permet a un service de cron externe (cron-job.org, GitHub Actions...) de
 * declencher la synchronisation des agendas.
 *
 * L'hebergement gratuit de Render ne propose pas de taches planifiees et
 * endort le service apres quinze minutes : un appel regulier de l'exterieur
 * remplit les deux roles, il synchronise et il reveille.
 */
class CalendarSyncController extends Controller
{
    public function trigger(Request $request, CalendarSyncService $sync): JsonResponse
    {
        $attendu = config('calendar_sync.trigger_token');

        // Sans jeton configure, la route ne doit pas exister du tout : mieux
        // vaut un 404 qu'un endpoint ouvert qui martyrise l'API Google.
        if (! $attendu) {
            throw new NotFoundHttpException;
        }

        $fourni = (string) $request->header('X-Calendar-Sync-Token', '');

        // hash_equals compare en temps constant : une comparaison classique
        // laisserait deviner le jeton caractere par caractere.
        if (! hash_equals($attendu, $fourni)) {
            return response()->json(['message' => 'Jeton invalide.'], 403);
        }

        $rapport = $sync->synchroniser();

        return response()->json([
            'created' => $rapport['crees'],
            'updated' => $rapport['majs'],
            'deleted' => $rapport['supprimes'],
            'errors' => $rapport['erreurs'],
        ], $rapport['erreurs'] === [] ? 200 : 207);
    }
}
