<?php

namespace Tests;

use App\Models\User;
use App\Services\Auth\AuthSessionManager;
use App\Services\Auth\IssuedTokens;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Str;

abstract class TestCase extends BaseTestCase
{
    /** Vrai quand le test a fixe l'utilisateur via actingAs()/be(). */
    private bool $userSetExplicitly = false;

    protected function setUp(): void
    {
        parent::setUp();

        // Les requetes JSON de test n'envoient les cookies qu'avec cette
        // option, comme fetch(..., { credentials: 'include' }).
        $this->withCredentials();
    }

    public function be($user, $guard = null)
    {
        $this->userSetExplicitly = true;

        return parent::be($user, $guard);
    }

    /**
     * En production chaque requete repart d'une application neuve. En test,
     * le guard garderait l'utilisateur resolu a la requete precedente : une
     * session revoquee entre deux appels paraitrait encore valide.
     */
    public function call($method, $uri, $parameters = [], $cookies = [], $files = [], $server = [], $content = null)
    {
        if (! $this->userSetExplicitly) {
            $this->app['auth']->forgetGuards();
        }

        return parent::call($method, $uri, $parameters, $cookies, $files, $server, $content);
    }

    /**
     * Ouvre une vraie session JWT et authentifie les requetes suivantes par
     * l'en-tete Authorization (client non navigateur : pas de CSRF).
     */
    protected function actingAsJwt(User $user): static
    {
        $tokens = $this->openSession($user);

        return $this->withHeader('Authorization', 'Bearer '.$tokens->accessToken);
    }

    /**
     * Authentifie comme un navigateur : jetons dans les cookies, jeton CSRF
     * dans l'en-tete.
     */
    protected function actingAsBrowser(User $user, bool $withCsrf = true): static
    {
        $tokens = $this->openSession($user);

        $this->withUnencryptedCookie((string) config('jwt.cookies.access'), $tokens->accessToken);

        return $withCsrf ? $this->withHeader('X-CSRF-Token', $tokens->csrfToken) : $this;
    }

    protected function openSession(User $user): IssuedTokens
    {
        return app(AuthSessionManager::class)->start($user, request());
    }

    /**
     * En-tete d'idempotence exige par les routes de creation et de paiement.
     */
    protected function withIdempotencyKey(?string $key = null): static
    {
        return $this->withHeader('Idempotency-Key', $key ?? (string) Str::uuid());
    }
}
