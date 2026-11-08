<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\RoomBlock;
use App\Models\RoomCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Creneau libre de l'appartement consulte (`own_window`).
 *
 * Quand les dates demandees sont prises, le client doit apprendre quand CET
 * appartement-la se libere, meme si d'autres sont disponibles : sinon sa seule
 * issue est d'en changer, alors qu'il tient peut-etre a celui-ci.
 */
class AvailabilityOwnWindowTest extends TestCase
{
    use RefreshDatabase;

    private Room $room;

    private RoomCategory $category;

    protected function setUp(): void
    {
        parent::setUp();

        $this->room = Room::where('apartment_number', 1)->firstOrFail();
        $this->category = RoomCategory::where('type', $this->room->type)->firstOrFail();
    }

    private function bloquer(Room $room, string $du, string $au, string $uid): void
    {
        RoomBlock::create([
            'room_id' => $room->id,
            'starts_on' => $du,
            'ends_on' => $au,
            'source' => RoomBlock::SOURCE_GOOGLE,
            'external_id' => $uid,
        ]);
    }

    private function demander(string $du, string $au): \Illuminate\Testing\TestResponse
    {
        return $this->postJson("/api/room-categories/{$this->category->slug}/check-availability", [
            'check_in' => $du,
            'check_out' => $au,
            'room_id' => $this->room->id,
        ]);
    }

    public function test_le_creneau_est_donne_meme_quand_d_autres_appartements_sont_libres(): void
    {
        // Seul l'appartement consulte est pris : les autres restent libres, donc
        // la reponse contient des alternatives.
        $this->bloquer($this->room, now()->addDays(3)->toDateString(), now()->addDays(6)->toDateString(), 'occ');

        $reponse = $this->demander(now()->addDay()->toDateString(), now()->addDays(6)->toDateString());

        $reponse->assertOk()
            ->assertJsonPath('available', false)
            ->assertJsonPath('own_window.starts_on', now()->addDay()->toDateString())
            ->assertJsonPath('own_window.ends_on', now()->addDays(3)->toDateString())
            ->assertJsonPath('own_window.nights', 2);

        $this->assertNotEmpty($reponse->json('alternatives'));
    }

    public function test_l_appartement_consulte_n_est_pas_repete_dans_les_suggestions(): void
    {
        // Tout le monde est pris sur une partie de la periode : plus aucune
        // alternative, on bascule sur les suggestions de creneaux.
        foreach (Room::whereNotNull('apartment_number')->get() as $index => $autre) {
            $this->bloquer($autre, now()->addDays(2)->toDateString(), now()->addDays(4)->toDateString(), "occ-{$index}");
        }

        $reponse = $this->demander(now()->addDay()->toDateString(), now()->addDays(8)->toDateString());

        $reponse->assertOk()->assertJsonPath('available', false);
        $this->assertSame([], $reponse->json('alternatives'));

        $identifiants = array_column($reponse->json('suggestions'), 'id');
        $this->assertNotContains($this->room->id, $identifiants);
        $this->assertNotNull($reponse->json('own_window'));
    }

    public function test_sans_appartement_precise_il_n_y_a_pas_de_creneau_propre(): void
    {
        $reponse = $this->postJson("/api/room-categories/{$this->category->slug}/check-availability", [
            'check_in' => now()->addDay()->toDateString(),
            'check_out' => now()->addDays(3)->toDateString(),
        ]);

        $reponse->assertOk()->assertJsonPath('own_window', null);
    }
}
