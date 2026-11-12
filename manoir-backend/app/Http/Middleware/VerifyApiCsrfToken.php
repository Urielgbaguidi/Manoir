<?php

namespace App\Http\Middleware;

use App\Services\Auth\AuthSessionManager;
use App\Services\Auth\JwtRequestAuthenticator;
use App\Services\Auth\SecurityLogger;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Protection CSRF des requetes authentifiees par cookie.
 *
 * Un cookie part tout seul avec la requete : un site tiers pourrait donc agir
 * au nom de l'utilisateur. Toute requete qui modifie des donnees doit en plus
 * porter l'en-tete X-CSRF-Token, qu'un site tiers ne peut ni lire ni forger
 * (CORS strict). Les requetes authentifiees par en-tete Authorization n'y sont
 * pas exposees et en sont dispensees.
 */
class VerifyApiCsrfToken
{
    public function __construct(
        private readonly AuthSessionManager $sessions,
        private readonly SecurityLogger $securityLogger,
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        if ($request->isMethodSafe()) {
            return $next($request);
        }

        $session = JwtRequestAuthenticator::currentSession($request);
        $transport = $request->attributes->get(JwtRequestAuthenticator::ATTRIBUTE_TRANSPORT);

        if (! $session || $transport !== 'cookie') {
            return $next($request);
        }

        $provided = (string) $request->header('X-CSRF-Token', '');

        if ($provided === '' || ! hash_equals($this->sessions->csrfTokenFor($session), $provided)) {
            $this->securityLogger->warning('auth.csrf_rejected', ['user_id' => $session->user_id]);

            return response()->json([
                'message' => 'Requete refusee. Rechargez la page et reessayez.',
                'reason' => 'csrf_token_mismatch',
            ], 419);
        }

        return $next($request);
    }
}
