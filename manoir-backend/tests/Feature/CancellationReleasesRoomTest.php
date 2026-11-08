<?php

namespace Tests\Feature;

use App\Models\Reservation;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Annulation par le client : la periode doit se reliberer aussitot.
 *
 * Un appartement qui reste barre apres une annulation est une nuit perdue, et
 * personne ne s'en apercoit avant que le client suivant ne se voie refuser des
 * dates pourtant libres.
 */
class CancellationReleasesRoomTest extends TestCase
{
    use RefreshDatabase;

    private Room $room;

    private User $client;

    protected function setUp(): void
    {
        parent::setUp();

        Mail::fake();
        Http::fake();

        $this->room = Room::where('apartment_number', 1)->firstOrFail();
        $this->client = User::factory()->create();
    }

    private function reserver(string $arrivee, string $depart, string $statut): Reservation
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
            'deposit_daily_rate' => 0,
            'status' => $statut,
            'payment_deadline' => now()->endOfDay(),
        ]);
    }

    public function test_annuler_relibere_l_appartement_sur_les_memes_dates(): void
    {
        $arrivee = now()->addDays(3)->toDateString();
        $depart = now()->addDays(5)->toDateString();

        // Acompte encaisse : c'est ce qui retient reellement l'appartement.
        $reservation = $this->reserver($arrivee, $depart, 'CONFIRMEE');

        $this->assertFalse($this->room->fresh()->isAvailableForDates($arrivee, $depart));

        $this->actingAs($this->client)
            ->postJson("/api/reservations/{$reservation->id}/cancel")
            ->assertOk();

        $this->assertSame('ANNULEE', $reservation->fresh()->status);
        $this->assertTrue($this->room->fresh()->isAvailableForDates($arrivee, $depart));
    }

    public function test_une_reservation_pour_ce_soir_reste_annulable(): void
    {
        $reservation = $this->reserver(
            now()->toDateString(),
            now()->addDay()->toDateString(),
            'VALIDEE_PAIEMENT_REQUIS'
        );

        $this->actingAs($this->client)
            ->postJson("/api/reservations/{$reservation->id}/cancel")
            ->assertOk();

        $this->assertSame('ANNULEE', $reservation->fresh()->status);
        $this->assertTrue($this->room->fresh()->isAvailableForDates(
            now()->toDateString(),
            now()->addDay()->toDateString()
        ));
    }

    public function test_une_arrivee_passee_n_est_plus_annulable(): void
    {
        $reservation = $this->reserver(
            now()->subDays(2)->toDateString(),
            now()->addDay()->toDateString(),
            'CONFIRMEE'
        );

        $this->actingAs($this->client)
            ->postJson("/api/reservations/{$reservation->id}/cancel")
            ->assertStatus(422);

        $this->assertSame('CONFIRMEE', $reservation->fresh()->status);
    }

    public function test_l_evenement_de_l_agenda_google_est_retire(): void
    {
        config([
            'calendar_sync.write.enabled' => true,
            'calendar_sync.write.credentials' => $this->cleFactice(),
            'calendar_sync.write.calendars' => [1 => 'appartement1@group.calendar.google.com'],
        ]);
        cache()->put('google-calendar:access-token', 'jeton-de-test', 600);

        $reservation = $this->reserver(
            now()->addDays(3)->toDateString(),
            now()->addDays(5)->toDateString(),
            'CONFIRMEE'
        );
        $reservation->forceFill(['google_event_id' => 'evt123'])->save();

        Http::fake(['www.googleapis.com/*' => Http::response('', 204)]);

        $this->actingAs($this->client)
            ->postJson("/api/reservations/{$reservation->id}/cancel")
            ->assertOk();

        Http::assertSent(fn ($requete) => $requete->method() === 'DELETE'
            && str_contains($requete->url(), '/events/evt123'));

        $this->assertNull($reservation->fresh()->google_event_id);
    }

    private function cleFactice(): string
    {
        $chemin = storage_path('framework/testing/faux-compte-service.json');

        if (! is_dir(dirname($chemin))) {
            mkdir(dirname($chemin), 0777, true);
        }

        file_put_contents($chemin, json_encode([
            'client_email' => 'test@exemple.iam.gserviceaccount.com',
            'private_key' => '-- cle de test --',
        ]));

        return $chemin;
    }
}
