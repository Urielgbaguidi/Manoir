<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\RoomBlock;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RoomBlockTest extends TestCase
{
    use RefreshDatabase;

    private function chambre(): Room
    {
        return Room::create([
            'name' => 'Appartement test',
            'slug' => 'appartement-test',
            'description' => 'test',
            'max_occupants' => 2,
            'apartment_number' => 99,
            'base_price' => 30000,
            'deposit' => 100000,
            'type' => 'une_chambre',
            'status' => 'available',
        ]);
    }

    private function bloquer(Room $room, string $du, string $au): RoomBlock
    {
        return RoomBlock::create([
            'room_id' => $room->id,
            'starts_on' => $du,
            'ends_on' => $au,
            'source' => RoomBlock::SOURCE_GOOGLE,
            'external_id' => 'evt-'.$du,
            'summary' => 'Reservation telephonique',
        ]);
    }

    public function test_un_appartement_sans_blocage_reste_disponible(): void
    {
        $room = $this->chambre();

        $this->assertTrue($room->isAvailableForDates('2026-09-10', '2026-09-12'));
    }

    public function test_un_blocage_rend_l_appartement_indisponible(): void
    {
        $room = $this->chambre();
        $this->bloquer($room, '2026-09-08', '2026-09-15');

        $this->assertFalse($room->fresh()->isAvailableForDates('2026-09-10', '2026-09-12'));
    }

    public function test_un_sejour_qui_chevauche_le_debut_du_blocage_est_refuse(): void
    {
        $room = $this->chambre();
        $this->bloquer($room, '2026-09-10', '2026-09-15');

        $this->assertFalse($room->fresh()->isAvailableForDates('2026-09-08', '2026-09-11'));
    }

    public function test_un_sejour_qui_chevauche_la_fin_du_blocage_est_refuse(): void
    {
        $room = $this->chambre();
        $this->bloquer($room, '2026-09-10', '2026-09-15');

        $this->assertFalse($room->fresh()->isAvailableForDates('2026-09-14', '2026-09-18'));
    }

    public function test_une_arrivee_le_jour_du_depart_reste_possible(): void
    {
        $room = $this->chambre();
        $this->bloquer($room, '2026-09-10', '2026-09-15');

        // Le client precedent part le 15 : la nuit du 15 est libre.
        $this->assertTrue($room->fresh()->isAvailableForDates('2026-09-15', '2026-09-18'));
    }

    public function test_un_depart_le_jour_de_l_arrivee_du_blocage_reste_possible(): void
    {
        $room = $this->chambre();
        $this->bloquer($room, '2026-09-10', '2026-09-15');

        $this->assertTrue($room->fresh()->isAvailableForDates('2026-09-05', '2026-09-10'));
    }

    public function test_le_blocage_ne_touche_pas_les_autres_appartements(): void
    {
        $room = $this->chambre();
        $autre = Room::create([
            'name' => 'Autre appartement',
            'slug' => 'autre-appartement',
            'description' => 'test',
            'max_occupants' => 2,
            'apartment_number' => 98,
            'base_price' => 30000,
            'deposit' => 100000,
            'type' => 'une_chambre',
            'status' => 'available',
        ]);
        $this->bloquer($room, '2026-09-08', '2026-09-15');

        $this->assertFalse($room->fresh()->isAvailableForDates('2026-09-10', '2026-09-12'));
        $this->assertTrue($autre->fresh()->isAvailableForDates('2026-09-10', '2026-09-12'));
    }

    public function test_un_meme_evenement_ne_peut_pas_creer_deux_blocages(): void
    {
        $room = $this->chambre();
        $this->bloquer($room, '2026-09-10', '2026-09-15');

        $this->expectException(QueryException::class);
        $this->bloquer($room, '2026-09-10', '2026-09-15');
    }
}
