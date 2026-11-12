<?php

namespace Tests\Feature;

use App\Models\AuthSession;
use App\Models\User;
use App\Services\Auth\TotpService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Double authentification, sessions par appareil et reauthentification.
 */
class AccountSecurityTest extends TestCase
{
    use RefreshDatabase;

    private function currentCode(string $secret, int $offsetSteps = 0): string
    {
        $totp = app(TotpService::class);

        return $totp->codeAt($totp->base32Decode($secret), intdiv(time(), 30) + $offsetSteps);
    }

    private function enableTwoFactor(User $user): string
    {
        $totp = app(TotpService::class);
        $secret = $totp->generateSecret();
        $user->forceFill([
            'two_factor_secret' => $secret,
            'two_factor_confirmed_at' => now(),
            'two_factor_recovery_codes' => [hash('sha256', 'AAAA1111-BBBB2222')],
        ])->save();

        return $secret;
    }

    public function test_l_activation_de_la_2fa_exige_une_reauthentification(): void
    {
        $user = User::factory()->create();
        $tokens = $this->openSession($user);
        $tokens->session->forceFill(['reauthenticated_at' => now()->subHour()])->save();

        $this->withHeader('Authorization', 'Bearer '.$tokens->accessToken)
            ->postJson('/api/auth/two-factor/setup')
            ->assertForbidden()
            ->assertJsonPath('reason', 'reauthentication_required');

        $this->withHeader('Authorization', 'Bearer '.$tokens->accessToken)
            ->postJson('/api/auth/reauthenticate', ['password' => 'password'])
            ->assertOk();

        $this->withHeader('Authorization', 'Bearer '.$tokens->accessToken)
            ->postJson('/api/auth/two-factor/setup')
            ->assertOk()
            ->assertJsonStructure(['secret', 'otpauth_url']);
    }

    public function test_une_reauthentification_avec_un_mauvais_mot_de_passe_echoue(): void
    {
        $user = User::factory()->create();
        $tokens = $this->openSession($user);
        $tokens->session->forceFill(['reauthenticated_at' => null])->save();

        $this->withHeader('Authorization', 'Bearer '.$tokens->accessToken)
            ->postJson('/api/auth/reauthenticate', ['password' => 'mauvais'])
            ->assertStatus(422);

        $this->assertNull($tokens->session->fresh()->reauthenticated_at);
    }

    public function test_la_2fa_s_active_avec_un_code_valide_et_renvoie_des_codes_de_secours(): void
    {
        $user = User::factory()->create();
        $this->actingAsJwt($user);

        $secret = $this->postJson('/api/auth/two-factor/setup')->json('secret');

        $this->postJson('/api/auth/two-factor/confirm', ['code' => $this->currentCode($secret)])
            ->assertOk()
            ->assertJsonCount(8, 'recovery_codes');

        $this->assertTrue($user->fresh()->hasTwoFactorEnabled());
        // Secret chiffre au repos.
        $this->assertDatabaseMissing('users', ['id' => $user->id, 'two_factor_secret' => $secret]);
    }

    public function test_avec_la_2fa_le_mot_de_passe_seul_n_ouvre_pas_de_session(): void
    {
        $user = User::factory()->create(['email' => 'admin@manoir.test']);
        $secret = $this->enableTwoFactor($user);

        $challenge = $this->postJson('/api/auth/login', ['email' => 'admin@manoir.test', 'password' => 'password'])
            ->assertOk()
            ->assertJsonPath('two_factor_required', true)
            ->assertCookieMissing((string) config('jwt.cookies.access'))
            ->json('challenge_token');

        $this->assertDatabaseCount('auth_sessions', 0);

        $this->postJson('/api/auth/two-factor/challenge', ['challenge_token' => $challenge, 'code' => $this->currentCode($secret)])
            ->assertOk()
            ->assertCookie((string) config('jwt.cookies.access'), null, false);
    }

    public function test_un_code_2fa_ne_peut_pas_etre_rejoue(): void
    {
        $user = User::factory()->create(['email' => 'admin@manoir.test']);
        $secret = $this->enableTwoFactor($user);
        $code = $this->currentCode($secret);

        $premier = $this->postJson('/api/auth/login', ['email' => 'admin@manoir.test', 'password' => 'password'])->json('challenge_token');
        $this->postJson('/api/auth/two-factor/challenge', ['challenge_token' => $premier, 'code' => $code])->assertOk();

        $second = $this->postJson('/api/auth/login', ['email' => 'admin@manoir.test', 'password' => 'password'])->json('challenge_token');
        $this->postJson('/api/auth/two-factor/challenge', ['challenge_token' => $second, 'code' => $code])->assertStatus(422);
    }

    public function test_un_code_de_secours_ne_sert_qu_une_fois(): void
    {
        $user = User::factory()->create(['email' => 'admin@manoir.test']);
        $this->enableTwoFactor($user);

        $challenge = $this->postJson('/api/auth/login', ['email' => 'admin@manoir.test', 'password' => 'password'])->json('challenge_token');
        $this->postJson('/api/auth/two-factor/challenge', ['challenge_token' => $challenge, 'recovery_code' => 'aaaa1111-bbbb2222'])->assertOk();

        $challenge = $this->postJson('/api/auth/login', ['email' => 'admin@manoir.test', 'password' => 'password'])->json('challenge_token');
        $this->postJson('/api/auth/two-factor/challenge', ['challenge_token' => $challenge, 'recovery_code' => 'AAAA1111-BBBB2222'])->assertStatus(422);
    }

    public function test_un_faux_jeton_de_challenge_est_refuse(): void
    {
        $this->postJson('/api/auth/two-factor/challenge', ['challenge_token' => 'a.b.c', 'code' => '123456'])
            ->assertUnauthorized();
    }

    public function test_l_utilisateur_voit_et_revoque_ses_sessions_par_appareil(): void
    {
        $user = User::factory()->create();
        $autreAppareil = $this->openSession($user);
        $intrus = User::factory()->create();
        $sessionIntrus = $this->openSession($intrus)->session;

        $this->actingAsJwt($user);

        $this->getJson('/api/auth/sessions')
            ->assertOk()
            ->assertJsonCount(2, 'sessions')
            ->assertJsonFragment(['current' => true]);

        $this->deleteJson('/api/auth/sessions/'.$autreAppareil->session->id)->assertOk();
        $this->assertNotNull($autreAppareil->session->fresh()->revoked_at);

        // La session d'un autre utilisateur reste hors d'atteinte.
        $this->deleteJson('/api/auth/sessions/'.$sessionIntrus->id)->assertNotFound();
        $this->assertNull($sessionIntrus->fresh()->revoked_at);
    }

    public function test_changer_de_mot_de_passe_deconnecte_les_autres_appareils(): void
    {
        $user = User::factory()->create();
        $autre = $this->openSession($user);

        $this->actingAsJwt($user)
            ->putJson('/api/user/password', [
                'current_password' => 'password',
                'password' => 'nouveau-pass1',
                'password_confirmation' => 'nouveau-pass1',
            ])
            ->assertOk();

        $this->assertNotNull($autre->session->fresh()->revoked_at);
        $this->assertSame(1, AuthSession::active()->where('user_id', $user->id)->count());
    }
}
