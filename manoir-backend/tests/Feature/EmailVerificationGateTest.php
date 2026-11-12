<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Une adresse non confirmee n'a pas acces a l'espace client (verification
 * obligatoire avant le dashboard), meme avec une session valide.
 */
class EmailVerificationGateTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array<string, mixed>
     */
    private function demande(): array
    {
        return [
            'category_type' => 'deux_chambres',
            'check_in' => now()->addDays(30)->toDateString(),
            'check_out' => now()->addDays(32)->toDateString(),
            'guests' => 2,
        ];
    }

    public function test_un_compte_non_verifie_n_accede_pas_a_l_espace_client(): void
    {
        $user = User::factory()->unverified()->create();

        $this->actingAsJwt($user)
            ->getJson('/api/reservations')
            ->assertForbidden()
            ->assertJsonPath('reason', 'email_not_verified');

        $this->actingAsJwt($user)
            ->withIdempotencyKey()
            ->postJson('/api/reservations', $this->demande())
            ->assertForbidden()
            ->assertJsonPath('reason', 'email_not_verified');
    }

    public function test_un_compte_non_verifie_garde_acces_a_sa_session(): void
    {
        $user = User::factory()->unverified()->create();

        $this->actingAsJwt($user)
            ->getJson('/api/auth/session')
            ->assertOk()
            ->assertJsonPath('user.email_verified_at', null);
    }

    public function test_un_compte_verifie_peut_faire_une_demande(): void
    {
        $user = User::factory()->create();

        $this->actingAsJwt($user)
            ->withIdempotencyKey()
            ->postJson('/api/reservations', $this->demande())
            ->assertCreated();
    }
}
