<?php

namespace Tests\Feature;

use App\Mail\VerifyEmailMail;
use App\Models\EmailVerificationCode;
use App\Models\User;
use App\Notifications\VerifyEmailLinkNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * Inscription classique + confirmation de l'adresse par lien, obligatoire
 * avant toute session.
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

    /**
     * Jeton contenu dans le lien du mail envoye a l'utilisateur.
     */
    private function jetonEnvoye(User $user): string
    {
        $token = null;
        Notification::assertSentTo($user, VerifyEmailLinkNotification::class, function ($notification) use (&$token) {
            $token = (new \ReflectionProperty($notification, 'token'))->getValue($notification);

            return true;
        });

        return (string) $token;
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

    public function test_le_mail_contient_un_lien_vers_la_page_de_confirmation_et_le_logo(): void
    {
        Notification::fake();
        $this->postJson('/api/auth/register', $this->inscription());
        $user = User::where('email', 'marie@manoir.test')->firstOrFail();
        $token = $this->jetonEnvoye($user);

        $mail = (new VerifyEmailLinkNotification($token))->toMail($user);
        $this->assertInstanceOf(VerifyEmailMail::class, $mail);
        $this->assertSame(
            rtrim((string) config('app.frontend_url'), '/').'/auth/confirmer-email?email=marie%40manoir.test&token='.$token,
            $mail->url
        );
        $mail->assertSeeInHtml('Confirmer mon adresse e-mail');

        // Envoi reel (transport en memoire) : le logo est joint au message
        // et reference par l'image de l'en-tete.
        config(['mail.default' => 'array']);
        Mail::send($mail);
        $email = Mail::mailer('array')->getSymfonyTransport()->messages()->last()->getOriginalMessage();
        $this->assertStringContainsString('cid:', (string) $email->getHtmlBody());
        $this->assertCount(1, $email->getAttachments());
        $this->assertSame('image/jpeg', $email->getAttachments()[0]->getMediaType().'/'.$email->getAttachments()[0]->getMediaSubtype());

        $this->assertMatchesRegularExpression('/^[a-f0-9]{64}$/', $token);
        // Seule l'empreinte du jeton est conservee.
        $this->assertDatabaseMissing('email_verification_codes', ['code_hash' => $token]);
    }

    public function test_une_adresse_deja_utilisee_est_refusee(): void
    {
        Notification::fake();
        User::factory()->create(['email' => 'marie@manoir.test']);

        $this->postJson('/api/auth/register', $this->inscription())
            ->assertStatus(422)
            ->assertJsonPath('reason', 'email_taken')
            ->assertJsonPath('message', 'Cette adresse e-mail existe déjà.')
            ->assertJsonValidationErrors('email');

        $this->assertSame(1, User::where('email', 'marie@manoir.test')->count());
        Notification::assertNothingSent();
    }

    public function test_une_adresse_d_un_compte_google_est_refusee(): void
    {
        Notification::fake();
        User::factory()->fromGoogle()->create(['email' => 'marie@manoir.test']);

        $this->postJson('/api/auth/register', $this->inscription())
            ->assertStatus(422)
            ->assertJsonPath('reason', 'email_taken')
            ->assertJsonValidationErrors('email');

        $this->assertNull(User::where('email', 'marie@manoir.test')->value('password'));
    }

    public function test_une_adresse_inscrite_mais_jamais_confirmee_recoit_un_nouveau_lien_sans_modification(): void
    {
        Notification::fake();
        $enAttente = User::factory()->unverified()->create([
            'email' => 'marie@manoir.test',
            'name' => 'Nom initial',
        ]);
        $hash = $enAttente->password;

        $this->postJson('/api/auth/register', $this->inscription(['name' => 'Usurpateur']))
            ->assertStatus(202)
            ->assertJsonPath('already_pending', true);

        Notification::assertSentTo($enAttente, VerifyEmailLinkNotification::class);
        $enAttente->refresh();
        $this->assertSame('Nom initial', $enAttente->name);
        $this->assertSame($hash, $enAttente->password);
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

    public function test_le_lien_confirme_l_adresse_et_ouvre_la_session_par_cookies(): void
    {
        Notification::fake();
        $this->postJson('/api/auth/register', $this->inscription());
        $user = User::where('email', 'marie@manoir.test')->firstOrFail();

        $response = $this->postJson('/api/auth/email/verify', [
            'email' => 'marie@manoir.test',
            'token' => $this->jetonEnvoye($user),
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

    public function test_un_lien_deja_utilise_indique_que_l_adresse_est_confirmee(): void
    {
        Notification::fake();
        $this->postJson('/api/auth/register', $this->inscription());
        $user = User::where('email', 'marie@manoir.test')->firstOrFail();
        $token = $this->jetonEnvoye($user);

        $this->postJson('/api/auth/email/verify', ['email' => 'marie@manoir.test', 'token' => $token])->assertOk();

        $this->postJson('/api/auth/email/verify', ['email' => 'marie@manoir.test', 'token' => $token])
            ->assertStatus(409)
            ->assertJsonPath('reason', 'already_verified');
    }

    public function test_un_mauvais_lien_est_refuse_avec_un_message_generique(): void
    {
        Notification::fake();
        $this->postJson('/api/auth/register', $this->inscription());

        $inconnu = $this->postJson('/api/auth/email/verify', ['email' => 'personne@manoir.test', 'token' => str_repeat('a', 64)]);
        $faux = $this->postJson('/api/auth/email/verify', ['email' => 'marie@manoir.test', 'token' => str_repeat('b', 64)]);

        $inconnu->assertStatus(422);
        $faux->assertStatus(422)->assertJsonPath('message', $inconnu->json('message'));
        $this->assertDatabaseCount('auth_sessions', 0);
    }

    public function test_un_lien_expire_est_refuse(): void
    {
        Notification::fake();
        $this->postJson('/api/auth/register', $this->inscription());
        $user = User::where('email', 'marie@manoir.test')->firstOrFail();
        $token = $this->jetonEnvoye($user);

        $this->travel(EmailVerificationCode::DUREE_MINUTES + 1)->minutes();

        $this->postJson('/api/auth/email/verify', ['email' => 'marie@manoir.test', 'token' => $token])
            ->assertStatus(422)
            ->assertJsonPath('reason', 'invalid_link');
        $this->assertNull($user->fresh()->email_verified_at);
    }

    public function test_le_lien_est_brule_apres_trop_d_essais(): void
    {
        Notification::fake();
        $this->postJson('/api/auth/register', $this->inscription());
        $user = User::where('email', 'marie@manoir.test')->firstOrFail();
        $token = $this->jetonEnvoye($user);
        $this->withoutMiddleware(ThrottleRequests::class);

        for ($i = 0; $i < EmailVerificationCode::MAX_TENTATIVES; $i++) {
            $this->postJson('/api/auth/email/verify', ['email' => 'marie@manoir.test', 'token' => str_repeat('c', 64)]);
        }

        $this->postJson('/api/auth/email/verify', ['email' => 'marie@manoir.test', 'token' => $token])
            ->assertStatus(422);
        $this->assertNull($user->fresh()->email_verified_at);
    }

    public function test_le_renvoi_du_lien_repond_pareil_que_le_compte_existe_ou_non(): void
    {
        Notification::fake();
        $user = User::factory()->unverified()->create(['email' => 'marie@manoir.test']);

        $connu = $this->postJson('/api/auth/email/resend', ['email' => 'marie@manoir.test'])->assertOk();
        $inconnu = $this->postJson('/api/auth/email/resend', ['email' => 'inconnu@manoir.test'])->assertOk();

        $this->assertSame($connu->json('message'), $inconnu->json('message'));
        Notification::assertSentTo($user, VerifyEmailLinkNotification::class);
    }

    public function test_le_renvoi_du_lien_est_limite(): void
    {
        Notification::fake();

        for ($i = 0; $i < 3; $i++) {
            $this->postJson('/api/auth/email/resend', ['email' => 'marie@manoir.test'])->assertOk();
        }

        $this->postJson('/api/auth/email/resend', ['email' => 'marie@manoir.test'])->assertStatus(429);
    }
}
