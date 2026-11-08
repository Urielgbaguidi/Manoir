<?php

namespace Tests\Feature;

use App\Models\Reservation;
use App\Models\Room;
use App\Models\RoomCategory;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Reservation directe : plus de validation par l'administration.
 *
 * Reserver retient l'appartement le temps du paiement. Le client n'attend plus
 * de reponse : il paie, et son sejour est ferme. Sans paiement dans le delai,
 * le logement repart a la location de lui-meme.
 */
class DirectBookingHoldTest extends TestCase
{
    use RefreshDatabase;

    private Room $room;

    private RoomCategory $category;

    private User $client;

    protected function setUp(): void
    {
        parent::setUp();

        config(['booking.hold_hours' => 12]);

        $this->room = Room::where('apartment_number', 1)->firstOrFail();
        $this->category = RoomCategory::where('type', $this->room->type)->firstOrFail();
        $this->client = User::factory()->create(['email_verified_at' => now()]);
    }

    private function reserver(?string $arrivee = null, ?string $depart = null)
    {
        return $this->actingAs($this->client)->postJson('/api/reservations', [
            'category_type' => $this->category->type,
            'room_id' => $this->room->id,
            'check_in' => $arrivee ?? now()->addDays(4)->toDateString(),
            'check_out' => $depart ?? now()->addDays(6)->toDateString(),
            'guests' => 2,
        ]);
    }

    public function test_reserver_ouvre_directement_le_paiement(): void
    {
        $this->reserver()
            ->assertCreated()
            ->assertJsonPath('reservation.status', 'VALIDEE_PAIEMENT_REQUIS');

        // Aucune demande n'attend plus une validation : le statut EN_ATTENTE
        // n'est plus produit par le parcours client.
        $this->assertSame(0, Reservation::where('status', 'EN_ATTENTE')->count());
    }

    public function test_l_echeance_est_fixee_au_delai_de_blocage(): void
    {
        $reponse = $this->reserver();

        $echeance = Reservation::findOrFail($reponse->json('reservation.id'))->payment_deadline;

        $this->assertTrue($echeance->greaterThan(now()->addHours(11)));
        $this->assertTrue($echeance->lessThanOrEqualTo(now()->addHours(12)));
    }

    public function test_une_arrivee_proche_raccourcit_l_echeance(): void
    {
        // 12 h depuis maintenant depasserait le jour d'arrivee : l'echeance est
        // ramenee a la fin de cette journee, sinon la reservation expirerait
        // avant l'heure annoncee.
        $reponse = $this->reserver(now()->toDateString(), now()->addDay()->toDateString());

        $echeance = Reservation::findOrFail($reponse->json('reservation.id'))->payment_deadline;

        $this->assertTrue($echeance->lessThanOrEqualTo(now()->endOfDay()));
    }

    public function test_le_message_annonce_le_montant_et_l_heure_limite(): void
    {
        $message = $this->reserver()->json('message');

        $this->assertStringContainsString('retenu', $message);
        $this->assertStringContainsString('acompte', $message);
    }

    public function test_un_second_client_ne_peut_pas_prendre_les_memes_dates(): void
    {
        $arrivee = now()->addDays(4)->toDateString();
        $depart = now()->addDays(6)->toDateString();

        $this->reserver($arrivee, $depart)->assertCreated();

        $autre = User::factory()->create(['email_verified_at' => now()]);

        $this->actingAs($autre)->postJson('/api/reservations', [
            'category_type' => $this->category->type,
            'room_id' => $this->room->id,
            'check_in' => $arrivee,
            'check_out' => $depart,
            'guests' => 2,
        ])->assertStatus(422);
    }

    public function test_l_appartement_repart_a_la_location_apres_l_echeance(): void
    {
        $arrivee = now()->addDays(4)->toDateString();
        $depart = now()->addDays(6)->toDateString();

        $reponse = $this->reserver($arrivee, $depart);

        Reservation::findOrFail($reponse->json('reservation.id'))
            ->forceFill(['payment_deadline' => now()->subMinute()])
            ->save();

        $autre = User::factory()->create(['email_verified_at' => now()]);

        $this->actingAs($autre)->postJson('/api/reservations', [
            'category_type' => $this->category->type,
            'room_id' => $this->room->id,
            'check_in' => $arrivee,
            'check_out' => $depart,
            'guests' => 2,
        ])->assertCreated();
    }
}
