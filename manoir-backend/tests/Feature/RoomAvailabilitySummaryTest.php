<?php

namespace Tests\Feature;

use App\Models\Reservation;
use App\Models\Room;
use App\Models\RoomBlock;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Voyant vert / rouge affiche au client sur chaque appartement.
 */
class RoomAvailabilitySummaryTest extends TestCase
{
    use RefreshDatabase;

    private Room $room;

    protected function setUp(): void
    {
        parent::setUp();
        $this->room = Room::where('apartment_number', 1)->firstOrFail();
    }

    private function bloquer(string $du, string $au, string $uid): void
    {
        RoomBlock::create([
            'room_id' => $this->room->id,
            'starts_on' => $du,
            'ends_on' => $au,
            'source' => RoomBlock::SOURCE_GOOGLE,
            'external_id' => $uid,
        ]);
    }

    private function resume(): array
    {
        return $this->room->fresh()->availabilitySummary();
    }

    public function test_sans_occupation_l_appartement_est_libre_sans_limite(): void
    {
        $resume = $this->resume();

        $this->assertSame('free', $resume['status']);
        $this->assertNull($resume['free_until']);
    }

    public function test_une_occupation_en_cours_donne_la_date_de_liberation(): void
    {
        $this->bloquer(now()->subDays(3)->toDateString(), now()->addDays(2)->toDateString(), 'e1');

        $resume = $this->resume();

        $this->assertSame('occupied', $resume['status']);
        $this->assertSame(now()->addDays(2)->toDateString(), $resume['occupied_until']);
    }

    public function test_une_occupation_future_laisse_l_appartement_libre_jusque_la(): void
    {
        $this->bloquer(now()->addDays(5)->toDateString(), now()->addDays(8)->toDateString(), 'e1');

        $resume = $this->resume();

        $this->assertSame('free', $resume['status']);
        $this->assertSame(now()->addDays(5)->toDateString(), $resume['free_until']);
    }

    public function test_des_occupations_qui_se_suivent_sont_fusionnees(): void
    {
        // Trois sejours bout a bout : annoncer « libre » a la premiere date de
        // fin serait faux, un autre client arrive le meme jour.
        $this->bloquer(now()->subDay()->toDateString(), now()->addDays(2)->toDateString(), 'e1');
        $this->bloquer(now()->addDays(2)->toDateString(), now()->addDays(4)->toDateString(), 'e2');
        $this->bloquer(now()->addDays(4)->toDateString(), now()->addDays(7)->toDateString(), 'e3');

        $resume = $this->resume();

        $this->assertSame('occupied', $resume['status']);
        $this->assertSame(now()->addDays(7)->toDateString(), $resume['occupied_until']);
    }

    public function test_une_coupure_entre_deux_occupations_est_respectee(): void
    {
        $this->bloquer(now()->subDay()->toDateString(), now()->addDays(2)->toDateString(), 'e1');
        // Trou de 3 jours, puis nouvelle occupation.
        $this->bloquer(now()->addDays(5)->toDateString(), now()->addDays(9)->toDateString(), 'e2');

        $resume = $this->resume();

        $this->assertSame('occupied', $resume['status']);
        $this->assertSame(now()->addDays(2)->toDateString(), $resume['occupied_until']);
    }

    public function test_une_reservation_du_site_compte_aussi(): void
    {
        $user = User::factory()->create(['email_verified_at' => now()]);
        Reservation::create([
            'user_id' => $user->id,
            'room_id' => $this->room->id,
            'category_type' => $this->room->type,
            'check_in' => now()->subDay()->toDateString(),
            'check_out' => now()->addDays(3)->toDateString(),
            'guests' => 1,
            'total_price' => 1,
            'deposit_amount' => 1,
            'stay_amount' => 1,
            'status' => 'CONFIRMEE',
        ]);

        $resume = $this->resume();

        $this->assertSame('occupied', $resume['status']);
        $this->assertSame(now()->addDays(3)->toDateString(), $resume['occupied_until']);
    }

    public function test_un_appartement_hors_service_est_signale_comme_tel(): void
    {
        $this->room->update(['status' => 'unavailable']);

        $this->assertSame('unavailable', $this->resume()['status']);
    }

    public function test_les_occupations_passees_sont_ignorees(): void
    {
        $this->bloquer(now()->subDays(10)->toDateString(), now()->subDays(5)->toDateString(), 'vieux');

        $resume = $this->resume();

        $this->assertSame('free', $resume['status']);
        $this->assertNull($resume['free_until']);
    }
}
