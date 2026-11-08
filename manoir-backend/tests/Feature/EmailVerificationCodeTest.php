<?php

namespace Tests\Feature;

use App\Models\EmailVerificationCode;
use App\Models\User;
use App\Notifications\VerifyEmailCodeNotification;
use Illuminate\Auth\Events\Verified;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class EmailVerificationCodeTest extends TestCase
{
    use RefreshDatabase;

    private function connecte(User $user): static
    {
        return $this->withHeader('Authorization', 'Bearer '.$user->createToken('tests')->plainTextToken);
    }

    /**
     * Recupere le code en clair : il n'existe qu'au moment de l'envoi.
     */
    private function codeEnvoye(User $user): string
    {
        $code = null;
        Notification::assertSentTo($user, VerifyEmailCodeNotification::class, function ($notification) use (&$code) {
            $reflection = new \ReflectionProperty($notification, 'code');
            $code = $reflection->getValue($notification);

            return true;
        });

        return $code;
    }

    public function test_l_inscription_envoie_un_code_a_six_chiffres(): void
    {
        Notification::fake();

        $this->postJson('/api/register', [
            'name' => 'Marie Test',
            'email' => 'marie@manoir.test',
            'phone' => '+22997000000',
            'password' => 'password123',
        ])->assertCreated();

        $user = User::where('email', 'marie@manoir.test')->sole();
        $this->assertMatchesRegularExpression('/^\d{6}$/', $this->codeEnvoye($user));
        $this->assertNotNull($user->emailVerificationCode);
    }

    public function test_le_code_n_est_jamais_stocke_en_clair(): void
    {
        $user = User::factory()->unverified()->create();
        $code = EmailVerificationCode::genererPour($user);

        $this->assertNotSame($code, $user->emailVerificationCode()->sole()->code_hash);
        $this->assertTrue($user->emailVerificationCode()->sole()->correspond($code));
    }

    public function test_le_bon_code_confirme_l_adresse(): void
    {
        Event::fake();
        $user = User::factory()->unverified()->create();
        $code = EmailVerificationCode::genererPour($user);

        $this->connecte($user)
            ->postJson('/api/email/verify-code', ['code' => $code])
            ->assertOk()
            ->assertJsonPath('verified', true);

        $this->assertTrue($user->fresh()->hasVerifiedEmail());
        Event::assertDispatched(Verified::class);
    }

    public function test_le_code_est_consomme_apres_usage(): void
    {
        $user = User::factory()->unverified()->create();
        $code = EmailVerificationCode::genererPour($user);

        $this->connecte($user)->postJson('/api/email/verify-code', ['code' => $code])->assertOk();

        $this->assertNull($user->fresh()->emailVerificationCode);
    }

    public function test_un_mauvais_code_est_refuse(): void
    {
        $user = User::factory()->unverified()->create();
        EmailVerificationCode::genererPour($user);

        $this->connecte($user)
            ->postJson('/api/email/verify-code', ['code' => '000000'])
            ->assertStatus(422);

        $this->assertFalse($user->fresh()->hasVerifiedEmail());
    }

    public function test_le_code_est_brule_apres_cinq_echecs(): void
    {
        $user = User::factory()->unverified()->create();
        $code = EmailVerificationCode::genererPour($user);
        $mauvais = $code === '111111' ? '222222' : '111111';

        for ($i = 0; $i < EmailVerificationCode::MAX_TENTATIVES; $i++) {
            $this->connecte($user)->postJson('/api/email/verify-code', ['code' => $mauvais]);
        }

        // Meme le bon code ne doit plus passer : il faut en redemander un.
        $this->connecte($user)
            ->postJson('/api/email/verify-code', ['code' => $code])
            ->assertStatus(429);

        $this->assertFalse($user->fresh()->hasVerifiedEmail());
    }

    public function test_un_code_expire_est_refuse(): void
    {
        $user = User::factory()->unverified()->create();
        $code = EmailVerificationCode::genererPour($user);
        $user->emailVerificationCode()->sole()->update(['expires_at' => now()->subMinute()]);

        $this->connecte($user)
            ->postJson('/api/email/verify-code', ['code' => $code])
            ->assertStatus(422);

        $this->assertFalse($user->fresh()->hasVerifiedEmail());
    }

    public function test_redemander_un_code_invalide_le_precedent(): void
    {
        $user = User::factory()->unverified()->create();
        $ancien = EmailVerificationCode::genererPour($user);
        $nouveau = EmailVerificationCode::genererPour($user);

        $this->assertNotSame($ancien, $nouveau);
        $this->assertSame(1, EmailVerificationCode::where('user_id', $user->id)->count());

        $this->connecte($user)
            ->postJson('/api/email/verify-code', ['code' => $ancien])
            ->assertStatus(422);
    }

    public function test_un_format_invalide_est_refuse(): void
    {
        $user = User::factory()->unverified()->create();
        EmailVerificationCode::genererPour($user);

        foreach (['12345', '1234567', 'abcdef', ''] as $mauvais) {
            $this->connecte($user)
                ->postJson('/api/email/verify-code', ['code' => $mauvais])
                ->assertStatus(422)
                ->assertJsonValidationErrors('code');
        }
    }

    public function test_le_code_d_un_autre_utilisateur_ne_marche_pas(): void
    {
        $marie = User::factory()->unverified()->create();
        $paul = User::factory()->unverified()->create();
        $codeDePaul = EmailVerificationCode::genererPour($paul);
        EmailVerificationCode::genererPour($marie);

        $this->connecte($marie)
            ->postJson('/api/email/verify-code', ['code' => $codeDePaul])
            ->assertStatus(422);

        $this->assertFalse($marie->fresh()->hasVerifiedEmail());
    }

    public function test_le_renvoi_est_refuse_si_deja_confirme(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);

        $this->connecte($user)->postJson('/api/email/resend')->assertStatus(422);
    }

    public function test_le_statut_reflete_la_verification(): void
    {
        $user = User::factory()->unverified()->create();
        $code = EmailVerificationCode::genererPour($user);

        $this->connecte($user)
            ->getJson('/api/email/status')
            ->assertOk()
            ->assertJsonPath('verified', false)
            ->assertJsonPath('code_pending', true);

        $this->connecte($user)->postJson('/api/email/verify-code', ['code' => $code])->assertOk();
        $this->app['auth']->forgetGuards();

        $this->connecte($user)
            ->getJson('/api/email/status')
            ->assertOk()
            ->assertJsonPath('verified', true);
    }
}
