<?php

namespace Tests\Feature;

use App\Models\EmailVerificationCode;
use App\Models\User;
use App\Notifications\AccountAlreadyExistsNotification;
use App\Notifications\VerifyEmailCodeNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * Inscription classique + verification email obligatoire avant toute session.
 */
class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array<string, string>
     */
    private function inscription(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Marie Test',
            'email' => 'marie@manoir.test',
            'phone' => '+229 01 97 00 00 00',
            'country' => 'bj',
            'password' => 'motdepasse123',
        ], $overrides);
    }

    private function codeEnvoye(User $user): string
    {
        $code = null;
        Notification::assertSentTo($user, VerifyEmailCodeNotification::class, function ($notification) use (&$code) {
            $code = (new \ReflectionProperty($notification, 'code'))->getValue($notification);

            return true;
        });

        return (string) $code;
    }

    public function test_l_inscription_normalise_les_donnees_et_n_ouvre_aucune_session(): void
    {
        Notification::fake();

        $response = $this->postJson('/api/auth/register', $this->inscription())
            ->assertStatus(202)
            ->assertJsonPath('verification_required', true);

        $this->assertDatabaseHas('users', [
            'email' => 'marie@manoir.test',
            'phone' => '+2290197000000',
            'country' => 'BJ',
            'email_verified_at' => null,
        ]);
        $response->assertCookieMissing((string) config('jwt.cookies.access'));
        $this->assertDatabaseCount('auth_sessions', 0);
    }

    public function test_une_adresse_deja_utilisee_recoit_la_meme_reponse_et_un_mail_d_alerte(): void
    {
        Notification::fake();
        $existant = User::factory()->create(['email' => 'marie@manoir.test']);

        $nouvelle = $this->postJson('/api/auth/register', $this->inscription(['email' => 'autre@manoir.test']));
        $doublon = $this->postJson('/api/auth/register', $this->inscription());

        $doublon->assertStatus(202)->assertJsonPath('message', $nouvelle->json('message'));
        $this->assertSame(1, User::where('email', 'marie@manoir.test')->count());
        Notification::assertSentTo($existant, AccountAlreadyExistsNotification::class);
    }

    public function test_l_inscription_refuse_un_code_pays_invalide(): void
    {
        Notification::fake();

        foreach (['', 'BEN', 'B1', '12'] as $country) {
            $this->postJson('/api/auth/register', $this->inscription(['country' => $country]))
                ->assertStatus(422)
                ->assertJsonValidationErrors('country');
        }

        $this->assertNull(User::where('email', 'marie@manoir.test')->first());
    }

    public function test_l_inscription_exige_un_telephone_au_format_international(): void
    {
        $this->postJson('/api/auth/register', $this->inscription(['phone' => '0197000000']))
            ->assertStatus(422)
            ->assertJsonValidationErrors('phone');
    }

    public function test_le_bon_code_confirme_l_adresse_et_ouvre_la_session_par_cookies(): void
    {
        Notification::fake();
        $this->postJson('/api/auth/register', $this->inscription());
        $user = User::where('email', 'marie@manoir.test')->firstOrFail();

        $response = $this->postJson('/api/auth/email/verify', [
            'email' => 'marie@manoir.test',
            'code' => $this->codeEnvoye($user),
        ]);

        $response->assertOk($response->getContent())
            ->assertJsonStructure(['user' => ['id', 'email'], 'csrf_token'])
            ->assertJsonMissingPath('token')
            ->assertCookie((string) config('jwt.cookies.access'), null, false)
            ->assertCookie((string) config('jwt.cookies.refresh'), null, false);
        $this->assertNotNull($user->fresh()->email_verified_at);
        $this->assertDatabaseMissing('email_verification_codes', ['user_id' => $user->id]);

        $cookie = collect($response->headers->getCookies())
            ->first(fn ($c) => $c->getName() === config('jwt.cookies.access'));
        $this->assertTrue($cookie->isHttpOnly());
        $this->assertSame('lax', $cookie->getSameSite());
    }

    public function test_un_mauvais_code_est_refuse_avec_un_message_generique(): void
    {
        Notification::fake();
        $this->postJson('/api/auth/register', $this->inscription());

        $inconnu = $this->postJson('/api/auth/email/verify', ['email' => 'personne@manoir.test', 'code' => '123456']);
        $faux = $this->postJson('/api/auth/email/verify', ['email' => 'marie@manoir.test', 'code' => '000000']);

        $inconnu->assertStatus(422);
        $faux->assertStatus(422)->assertJsonPath('message', $inconnu->json('message'));
        $this->assertDatabaseCount('auth_sessions', 0);
    }

    public function test_le_code_est_brule_apres_trop_d_essais(): void
    {
        Notification::fake();
        $this->postJson('/api/auth/register', $this->inscription());
        $user = User::where('email', 'marie@manoir.test')->firstOrFail();
        $code = $this->codeEnvoye($user);
        $mauvais = $code === '111111' ? '222222' : '111111';
        $this->withoutMiddleware(ThrottleRequests::class);

        for ($i = 0; $i < EmailVerificationCode::MAX_TENTATIVES; $i++) {
            $this->postJson('/api/auth/email/verify', ['email' => 'marie@manoir.test', 'code' => $mauvais]);
        }

        $this->postJson('/api/auth/email/verify', ['email' => 'marie@manoir.test', 'code' => $code])
            ->assertStatus(422);
        $this->assertNull($user->fresh()->email_verified_at);
    }

    public function test_le_renvoi_du_code_repond_pareil_que_le_compte_existe_ou_non(): void
    {
        Notification::fake();
        $user = User::factory()->unverified()->create(['email' => 'marie@manoir.test']);

        $connu = $this->postJson('/api/auth/email/resend', ['email' => 'marie@manoir.test'])->assertOk();
        $inconnu = $this->postJson('/api/auth/email/resend', ['email' => 'inconnu@manoir.test'])->assertOk();

        $this->assertSame($connu->json('message'), $inconnu->json('message'));
        Notification::assertSentTo($user, VerifyEmailCodeNotification::class);
    }

    public function test_le_renvoi_du_code_est_limite(): void
    {
        Notification::fake();

        for ($i = 0; $i < 3; $i++) {
            $this->postJson('/api/auth/email/resend', ['email' => 'marie@manoir.test'])->assertOk();
        }

        $this->postJson('/api/auth/email/resend', ['email' => 'marie@manoir.test'])->assertStatus(429);
    }
}
