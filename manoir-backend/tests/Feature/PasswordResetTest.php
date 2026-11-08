<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\ResetPasswordNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    use RefreshDatabase;

    public function test_un_lien_est_envoye_pour_une_adresse_connue(): void
    {
        Notification::fake();
        $user = User::factory()->create(['email' => 'client@manoir.test']);

        $this->postJson('/api/forgot-password', ['email' => 'client@manoir.test'])
            ->assertOk();

        Notification::assertSentTo($user, ResetPasswordNotification::class);
    }

    public function test_une_adresse_inconnue_recoit_la_meme_reponse(): void
    {
        Notification::fake();

        $inconnue = $this->postJson('/api/forgot-password', ['email' => 'personne@nulle-part.test'])
            ->assertOk()
            ->json('message');

        User::factory()->create(['email' => 'connue@manoir.test']);
        $connue = $this->postJson('/api/forgot-password', ['email' => 'connue@manoir.test'])
            ->assertOk()
            ->json('message');

        // Sinon l'endpoint revele quels emails possedent un compte.
        $this->assertSame($connue, $inconnue);
        Notification::assertCount(1);
    }

    public function test_le_mot_de_passe_est_bien_change(): void
    {
        $user = User::factory()->create(['email' => 'client@manoir.test']);
        $token = Password::createToken($user);

        $this->postJson('/api/reset-password', [
            'token' => $token,
            'email' => 'client@manoir.test',
            'password' => 'nouveaupass123',
            'password_confirmation' => 'nouveaupass123',
        ])->assertOk();

        $this->assertTrue(Hash::check('nouveaupass123', $user->fresh()->password));
    }

    public function test_un_token_invalide_est_refuse(): void
    {
        User::factory()->create(['email' => 'client@manoir.test']);

        $this->postJson('/api/reset-password', [
            'token' => 'token-bidon',
            'email' => 'client@manoir.test',
            'password' => 'nouveaupass123',
            'password_confirmation' => 'nouveaupass123',
        ])->assertStatus(422);
    }

    public function test_un_token_ne_sert_qu_une_fois(): void
    {
        $user = User::factory()->create(['email' => 'client@manoir.test']);
        $token = Password::createToken($user);

        $payload = [
            'token' => $token,
            'email' => 'client@manoir.test',
            'password' => 'nouveaupass123',
            'password_confirmation' => 'nouveaupass123',
        ];

        $this->postJson('/api/reset-password', $payload)->assertOk();
        $this->postJson('/api/reset-password', $payload)->assertStatus(422);
    }

    public function test_le_changement_deconnecte_tous_les_appareils(): void
    {
        $user = User::factory()->create(['email' => 'client@manoir.test']);
        $ancienToken = $user->createToken('Windows')->plainTextToken;
        $user->createToken('Android');

        $this->withHeader('Authorization', 'Bearer '.$ancienToken)
            ->getJson('/api/user')
            ->assertOk();

        $this->postJson('/api/reset-password', [
            'token' => Password::createToken($user),
            'email' => 'client@manoir.test',
            'password' => 'nouveaupass123',
            'password_confirmation' => 'nouveaupass123',
        ])->assertOk();

        $this->assertSame(0, $user->tokens()->count());

        // Idem : sans cela le guard rejouerait l'utilisateur deja resolu.
        $this->app['auth']->forgetGuards();

        $this->withHeader('Authorization', 'Bearer '.$ancienToken)
            ->getJson('/api/user')
            ->assertUnauthorized();
    }

    public function test_un_mot_de_passe_trop_court_est_refuse(): void
    {
        $user = User::factory()->create(['email' => 'client@manoir.test']);

        $this->postJson('/api/reset-password', [
            'token' => Password::createToken($user),
            'email' => 'client@manoir.test',
            'password' => 'court',
            'password_confirmation' => 'court',
        ])->assertStatus(422)->assertJsonValidationErrors('password');
    }
}
