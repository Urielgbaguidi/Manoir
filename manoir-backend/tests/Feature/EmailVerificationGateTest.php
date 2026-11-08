<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Une adresse non confirmee ne doit pas pouvoir engager de reservation.
 */
class EmailVerificationGateTest extends TestCase
{
    use RefreshDatabase;

    private function connecte(User $user): static
    {
        return $this->withHeader('Authorization', 'Bearer '.$user->createToken('tests')->plainTextToken);
    }

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

    public function test_un_compte_non_verifie_ne_peut_pas_reserver(): void
    {
        $user = User::factory()->unverified()->create();

        $this->connecte($user)
            ->postJson('/api/reservations', $this->demande())
            ->assertStatus(403)
            ->assertJsonPath('reason', 'email_not_verified');
    }

    public function test_un_compte_verifie_peut_reserver(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);

        $this->connecte($user)
            ->postJson('/api/reservations', $this->demande())
            ->assertCreated();
    }

    public function test_un_compte_non_verifie_ne_peut_pas_payer(): void
    {
        $user = User::factory()->unverified()->create();

        $this->connecte($user)
            ->postJson('/api/reservations/1/payments/initiate', [
                'payment_method' => 'mobile_money',
                'provider' => 'kkiapay',
                'phone_number' => '+22997000000',
            ])
            ->assertStatus(403)
            ->assertJsonPath('reason', 'email_not_verified');
    }

    public function test_consulter_ses_reservations_reste_possible(): void
    {
        $user = User::factory()->unverified()->create();

        // Le blocage ne doit porter que sur les actions engageantes : sinon le
        // client ne pourrait meme plus voir son espace.
        $this->connecte($user)->getJson('/api/reservations')->assertOk();
        $this->connecte($user)->getJson('/api/user')->assertOk();
        $this->connecte($user)->getJson('/api/email/status')->assertOk();
    }
}
