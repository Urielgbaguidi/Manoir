<?php

namespace Tests\Feature;

use App\Models\AuthSession;
use App\Models\User;
use Firebase\JWT\JWT;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Jetons expires, invalides, falsifies, revoques, rejeu et CSRF.
 */
class JwtSecurityTest extends TestCase
{
    use RefreshDatabase;

    private function secret(): string
    {
        return (string) base64_decode(substr((string) config('jwt.secret'), 7));
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function forge(AuthSession $session, array $overrides = [], ?string $key = null, string $alg = 'HS256'): string
    {
        $now = time();

        return JWT::encode(array_merge([
            'iss' => config('jwt.issuer'),
            'aud' => config('jwt.audience'),
            'sub' => (string) $session->user_id,
            'sid' => $session->id,
            'typ' => 'access',
            'iat' => $now,
            'nbf' => $now,
            'exp' => $now + 300,
            'jti' => (string) Str::uuid(),
        ], $overrides), $key ?? $this->secret(), $alg);
    }

    private function getUser(string $token): TestResponse
    {
        return $this->withHeader('Authorization', 'Bearer '.$token)->getJson('/api/user');
    }

    public function test_un_jeton_valide_donne_acces(): void
    {
        $user = User::factory()->create();
        $tokens = $this->openSession($user);

        $this->getUser($tokens->accessToken)->assertOk()->assertJsonPath('id', $user->id);
    }

    public function test_sans_jeton_l_acces_est_refuse(): void
    {
        $this->getJson('/api/user')->assertUnauthorized();
        $this->getJson('/api/reservations')->assertUnauthorized();
        $this->getJson('/api/admin/users')->assertUnauthorized();
    }

    public function test_un_jeton_expire_est_refuse(): void
    {
        $session = $this->openSession(User::factory()->create())->session;

        $this->getUser($this->forge($session, ['exp' => time() - 120, 'iat' => time() - 900, 'nbf' => time() - 900]))
            ->assertUnauthorized();
    }

    public function test_un_jeton_signe_avec_une_autre_cle_est_refuse(): void
    {
        $session = $this->openSession(User::factory()->create())->session;

        $this->getUser($this->forge($session, [], str_repeat('k', 64)))->assertUnauthorized();
    }

    public function test_un_jeton_modifie_est_refuse(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->admin()->create();
        $token = $this->openSession($user)->accessToken;

        // Charge utile remplacee (sub d'un admin), signature d'origine conservee.
        [$header, $payload, $signature] = explode('.', $token);
        $claims = json_decode(JWT::urlsafeB64Decode($payload), true);
        $claims['sub'] = (string) $other->id;
        $tampered = $header.'.'.JWT::urlsafeB64Encode(json_encode($claims)).'.'.$signature;

        $this->getUser($tampered)->assertUnauthorized();
    }

    public function test_l_algorithme_none_est_refuse(): void
    {
        $session = $this->openSession(User::factory()->create())->session;
        $header = JWT::urlsafeB64Encode(json_encode(['alg' => 'none', 'typ' => 'JWT']));
        $payload = JWT::urlsafeB64Encode(json_encode([
            'iss' => config('jwt.issuer'), 'aud' => config('jwt.audience'), 'sub' => (string) $session->user_id,
            'sid' => $session->id, 'typ' => 'access', 'iat' => time(), 'exp' => time() + 300,
        ]));

        $this->getUser($header.'.'.$payload.'.')->assertUnauthorized();
    }

    public function test_un_autre_algorithme_hmac_est_refuse(): void
    {
        $session = $this->openSession(User::factory()->create())->session;

        $this->getUser($this->forge($session, [], $this->secret().$this->secret(), 'HS512'))->assertUnauthorized();
    }

    public function test_un_mauvais_emetteur_ou_une_mauvaise_audience_sont_refuses(): void
    {
        $session = $this->openSession(User::factory()->create())->session;

        $this->getUser($this->forge($session, ['iss' => 'https://pirate.example']))->assertUnauthorized();
        $this->getUser($this->forge($session, ['aud' => 'https://pirate.example']))->assertUnauthorized();
        $this->getUser($this->forge($session, ['typ' => '2fa_challenge']))->assertUnauthorized();
    }

    public function test_un_jeton_d_une_session_revoquee_est_refuse_immediatement(): void
    {
        $tokens = $this->openSession(User::factory()->create());
        $tokens->session->revoke('test');

        $this->getUser($tokens->accessToken)->assertUnauthorized();
    }

    public function test_le_refresh_fait_tourner_le_jeton_et_invalide_l_ancien(): void
    {
        $tokens = $this->openSession(User::factory()->create());
        $refreshCookie = (string) config('jwt.cookies.refresh');

        $response = $this->withUnencryptedCookie($refreshCookie, $tokens->refreshToken)
            ->postJson('/api/auth/refresh')
            ->assertOk()
            ->assertJsonStructure(['user', 'csrf_token']);

        $nouveau = $response->getCookie($refreshCookie, false)->getValue();
        $this->assertNotSame($tokens->refreshToken, $nouveau);

        // Seule l'empreinte est stockee.
        $this->assertDatabaseMissing('refresh_tokens', ['token_hash' => $nouveau]);
        $this->assertDatabaseHas('refresh_tokens', ['token_hash' => hash('sha256', $nouveau)]);
    }

    public function test_le_rejeu_d_un_ancien_refresh_token_revoque_toute_la_session(): void
    {
        $tokens = $this->openSession(User::factory()->create());
        $refreshCookie = (string) config('jwt.cookies.refresh');

        $nouveau = $this->withUnencryptedCookie($refreshCookie, $tokens->refreshToken)
            ->postJson('/api/auth/refresh')
            ->getCookie($refreshCookie, false)->getValue();

        $this->travel(30)->seconds();

        $this->withUnencryptedCookie($refreshCookie, $tokens->refreshToken)
            ->postJson('/api/auth/refresh')
            ->assertUnauthorized();

        $this->assertNotNull($tokens->session->fresh()->revoked_at);
        $this->assertSame('refresh_token_replay', $tokens->session->fresh()->revoked_reason);

        // Le jeton legitime le plus recent ne fonctionne plus non plus.
        $this->withUnencryptedCookie($refreshCookie, $nouveau)
            ->postJson('/api/auth/refresh')
            ->assertUnauthorized();
    }

    public function test_deux_rafraichissements_simultanes_ne_sont_pas_pris_pour_un_vol(): void
    {
        $tokens = $this->openSession(User::factory()->create());
        $refreshCookie = (string) config('jwt.cookies.refresh');

        $this->withUnencryptedCookie($refreshCookie, $tokens->refreshToken)->postJson('/api/auth/refresh')->assertOk();
        $this->withUnencryptedCookie($refreshCookie, $tokens->refreshToken)
            ->postJson('/api/auth/refresh')
            ->assertStatus(409)
            ->assertJsonPath('reason', 'refresh_in_progress');

        $this->assertNull($tokens->session->fresh()->revoked_at);
    }

    public function test_un_refresh_token_expire_est_refuse(): void
    {
        $tokens = $this->openSession(User::factory()->create());

        $this->travel((int) config('jwt.refresh_ttl_days') + 1)->days();

        $this->withUnencryptedCookie((string) config('jwt.cookies.refresh'), $tokens->refreshToken)
            ->postJson('/api/auth/refresh')
            ->assertUnauthorized();
    }

    public function test_un_refresh_token_inconnu_est_refuse(): void
    {
        $this->withUnencryptedCookie((string) config('jwt.cookies.refresh'), Str::random(80))
            ->postJson('/api/auth/refresh')
            ->assertUnauthorized();
    }

    public function test_le_refresh_depuis_une_origine_non_approuvee_est_refuse(): void
    {
        $tokens = $this->openSession(User::factory()->create());

        $this->withUnencryptedCookie((string) config('jwt.cookies.refresh'), $tokens->refreshToken)
            ->withHeader('Origin', 'https://pirate.example')
            ->postJson('/api/auth/refresh')
            ->assertForbidden();
    }

    public function test_la_deconnexion_revoque_la_session_et_efface_les_cookies(): void
    {
        $tokens = $this->openSession(User::factory()->create());

        $response = $this->withHeader('Authorization', 'Bearer '.$tokens->accessToken)
            ->postJson('/api/auth/logout')
            ->assertOk();

        $this->assertTrue($response->getCookie((string) config('jwt.cookies.access'), false)->isCleared());
        $this->assertNotNull($tokens->session->fresh()->revoked_at);
        $this->getUser($tokens->accessToken)->assertUnauthorized();
    }

    public function test_une_requete_par_cookie_sans_jeton_csrf_est_refusee(): void
    {
        $user = User::factory()->create();

        $this->actingAsBrowser($user, withCsrf: false)
            ->putJson('/api/user/profile', ['name' => 'Nouveau Nom'])
            ->assertStatus(419)
            ->assertJsonPath('reason', 'csrf_token_mismatch');

        $this->assertNotSame('Nouveau Nom', $user->fresh()->name);
    }

    public function test_une_requete_par_cookie_avec_un_faux_jeton_csrf_est_refusee(): void
    {
        $user = User::factory()->create();

        $this->actingAsBrowser($user, withCsrf: false)
            ->withHeader('X-CSRF-Token', str_repeat('a', 64))
            ->putJson('/api/user/profile', ['name' => 'Nouveau Nom'])
            ->assertStatus(419);
    }

    public function test_une_requete_par_cookie_avec_le_jeton_csrf_passe(): void
    {
        $user = User::factory()->create();

        $this->actingAsBrowser($user)
            ->putJson('/api/user/profile', ['name' => 'Nouveau Nom'])
            ->assertOk();

        $this->assertSame('Nouveau Nom', $user->fresh()->name);
    }

    public function test_les_reponses_portent_les_en_tetes_de_securite(): void
    {
        $this->getJson('/api/rooms')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeader('X-Frame-Options', 'DENY')
            ->assertHeader('Content-Security-Policy');
    }

    public function test_en_production_le_http_en_clair_est_refuse(): void
    {
        config(['app.force_https' => true]);

        $this->getJson('/api/rooms')->assertStatus(426);
    }
}
