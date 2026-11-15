<?php

namespace Tests\Feature;

use App\Models\Reservation;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Fin de sejour automatique : plus de bouton « Liberer », l'appartement se
 * libere seul le jour du depart.
 */
class StayCompletionTest extends TestCase
{
    use RefreshDatabase;

    private Room $room;

    private User $client;

    protected function setUp(): void
    {
        parent::setUp();

        $this->room = Room::where('apartment_number', 1)->firstOrFail();
        $this->client = User::factory()->create();
    }

    private function sejour(string $arrivee, string $depart, string $statut = 'SEJOUR_PAYE'): Reservation
    {
        return Reservation::create([
            'user_id' => $this->client->id,
            'room_id' => $this->room->id,
            'category_type' => $this->room->type,
            'check_in' => $arrivee,
            'check_out' => $depart,
            'guests' => 2,
            'total_price' => 30000,
            'stay_amount' => 30000,
            'deposit_amount' => 0,
            'deposit_daily_rate' => 0,
            'status' => $statut,
        ]);
    }

    public function test_la_commande_cloture_les_sejours_dont_le_depart_est_arrive(): void
    {
        $termine = $this->sejour(now()->subDays(3)->toDateString(), now()->toDateString());
        $enCours = $this->sejour(now()->subDay()->toDateString(), now()->addDays(2)->toDateString());
        $nonPaye = $this->sejour(now()->subDays(3)->toDateString(), now()->subDay()->toDateString(), 'VALIDEE_PAIEMENT_REQUIS');

        $this->artisan('reservations:complete-stays')->assertSuccessful();

        $this->assertSame('LIBEREE', $termine->fresh()->status);
        $this->assertNotNull($termine->fresh()->released_at);
        $this->assertNull($termine->fresh()->released_by_admin_id);
        $this->assertSame('SEJOUR_PAYE', $enCours->fresh()->status);
        $this->assertNotSame('LIBEREE', $nonPaye->fresh()->status);
    }

    public function test_le_statut_est_a_jour_a_la_lecture_meme_sans_planificateur(): void
    {
        $termine = $this->sejour(now()->subDays(4)->toDateString(), now()->subDay()->toDateString());

        $this->actingAsJwt($this->client)->getJson('/api/reservations')->assertOk();

        $this->assertSame('LIBEREE', $termine->fresh()->status);
        $this->assertTrue($this->room->fresh()->isAvailableForDates(
            now()->toDateString(),
            now()->addDay()->toDateString()
        ));
    }

    public function test_la_liberation_manuelle_n_existe_plus(): void
    {
        $admin = User::factory()->admin()->create();
        $sejour = $this->sejour(now()->subDay()->toDateString(), now()->addDays(2)->toDateString());

        $this->actingAsJwt($admin)
            ->postJson("/api/admin/reservations/{$sejour->id}/release-room")
            ->assertNotFound();

        $this->assertSame('SEJOUR_PAYE', $sejour->fresh()->status);
    }
}
