<?php

namespace Tests\Feature;

use App\Models\Reservation;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Supprimer un appartement efface ses reservations en cascade : l'API doit
 * refuser des qu'un historique existe.
 */
class AdminRoomDeletionTest extends TestCase
{
    use RefreshDatabase;

    public function test_an_apartment_without_reservations_can_be_deleted(): void
    {
        $room = Room::create([
            'name' => 'Appartement test',
            'slug' => 'appartement-test',
            'description' => 'Description',
            'max_occupants' => 2,
            'base_price' => 30000,
            'type' => 'une_chambre',
            'equipments' => [],
            'images' => [],
            'status' => 'available',
        ]);

        $this->withToken($this->adminToken())
            ->deleteJson("/api/admin/rooms/{$room->id}")
            ->assertOk();

        $this->assertModelMissing($room);
    }

    public function test_an_apartment_with_reservations_cannot_be_deleted(): void
    {
        $room = Room::where('apartment_number', 1)->firstOrFail();
        $reservation = Reservation::create([
            'user_id' => User::factory()->create()->id,
            'room_id' => $room->id,
            'category_type' => $room->type,
            'check_in' => now()->subDays(10)->toDateString(),
            'check_out' => now()->subDays(8)->toDateString(),
            'guests' => 2,
            'total_price' => 30000,
            'stay_amount' => 30000,
            'status' => 'SEJOUR_PAYE',
        ]);

        $this->withToken($this->adminToken())
            ->deleteJson("/api/admin/rooms/{$room->id}")
            ->assertUnprocessable();

        $this->assertModelExists($room);
        $this->assertModelExists($reservation);
    }

    private function adminToken(): string
    {
        $admin = User::factory()->create(['is_admin' => true]);

        return $this->openSession($admin)->accessToken;
    }
}
