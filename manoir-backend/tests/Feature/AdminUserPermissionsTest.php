<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdminUserPermissionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_super_admin_can_promote_and_demote_a_user(): void
    {
        [$superAdmin, $token] = $this->authenticatedAdmin(true);
        $user = User::factory()->create(['is_admin' => false]);

        $this->withToken($token)
            ->putJson("/api/admin/users/{$user->id}/toggle-admin")
            ->assertOk()
            ->assertJsonPath('user.is_admin', true);

        $this->withToken($token)
            ->putJson("/api/admin/users/{$user->id}/toggle-admin")
            ->assertOk()
            ->assertJsonPath('user.is_admin', false);
    }

    public function test_regular_admin_cannot_change_admin_roles(): void
    {
        [, $token] = $this->authenticatedAdmin();
        $user = User::factory()->create(['is_admin' => false]);

        $this->withToken($token)
            ->putJson("/api/admin/users/{$user->id}/toggle-admin")
            ->assertForbidden();

        $this->assertFalse($user->fresh()->is_admin);
    }

    public function test_super_admin_cannot_be_demoted_or_deleted(): void
    {
        [$superAdmin, $superToken] = $this->authenticatedAdmin(true);
        [, $adminToken] = $this->authenticatedAdmin();

        $this->withToken($superToken)
            ->putJson("/api/admin/users/{$superAdmin->id}/toggle-admin")
            ->assertForbidden();

        $this->withToken($adminToken)
            ->deleteJson("/api/admin/users/{$superAdmin->id}")
            ->assertForbidden();

        $this->assertDatabaseHas('users', [
            'id' => $superAdmin->id,
            'is_admin' => true,
            'is_super_admin' => true,
        ]);
    }

    public function test_regular_admin_can_delete_a_client_but_not_an_admin(): void
    {
        [, $token] = $this->authenticatedAdmin();
        $otherAdmin = User::factory()->create(['is_admin' => true]);
        $client = User::factory()->create(['is_admin' => false]);

        $this->withToken($token)
            ->deleteJson("/api/admin/users/{$otherAdmin->id}")
            ->assertForbidden();

        $this->withToken($token)
            ->deleteJson("/api/admin/users/{$client->id}")
            ->assertOk();

        $this->assertDatabaseHas('users', ['id' => $otherAdmin->id]);
        $this->assertDatabaseMissing('users', ['id' => $client->id]);
    }

    public function test_regular_admin_can_edit_a_client_but_not_other_admins(): void
    {
        [, $token] = $this->authenticatedAdmin();
        $superAdmin = User::factory()->create([
            'is_admin' => true,
            'is_super_admin' => true,
        ]);
        $otherAdmin = User::factory()->create(['is_admin' => true]);
        $client = User::factory()->create(['is_admin' => false]);

        $this->withToken($token)
            ->putJson("/api/admin/users/{$superAdmin->id}", ['name' => 'Nouveau nom'])
            ->assertForbidden();

        $this->withToken($token)
            ->putJson("/api/admin/users/{$otherAdmin->id}", ['name' => 'Nouveau nom'])
            ->assertForbidden();

        $this->withToken($token)
            ->putJson("/api/admin/users/{$client->id}", ['name' => 'Client modifié'])
            ->assertOk()
            ->assertJsonPath('user.name', 'Client modifié');

        $this->assertNotSame('Nouveau nom', $superAdmin->fresh()->name);
        $this->assertNotSame('Nouveau nom', $otherAdmin->fresh()->name);
    }

    /**
     * @return array{User, string}
     */
    private function authenticatedAdmin(bool $isSuperAdmin = false): array
    {
        $token = Str::random(80);
        $user = User::factory()->create([
            'is_admin' => true,
            'is_super_admin' => $isSuperAdmin,
            'api_token' => hash('sha256', $token),
            'api_token_expires_at' => now()->addHour(),
        ]);

        return [$user, $token];
    }
}
