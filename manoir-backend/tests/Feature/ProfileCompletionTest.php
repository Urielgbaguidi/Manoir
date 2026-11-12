<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Le numero de telephone est obligatoire pour les clients, mais jamais pour
 * les administrateurs et super-administrateurs.
 */
class ProfileCompletionTest extends TestCase
{
    use RefreshDatabase;

    public function test_un_admin_sans_telephone_n_est_pas_bloque(): void
    {
        $admin = User::factory()->admin()->create(['phone' => null]);

        $this->assertTrue($admin->hasCompletedProfile());
        $this->assertTrue($admin->profile_completed);

        $this->actingAsJwt($admin)
            ->getJson('/api/admin/reservations')
            ->assertOk();
    }

    public function test_un_super_admin_sans_telephone_n_est_pas_bloque(): void
    {
        $superAdmin = User::factory()->create([
            'phone' => null,
            'is_admin' => false,
            'is_super_admin' => true,
        ]);

        $this->assertTrue($superAdmin->hasCompletedProfile());
        $this->assertTrue($superAdmin->profile_completed);

        $this->actingAsJwt($superAdmin)
            ->getJson('/api/admin/reservations')
            ->assertOk();
    }

    public function test_un_client_sans_telephone_reste_bloque(): void
    {
        $client = User::factory()->fromGoogle()->create();

        $this->assertFalse($client->hasCompletedProfile());
        $this->assertFalse($client->profile_completed);

        $this->actingAsJwt($client)
            ->getJson('/api/reservations')
            ->assertForbidden()
            ->assertJsonPath('reason', 'phone_required');
    }
}
