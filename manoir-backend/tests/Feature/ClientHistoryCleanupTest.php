<?php

namespace Tests\Feature;

use App\Models\Reservation;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Nettoyage de l'historique par le client.
 *
 * Le client masque ce qu'il ne veut plus voir. Rien n'est supprime : factures,
 * bons d'annulation et montants encaisses doivent rester consultables par
 * l'administration et opposables en cas de litige.
 */
class ClientHistoryCleanupTest extends TestCase
{
    use RefreshDatabase;

    private User $client;

    private Room $room;

    protected function setUp(): void
    {
        parent::setUp();

        $this->client = User::factory()->create(['email_verified_at' => now()]);
        $this->room = Room::where('apartment_number', 1)->firstOrFail();
    }

    private function reservation(string $statut, ?string $depart = null): Reservation
    {
        return Reservation::create([
            'user_id' => $this->client->id,
            'room_id' => $this->room->id,
            'category_type' => $this->room->type,
            'check_in' => now()->subDays(5)->toDateString(),
            'check_out' => $depart ?? now()->subDays(3)->toDateString(),
            'guests' => 2,
            'total_price' => 30000,
            'stay_amount' => 30000,
            'deposit_amount' => 9000,
            'status' => $statut,
        ]);
    }

    public function test_une_reservation_masquee_disparait_de_la_liste_du_client(): void
    {
        $reservation = $this->reservation('ANNULEE');

        $this->actingAs($this->client)
            ->postJson("/api/reservations/{$reservation->id}/masquer")
            ->assertOk();

        $this->actingAs($this->client)
            ->getJson('/api/reservations')
            ->assertOk()
            ->assertJsonCount(0);
    }

    public function test_rien_n_est_supprime_de_la_base(): void
    {
        $reservation = $this->reservation('ANNULEE');

        $this->actingAs($this->client)
            ->postJson("/api/reservations/{$reservation->id}/masquer")
            ->assertOk();

        // La ligne, ses montants et ses documents restent intacts.
        $this->assertDatabaseHas('reservations', [
            'id' => $reservation->id,
            'status' => 'ANNULEE',
            'deposit_amount' => 9000,
        ]);
        $this->assertNotNull($reservation->fresh()->client_hidden_at);
    }

    public function test_une_reservation_en_cours_ne_peut_pas_etre_masquee(): void
    {
        $reservation = $this->reservation('CONFIRMEE', now()->addDays(5)->toDateString());

        // Sans ce garde, le client masquerait un sejour a venir et perdrait
        // l'acces a son paiement comme a sa reservation.
        $this->actingAs($this->client)
            ->postJson("/api/reservations/{$reservation->id}/masquer")
            ->assertStatus(422);

        $this->assertNull($reservation->fresh()->client_hidden_at);
    }

    public function test_un_sejour_paye_non_termine_ne_peut_pas_etre_masque(): void
    {
        $reservation = $this->reservation('SEJOUR_PAYE', now()->addDays(2)->toDateString());

        $this->actingAs($this->client)
            ->postJson("/api/reservations/{$reservation->id}/masquer")
            ->assertStatus(422);
    }

    public function test_vider_l_historique_masque_tout_ce_qui_est_termine(): void
    {
        $this->reservation('ANNULEE');
        $this->reservation('EXPIREE');
        $this->reservation('REFUSEE');
        $enCours = $this->reservation('CONFIRMEE', now()->addDays(5)->toDateString());

        $this->actingAs($this->client)
            ->postJson('/api/reservations/vider-historique')
            ->assertOk()
            ->assertJsonPath('hidden', 3);

        // Le sejour a venir reste : vider l'historique ne touche pas au present.
        $this->actingAs($this->client)
            ->getJson('/api/reservations')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $enCours->id);
    }

    public function test_un_client_ne_peut_pas_masquer_la_reservation_d_un_autre(): void
    {
        $reservation = $this->reservation('ANNULEE');
        $intrus = User::factory()->create(['email_verified_at' => now()]);

        $this->actingAs($intrus)
            ->postJson("/api/reservations/{$reservation->id}/masquer")
            ->assertNotFound();

        $this->assertNull($reservation->fresh()->client_hidden_at);
    }
}
