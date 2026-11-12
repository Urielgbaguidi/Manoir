<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\VerifyEmailCodeNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class LoginTest extends TestCase
{
    use RefreshDatabase;

    public function test_une_connexion_valide_ouvre_une_session_sans_jeton_dans_le_corps(): void
    {
        $user = User::factory()->create(['email' => 'client@manoir.test']);

        $this->postJson('/api/auth/login', ['email' => 'CLIENT@manoir.test ', 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonMissingPath('token')
            ->assertJsonMissingPath('access_token')
            ->assertCookie((string) config('jwt.cookies.access'), null, false);

        $this->assertDatabaseHas('auth_sessions', ['user_id' => $user->id, 'revoked_at' => null]);
    }

    public function test_le_message_d_erreur_ne_revele_pas_si_le_compte_existe(): void
    {
        User::factory()->create(['email' => 'client@manoir.test']);

        $mauvaisMotDePasse = $this->postJson('/api/auth/login', ['email' => 'client@manoir.test', 'password' => 'faux12345']);
        $compteInconnu = $this->postJson('/api/auth/login', ['email' => 'inconnu@manoir.test', 'password' => 'faux12345']);

        $mauvaisMotDePasse->assertStatus(401);
        $compteInconnu->assertStatus(401)->assertJsonPath('message', $mauvaisMotDePasse->json('message'));
    }

    public function test_un_compte_non_verifie_est_renvoye_vers_la_saisie_du_code(): void
    {
        Notification::fake();
        $user = User::factory()->unverified()->create(['email' => 'client@manoir.test']);

        $this->postJson('/api/auth/login', ['email' => 'client@manoir.test', 'password' => 'password'])
            ->assertStatus(403)
            ->assertJsonPath('reason', 'email_not_verified')
            ->assertCookieMissing((string) config('jwt.cookies.access'));

        Notification::assertSentTo($user, VerifyEmailCodeNotification::class);
        $this->assertDatabaseCount('auth_sessions', 0);
    }

    public function test_un_compte_google_sans_mot_de_passe_ne_peut_pas_se_connecter_par_mot_de_passe(): void
    {
        User::factory()->fromGoogle()->create(['email' => 'google@manoir.test']);

        $this->postJson('/api/auth/login', ['email' => 'google@manoir.test', 'password' => 'nimportequoi'])
            ->assertStatus(401);
    }

    public function test_le_compte_est_bloque_temporairement_apres_des_echecs_repetes(): void
    {
        User::factory()->create(['email' => 'client@manoir.test']);

        // Contourne le limiteur par minute (6/min) pour atteindre le verrou par compte.
        $this->withoutMiddleware(ThrottleRequests::class);

        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/login', ['email' => 'client@manoir.test', 'password' => 'mauvais'.$i])
                ->assertStatus(401);
        }

        // Meme le bon mot de passe est refuse pendant le blocage.
        $this->postJson('/api/auth/login', ['email' => 'client@manoir.test', 'password' => 'password'])
            ->assertStatus(429)
            ->assertHeader('Retry-After');
    }

    public function test_la_connexion_est_limitee_par_minute(): void
    {
        for ($i = 0; $i < 6; $i++) {
            $this->postJson('/api/auth/login', ['email' => 'x@manoir.test', 'password' => 'mauvais']);
        }

        $this->postJson('/api/auth/login', ['email' => 'x@manoir.test', 'password' => 'mauvais'])
            ->assertStatus(429);
    }

    public function test_l_inscription_est_limitee(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/register', []);
        }

        $this->postJson('/api/auth/register', [])->assertStatus(429);
    }

    public function test_la_reinitialisation_du_mot_de_passe_est_limitee(): void
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/auth/forgot-password', ['email' => 'x@manoir.test']);
        }

        $this->postJson('/api/auth/forgot-password', ['email' => 'x@manoir.test'])->assertStatus(429);
    }
}
