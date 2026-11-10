<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class RegistrationTest extends TestCase
{
    use RefreshDatabase;

    public function test_l_inscription_enregistre_le_code_pays_iso(): void
    {
        Notification::fake();

        $this->postJson('/api/register', [
            'name' => 'Marie Test',
            'email' => 'marie@manoir.test',
            'phone' => '+22997000000',
            'country' => 'bj',
            'password' => 'password123',
        ])
            ->assertCreated()
            ->assertJsonPath('user.country', 'BJ');

        $this->assertDatabaseHas('users', [
            'email' => 'marie@manoir.test',
            'country' => 'BJ',
        ]);
    }

    public function test_l_inscription_refuse_un_code_pays_invalide(): void
    {
        Notification::fake();

        foreach (['', 'BEN', 'B1', '12'] as $country) {
            $this->postJson('/api/register', [
                'name' => 'Marie Test',
                'email' => 'marie@manoir.test',
                'phone' => '+22997000000',
                'country' => $country,
                'password' => 'password123',
            ])
                ->assertStatus(422)
                ->assertJsonValidationErrors('country');
        }

        $this->assertNull(User::where('email', 'marie@manoir.test')->first());
    }
}
