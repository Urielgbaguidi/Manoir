<?php

namespace Tests\Feature;

use App\Mail\ManoirNotificationMail;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\StayExtension;
use App\Models\StayVoucher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Prolongation : regles verifiees cote serveur, validation admin, puis
 * paiement.
 */
class StayExtensionTest extends TestCase
{
    use RefreshDatabase;

    private Room $room;

    private User $client;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Mail::fake();
        Http::preventStrayRequests();
        $this->room = Room::where('apartment_number', 1)->firstOrFail();
        $this->client = User::factory()->create();
        $this->admin = User::factory()->admin()->create(['email' => 'admin@manoir.test']);
    }

    private function sejour(string $status = 'SEJOUR_PAYE', int $arriveeIlYA = 2, int $departDans = 2): Reservation
    {
        return Reservation::create([
            'user_id' => $this->client->id,
            'room_id' => $this->room->id,
            'category_type' => $this->room->type,
            'check_in' => now()->subDays($arriveeIlYA)->toDateString(),
            'check_out' => now()->addDays($departDans)->toDateString(),
            'guests' => 1,
            'total_price' => 120000,
            'stay_amount' => 120000,
            'deposit_amount' => 0,
            'status' => $status,
        ]);
    }

    private function demander(Reservation $reservation, int $nuits = 2): TestResponse
    {
        return $this->actingAsJwt($this->client)
            ->withIdempotencyKey()
            ->postJson("/api/reservations/{$reservation->id}/extensions", [
                'new_check_out' => $reservation->check_out->copy()->addDays($nuits)->toDateString(),
            ]);
    }

    public function test_un_client_en_sejour_depuis_au_moins_un_jour_peut_demander_une_prolongation(): void
    {
        $reservation = $this->sejour();

        $this->demander($reservation)
            ->assertCreated()
            ->assertJsonPath('extension.status', StayExtension::STATUS_PENDING)
            ->assertJsonPath('extension.nights', 2);

        $extension = StayExtension::sole();
        $this->assertSame(2 * (int) $this->room->base_price, $extension->amount);
        // Rien ne change avant validation et paiement.
        $this->assertTrue($reservation->fresh()->check_out->isSameDay($reservation->check_out));
        Mail::assertQueued(ManoirNotificationMail::class, fn ($mail) => $mail->hasTo('admin@manoir.test')
            && $mail->details['Type de demande'] === 'Prolongation de séjour');
    }

    public function test_un_sejour_non_paye_ne_peut_pas_etre_prolonge(): void
    {
        $this->demander($this->sejour('VALIDEE_PAIEMENT_REQUIS'))->assertStatus(422);
        $this->demander($this->sejour('EN_ATTENTE'))->assertStatus(422);

        $this->assertSame(0, StayExtension::count());
    }

    public function test_il_faut_au_moins_une_journee_passee_dans_l_appartement(): void
    {
        $this->demander($this->sejour(arriveeIlYA: 0))
            ->assertStatus(422)
            ->assertJsonPath('message', 'Une prolongation n\'est possible qu\'apres au moins une journee passee dans l\'appartement.');
    }

    public function test_un_sejour_termine_ne_peut_plus_etre_prolonge(): void
    {
        $this->demander($this->sejour(arriveeIlYA: 5, departDans: -1))->assertStatus(422);
    }

    public function test_la_nouvelle_date_doit_suivre_le_depart_actuel(): void
    {
        $reservation = $this->sejour();

        $this->actingAsJwt($this->client)
            ->withIdempotencyKey()
            ->postJson("/api/reservations/{$reservation->id}/extensions", ['new_check_out' => $reservation->check_out->toDateString()])
            ->assertStatus(422);
    }

    public function test_une_seule_demande_en_cours_a_la_fois(): void
    {
        $reservation = $this->sejour();

        $this->demander($reservation)->assertCreated();
        $this->demander($reservation, 3)->assertStatus(422);

        $this->assertSame(1, StayExtension::count());
    }

    public function test_les_nuits_deja_prises_ne_peuvent_pas_etre_demandees(): void
    {
        $reservation = $this->sejour();
        Reservation::create([
            'user_id' => User::factory()->create()->id,
            'room_id' => $this->room->id,
            'category_type' => $this->room->type,
            'check_in' => $reservation->check_out->toDateString(),
            'check_out' => $reservation->check_out->copy()->addDays(3)->toDateString(),
            'guests' => 1, 'total_price' => 1, 'stay_amount' => 1, 'status' => 'SEJOUR_PAYE',
        ]);

        $this->demander($reservation)->assertStatus(422);
    }

    public function test_le_paiement_est_impossible_avant_la_validation_admin(): void
    {
        $reservation = $this->sejour();
        $this->demander($reservation)->assertCreated();
        $extension = StayExtension::sole();

        $this->actingAsJwt($this->client)
            ->withIdempotencyKey()
            ->postJson("/api/extensions/{$extension->id}/payments")
            ->assertStatus(422);

        Http::assertNothingSent();
    }

    public function test_validation_puis_paiement_prolonge_le_sejour_et_emet_un_bon(): void
    {
        $reservation = $this->sejour();
        $this->demander($reservation)->assertCreated();
        $extension = StayExtension::sole();

        $this->actingAsJwt($this->admin)
            ->postJson("/api/admin/extensions/{$extension->id}/approve")
            ->assertOk()
            ->assertJsonPath('extension.status', StayExtension::STATUS_AWAITING_PAYMENT);
        Mail::assertQueued(ManoirNotificationMail::class, fn ($mail) => $mail->hasTo($this->client->email));

        // Les nuits sont retenues : personne d'autre ne peut les reserver.
        $this->assertFalse($this->room->isAvailableForDates(
            $extension->previous_check_out->toDateString(),
            $extension->requested_check_out->toDateString()
        ));

        // Le checkout FeexPay est prepare (montant de la prolongation)...
        $prepared = $this->actingAsJwt($this->client)
            ->withIdempotencyKey()
            ->postJson("/api/extensions/{$extension->id}/payments")
            ->assertCreated()
            ->assertJsonPath('checkout.amount', $extension->amount);

        // ... le client paie dans le checkout, puis le serveur verifie aupres de FeexPay.
        Http::fake([
            'https://sandbox-api.feexpay.me/api/transactions/public/single/status/*' => Http::response(['reference' => 'ext-1', 'status' => 'SUCCESSFUL', 'amount' => $extension->amount]),
        ]);

        $this->actingAsJwt($this->client)
            ->postJson('/api/payments/'.$prepared->json('payment.id').'/verify')
            ->assertOk()
            ->assertJsonPath('extension_status', StayExtension::STATUS_PAID);

        $reservation->refresh();
        $this->assertTrue($reservation->check_out->isSameDay($extension->requested_check_out));
        $this->assertSame(120000 + $extension->amount, $reservation->stay_amount);
        $this->assertSame($extension->id, StayVoucher::sole()->stay_extension_id);
    }

    public function test_le_refus_previent_le_client(): void
    {
        $reservation = $this->sejour();
        $this->demander($reservation)->assertCreated();
        $extension = StayExtension::sole();

        $this->actingAsJwt($this->admin)
            ->postJson("/api/admin/extensions/{$extension->id}/reject", ['admin_notes' => 'Appartement reserve'])
            ->assertOk();

        $this->assertSame(StayExtension::STATUS_REJECTED, $extension->fresh()->status);
        Mail::assertQueued(ManoirNotificationMail::class, fn ($mail) => $mail->hasTo($this->client->email));
    }

    public function test_un_client_ne_peut_pas_prolonger_le_sejour_d_un_autre(): void
    {
        $reservation = $this->sejour();
        $intrus = User::factory()->create();

        $this->actingAsJwt($intrus)
            ->withIdempotencyKey()
            ->postJson("/api/reservations/{$reservation->id}/extensions", ['new_check_out' => now()->addDays(5)->toDateString()])
            ->assertNotFound();
    }

    public function test_les_demandes_de_prolongation_sont_filtrables_par_statut(): void
    {
        $reservation = $this->sejour();
        $this->demander($reservation)->assertCreated();
        StayExtension::factory()->forReservation($this->sejour())->create(['status' => StayExtension::STATUS_REJECTED]);

        $this->actingAsJwt($this->admin)
            ->getJson('/api/admin/extensions?status=EN_ATTENTE')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.reservation_id', $reservation->id);
    }
}
