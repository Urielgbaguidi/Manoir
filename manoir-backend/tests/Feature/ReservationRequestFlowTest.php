<?php

namespace Tests\Feature;

use App\Mail\ManoirNotificationMail;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * Demande gratuite -> validation admin -> paiement. Idempotence de la
 * soumission. Filtres de l'administration.
 */
class ReservationRequestFlowTest extends TestCase
{
    use RefreshDatabase;

    private Room $room;

    private User $client;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->room = Room::where('apartment_number', 1)->firstOrFail();
        $this->client = User::factory()->create();
        $this->admin = User::factory()->admin()->create(['email' => 'admin@manoir.test']);
    }

    /**
     * @return array<string, mixed>
     */
    private function demande(int $inDays = 20, int $nights = 2): array
    {
        return [
            'category_type' => $this->room->type,
            'room_id' => $this->room->id,
            'check_in' => now()->addDays($inDays)->toDateString(),
            'check_out' => now()->addDays($inDays + $nights)->toDateString(),
            'guests' => 1,
        ];
    }

    public function test_une_demande_est_gratuite_en_attente_et_previent_l_admin(): void
    {
        Mail::fake();

        $this->actingAsJwt($this->client)
            ->withIdempotencyKey()
            ->postJson('/api/reservations', $this->demande())
            ->assertCreated()
            ->assertJsonPath('reservation.status', 'EN_ATTENTE');

        $reservation = Reservation::sole();
        $this->assertNull($reservation->payment_deadline);
        $this->assertSame(0, $reservation->payments()->count());
        Mail::assertQueued(ManoirNotificationMail::class, fn ($mail) => $mail->hasTo('admin@manoir.test')
            && $mail->details['Type de demande'] === 'Réservation');
    }

    public function test_l_envoi_du_mail_admin_qui_echoue_ne_bloque_pas_la_demande(): void
    {
        Mail::shouldReceive('to')->andThrow(new \RuntimeException('SMTP indisponible'));

        $this->actingAsJwt($this->client)
            ->withIdempotencyKey()
            ->postJson('/api/reservations', $this->demande())
            ->assertCreated();

        $this->assertSame(1, Reservation::count());
    }

    public function test_la_soumission_exige_une_cle_d_idempotence(): void
    {
        $this->actingAsJwt($this->client)
            ->postJson('/api/reservations', $this->demande())
            ->assertStatus(400);

        $this->assertSame(0, Reservation::count());
    }

    public function test_une_requete_rejouee_avec_la_meme_cle_ne_cree_qu_une_demande(): void
    {
        Mail::fake();
        $key = (string) Str::uuid();

        $premiere = $this->actingAsJwt($this->client)->withIdempotencyKey($key)->postJson('/api/reservations', $this->demande());
        $rejouee = $this->actingAsJwt($this->client)->withIdempotencyKey($key)->postJson('/api/reservations', $this->demande());

        $premiere->assertCreated();
        $rejouee->assertCreated()->assertJsonPath('reservation.id', $premiere->json('reservation.id'));
        $this->assertSame(1, Reservation::count());
        Mail::assertQueuedCount(1);
    }

    public function test_la_meme_cle_avec_un_autre_contenu_est_refusee(): void
    {
        Mail::fake();
        $key = (string) Str::uuid();

        $this->actingAsJwt($this->client)->withIdempotencyKey($key)->postJson('/api/reservations', $this->demande(20))->assertCreated();

        $this->actingAsJwt($this->client)
            ->withIdempotencyKey($key)
            ->postJson('/api/reservations', $this->demande(40))
            ->assertStatus(422);

        $this->assertSame(1, Reservation::count());
    }

    /**
     * Deux requetes simultanees avec la meme cle : la seconde arrive pendant
     * que la premiere detient le verrou du package et recoit 409.
     */
    public function test_deux_requetes_simultanees_ne_creent_qu_une_demande(): void
    {
        Mail::fake();
        $key = (string) Str::uuid();
        $storageKey = hash('xxh128', implode('|', ['/api/reservations', 'POST', 'user:'.$this->client->id, 'Idempotency-Key', $key]));
        $lock = Cache::lock('idempotent-lock:'.$storageKey, 10);
        $this->assertTrue($lock->get());

        $this->actingAsJwt($this->client)
            ->withIdempotencyKey($key)
            ->postJson('/api/reservations', $this->demande())
            ->assertStatus(409)
            ->assertHeader('Retry-After', '1');

        $lock->release();

        $this->actingAsJwt($this->client)
            ->withIdempotencyKey($key)
            ->postJson('/api/reservations', $this->demande())
            ->assertCreated();

        $this->assertSame(1, Reservation::count());
    }

    public function test_le_client_ne_peut_pas_payer_avant_la_validation(): void
    {
        Http::preventStrayRequests();
        $reservation = $this->creerDemande();

        $this->actingAsJwt($this->client)
            ->withIdempotencyKey()
            ->postJson("/api/reservations/{$reservation->id}/payments", [
                'payment_method' => 'mobile_money',
                'channel' => 'mtn',
                'phone_number' => '22997000000',
            ])
            ->assertStatus(422);

        $this->assertSame(0, $reservation->payments()->count());
    }

    public function test_la_validation_ouvre_le_paiement_et_previent_le_client(): void
    {
        Mail::fake();
        $reservation = $this->creerDemande();

        $this->actingAsJwt($this->admin)
            ->postJson("/api/admin/reservations/{$reservation->id}/approve")
            ->assertOk()
            ->assertJsonPath('reservation.status', 'VALIDEE_PAIEMENT_REQUIS');

        $this->assertNotNull($reservation->fresh()->payment_deadline);
        Mail::assertQueued(ManoirNotificationMail::class, fn ($mail) => $mail->hasTo($this->client->email)
            && str_contains($mail->mailSubject, 'validée'));
    }

    public function test_le_refus_previent_le_client(): void
    {
        Mail::fake();
        $reservation = $this->creerDemande();

        $this->actingAsJwt($this->admin)
            ->postJson("/api/admin/reservations/{$reservation->id}/reject", ['admin_notes' => 'Complet'])
            ->assertOk();

        $this->assertSame('REFUSEE', $reservation->fresh()->status);
        Mail::assertQueued(ManoirNotificationMail::class, fn ($mail) => $mail->hasTo($this->client->email));
    }

    public function test_un_client_ne_peut_pas_valider_une_demande(): void
    {
        $reservation = $this->creerDemande();

        $this->actingAsJwt($this->client)
            ->postJson("/api/admin/reservations/{$reservation->id}/approve")
            ->assertForbidden();

        $this->assertSame('EN_ATTENTE', $reservation->fresh()->status);
    }

    public function test_les_filtres_admin_par_statut_appartement_periode_et_client(): void
    {
        $autreRoom = Room::where('apartment_number', 2)->firstOrFail();
        $cible = $this->creerDemande(['check_in' => now()->addDays(10)->toDateString(), 'check_out' => now()->addDays(12)->toDateString()]);
        $this->creerDemande(['status' => 'REFUSEE']);
        $this->creerDemande(['room_id' => $autreRoom->id]);
        $autreClient = User::factory()->create(['name' => 'Zacharie Inconnu']);
        $this->creerDemande(['user_id' => $autreClient->id, 'check_in' => now()->addDays(60)->toDateString(), 'check_out' => now()->addDays(62)->toDateString()]);

        $this->actingAsJwt($this->admin);

        $this->getJson('/api/admin/reservations?status=REFUSEE')->assertJsonPath('total', 1);
        $this->getJson("/api/admin/reservations?room_id={$autreRoom->id}")->assertJsonPath('total', 1);
        $this->getJson('/api/admin/reservations?client=Zacharie')->assertJsonPath('total', 1);
        $this->getJson('/api/admin/reservations?date_from='.now()->addDays(9)->toDateString().'&date_to='.now()->addDays(11)->toDateString())
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.id', $cible->id);
        $this->getJson('/api/admin/reservations?status=EN_ATTENTE,REFUSEE&per_page=2')
            ->assertJsonPath('total', 4)
            ->assertJsonCount(2, 'data');
    }

    public function test_un_filtre_invalide_est_refuse(): void
    {
        $this->actingAsJwt($this->admin)
            ->getJson('/api/admin/reservations?date_from=hier')
            ->assertStatus(422)
            ->assertJsonValidationErrors('date_from');
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function creerDemande(array $overrides = []): Reservation
    {
        return Reservation::create(array_merge([
            'user_id' => $this->client->id,
            'room_id' => $this->room->id,
            'category_type' => $this->room->type,
            'check_in' => now()->addDays(20)->toDateString(),
            'check_out' => now()->addDays(22)->toDateString(),
            'guests' => 1,
            'total_price' => 60000,
            'stay_amount' => 60000,
            'deposit_amount' => 0,
            'status' => 'EN_ATTENTE',
        ], $overrides));
    }
}
