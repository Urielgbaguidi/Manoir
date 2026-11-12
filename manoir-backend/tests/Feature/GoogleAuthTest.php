<?php

namespace Tests\Feature;

use App\Models\User;
use Firebase\JWT\JWT;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Connexion Google : jeton d'identite verifie localement, puis telephone
 * obligatoire avant tout acces a l'espace client.
 */
class GoogleAuthTest extends TestCase
{
    use RefreshDatabase;

    private string $privateKey;

    protected function setUp(): void
    {
        parent::setUp();

        // Cle RSA de test (sans valeur hors des tests) qui joue le role de
        // Google : elle signe les jetons, sa partie publique est servie
        // comme JWKS factice.
        $this->privateKey = (string) file_get_contents(base_path('tests/Fixtures/google-test-private-key.pem'));
        $details = openssl_pkey_get_details(openssl_pkey_get_private($this->privateKey));

        Http::preventStrayRequests();
        Http::fake([
            'https://www.googleapis.com/oauth2/v3/certs' => Http::response(['keys' => [[
                'kty' => 'RSA',
                'alg' => 'RS256',
                'use' => 'sig',
                'kid' => 'test-key',
                'n' => JWT::urlsafeB64Encode($details['rsa']['n']),
                'e' => JWT::urlsafeB64Encode($details['rsa']['e']),
            ]]]),
        ]);
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function credential(array $overrides = []): string
    {
        return JWT::encode(array_merge([
            'iss' => 'https://accounts.google.com',
            'aud' => config('services.google.client_id'),
            'sub' => '109876543210',
            'email' => 'awa@gmail.com',
            'email_verified' => true,
            'name' => 'Awa Kone',
            'iat' => time(),
            'exp' => time() + 600,
        ], $overrides), $this->privateKey, 'RS256', 'test-key');
    }

    public function test_un_nouveau_compte_google_est_cree_verifie_et_sans_telephone(): void
    {
        $this->postJson('/api/auth/google', ['credential' => $this->credential()])
            ->assertOk()
            ->assertJsonPath('user.email', 'awa@gmail.com')
            ->assertJsonPath('user.profile_completed', false)
            ->assertCookie((string) config('jwt.cookies.access'), null, false);

        $user = User::where('email', 'awa@gmail.com')->firstOrFail();
        $this->assertNotNull($user->email_verified_at);
        $this->assertSame('109876543210', $user->google_id);
        $this->assertNull($user->phone);
    }

    public function test_sans_telephone_l_espace_client_reste_bloque(): void
    {
        $user = User::factory()->fromGoogle()->create();

        $this->actingAsJwt($user)
            ->getJson('/api/reservations')
            ->assertForbidden()
            ->assertJsonPath('reason', 'phone_required');

        // La session et la saisie du telephone restent accessibles.
        $this->actingAsJwt($user)->getJson('/api/auth/session')->assertOk();
    }

    public function test_le_telephone_saisi_debloque_l_espace_client(): void
    {
        $user = User::factory()->fromGoogle()->create();

        $this->actingAsJwt($user)
            ->postJson('/api/user/phone', ['phone' => '+229 01 97 00 00 00', 'country' => 'bj'])
            ->assertOk()
            ->assertJsonPath('user.profile_completed', true);

        $this->assertSame('+2290197000000', $user->fresh()->phone);
        $this->actingAsJwt($user)->getJson('/api/reservations')->assertOk();
    }

    public function test_un_telephone_invalide_est_refuse(): void
    {
        $user = User::factory()->fromGoogle()->create();

        $this->actingAsJwt($user)
            ->postJson('/api/user/phone', ['phone' => 'abc', 'country' => 'BJ'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('phone');
    }

    public function test_un_jeton_pour_une_autre_application_est_refuse(): void
    {
        $this->postJson('/api/auth/google', ['credential' => $this->credential(['aud' => 'autre-app.apps.googleusercontent.com'])])
            ->assertUnauthorized();

        $this->assertDatabaseCount('users', 0);
    }

    public function test_un_email_non_verifie_par_google_est_refuse(): void
    {
        $this->postJson('/api/auth/google', ['credential' => $this->credential(['email_verified' => false])])
            ->assertUnauthorized();
    }

    public function test_un_jeton_expire_ou_mal_emis_est_refuse(): void
    {
        $this->postJson('/api/auth/google', ['credential' => $this->credential(['exp' => time() - 3600, 'iat' => time() - 7200])])
            ->assertUnauthorized();
        $this->postJson('/api/auth/google', ['credential' => $this->credential(['iss' => 'https://pirate.example'])])
            ->assertUnauthorized();
    }

    public function test_un_compte_non_confirme_cree_avec_l_adresse_perd_le_mot_de_passe_d_un_tiers(): void
    {
        $preouvert = User::factory()->unverified()->create(['email' => 'awa@gmail.com']);

        $this->postJson('/api/auth/google', ['credential' => $this->credential()])->assertOk();

        $preouvert->refresh();
        $this->assertNull($preouvert->getAuthPassword());
        $this->assertNotNull($preouvert->email_verified_at);
        $this->assertSame('109876543210', $preouvert->google_id);
    }
}
