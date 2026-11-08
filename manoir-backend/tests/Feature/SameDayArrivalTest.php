<?php

namespace Tests\Feature;

use App\Models\Reservation;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Arrivee le jour meme.
 *
 * Un appartement qui se libere le matin doit pouvoir se relouer le soir. La
 * regle precedente expirait la demande des que le jour d'arrivee etait
 * ATTEINT : le client pouvait la creer, l'administrateur ne pouvait jamais la
 * confirmer.
 */
class SameDayArrivalTest extends TestCase
{
    use RefreshDatabase;

    private Room $room;

    private User $admin;

    private User $client;

    protected function setUp(): void
    {
        parent::setUp();

        $this->room = Room::where('apartment_number', 1)->firstOrFail();
        $this->admin = User::factory()->create(['is_admin' => true, 'is_super_admin' => true]);
        $this->client = User::factory()->create();
    }

    private function demande(string $arrivee, string $depart, string $statut = 'EN_ATTENTE'): Reservation
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
            'deposit_amount' => 9000,
            'status' => $statut,
        ]);
    }

    public function test_l_administrateur_peut_confirmer_une_arrivee_du_jour(): void
    {
        $reservation = $this->demande(now()->toDateString(), now()->addDay()->toDateString());

        $this->actingAs($this->admin)
            ->postJson("/api/admin/reservations/{$reservation->id}/approve")
            ->assertOk();

        $this->assertSame('VALIDEE_PAIEMENT_REQUIS', $reservation->fresh()->status);
    }

    public function test_l_echeance_de_paiement_ne_depasse_pas_le_jour_d_arrivee(): void
    {
        $reservation = $this->demande(now()->toDateString(), now()->addDay()->toDateString());

        $this->actingAs($this->admin)
            ->postJson("/api/admin/reservations/{$reservation->id}/approve")
            ->assertOk();

        // Sans plafond, l'echeance tombait 24 h plus tard, soit apres l'arrivee :
        // la demande expirait avant l'echeance et le client payait dans le vide.
        $this->assertTrue(
            $reservation->fresh()->payment_deadline->lessThanOrEqualTo(now()->endOfDay())
        );
    }

    public function test_une_arrivee_passee_reste_refusee(): void
    {
        $reservation = $this->demande(now()->subDay()->toDateString(), now()->toDateString());

        $this->actingAs($this->admin)
            ->postJson("/api/admin/reservations/{$reservation->id}/approve")
            ->assertStatus(422);

        $this->assertSame('EXPIREE', $reservation->fresh()->status);
    }

    public function test_une_reservation_impayee_retient_l_appartement_jusqu_a_l_echeance(): void
    {
        $reservation = $this->demande(
            now()->toDateString(),
            now()->addDay()->toDateString(),
            'VALIDEE_PAIEMENT_REQUIS'
        );
        $reservation->forceFill(['payment_deadline' => now()->addHours(6)])->save();

        $this->assertFalse($this->room->fresh()->isAvailableForDates(
            now()->toDateString(),
            now()->addDay()->toDateString()
        ));

        // Echeance passee : le blocage tombe de lui-meme, sans intervention.
        $reservation->forceFill(['payment_deadline' => now()->subMinute()])->save();

        $this->assertTrue($this->room->fresh()->isAvailableForDates(
            now()->toDateString(),
            now()->addDay()->toDateString()
        ));
    }

    public function test_l_acompte_paye_retient_l_appartement(): void
    {
        $this->demande(
            now()->toDateString(),
            now()->addDay()->toDateString(),
            'CONFIRMEE'
        );

        $this->assertFalse($this->room->fresh()->isAvailableForDates(
            now()->toDateString(),
            now()->addDay()->toDateString()
        ));
    }

    public function test_une_demande_du_jour_ne_s_expire_pas_toute_seule(): void
    {
        $reservation = $this->demande(
            now()->toDateString(),
            now()->addDay()->toDateString(),
            'VALIDEE_PAIEMENT_REQUIS'
        );
        $reservation->forceFill(['payment_deadline' => now()->endOfDay()])->save();

        Reservation::expireOverduePaymentRequests();

        $this->assertFalse($reservation->fresh()->isExpired());
        $this->assertSame('VALIDEE_PAIEMENT_REQUIS', $reservation->fresh()->status);
    }

    public function test_les_dates_sont_transmises_sans_decalage_d_horaire(): void
    {
        $reservation = $this->demande('2026-09-10', '2026-09-13');

        // Serialisee en horodatage UTC, une arrivee le 10 a Cotonou sortait en
        // '2026-09-09T23:00:00Z' et pouvait s'afficher au 9.
        $json = $reservation->fresh()->toArray();

        $this->assertSame('2026-09-10', $json['check_in']);
        $this->assertSame('2026-09-13', $json['check_out']);
    }
}
