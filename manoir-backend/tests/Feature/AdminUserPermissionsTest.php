<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
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

    public function test_super_admin_cannot_be_demoted(): void
    {
        [$superAdmin, $superToken] = $this->authenticatedAdmin(true);

        $this->withToken($superToken)
            ->putJson("/api/admin/users/{$superAdmin->id}/toggle-admin")
            ->assertForbidden();

        $this->assertDatabaseHas('users', [
            'id' => $superAdmin->id,
            'is_admin' => true,
            'is_super_admin' => true,
        ]);
    }

    /**
     * Aucun administrateur, pas meme le super administrateur, ne peut
     * supprimer un compte : la route n'existe pas.
     */
    public function test_no_admin_can_delete_a_user(): void
    {
        [, $superToken] = $this->authenticatedAdmin(true);
        $client = User::factory()->create();

        $this->withToken($superToken)
            ->deleteJson("/api/admin/users/{$client->id}")
            ->assertStatus(405);

        $this->assertDatabaseHas('users', ['id' => $client->id]);
    }

    public function test_the_user_policy_never_allows_deletion(): void
    {
        $superAdmin = User::factory()->create(['is_admin' => true, 'is_super_admin' => true]);
        $client = User::factory()->create();

        $this->assertFalse($superAdmin->can('delete', $client));
        $this->assertFalse($superAdmin->can('forceDelete', $client));
    }

    public function test_the_model_refuses_to_be_deleted(): void
    {
        $client = User::factory()->create();

        $this->expectException(\LogicException::class);

        try {
            $client->delete();
        } finally {
            $this->assertDatabaseHas('users', ['id' => $client->id]);
        }
    }

    public function test_users_table_is_paginated_searchable_and_sortable(): void
    {
        [, $token] = $this->authenticatedAdmin();
        User::factory()->create(['name' => 'Zoe Martin', 'email' => 'zoe@manoir.test']);
        User::factory()->count(3)->create();

        $this->withToken($token)
            ->getJson('/api/admin/users?search=zoe&per_page=10')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.email', 'zoe@manoir.test');

        $this->withToken($token)
            ->getJson('/api/admin/users?per_page=2&sort=name&direction=asc')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('total', 5);
    }

    public function test_a_client_cannot_list_users(): void
    {
        $client = User::factory()->create();

        $this->actingAsJwt($client)->getJson('/api/admin/users')->assertForbidden();
    }

    public function test_super_admin_without_admin_flag_can_still_list_users(): void
    {
        $superAdmin = User::factory()->create([
            'is_admin' => false,
            'is_super_admin' => true,
        ]);

        $this->actingAsJwt($superAdmin)
            ->getJson('/api/admin/users')
            ->assertOk();
    }

    public function test_admin_filter_includes_super_admins_without_admin_flag(): void
    {
        [, $token] = $this->authenticatedAdmin();
        $superAdmin = User::factory()->create([
            'is_admin' => false,
            'is_super_admin' => true,
        ]);

        $this->withToken($token)
            ->getJson('/api/admin/users?is_admin=1')
            ->assertOk()
            ->assertJsonFragment(['id' => $superAdmin->id]);
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
        $user = User::factory()->create([
            'is_admin' => true,
            'is_super_admin' => $isSuperAdmin,
        ]);

        $token = $this->openSession($user)->accessToken;

        return [$user, $token];
    }
}
