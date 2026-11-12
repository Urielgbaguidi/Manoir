<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\StayVoucher;
use App\Models\User;
use App\Services\Payments\PaymentService;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request as HttpRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * Paiement via le checkout officiel FeexPay (SANDBOX, sans webhook).
 * Toutes les reponses FeexPay sont simulees : aucun appel reel n'est emis.
 */
class FeexPayPaymentTest extends TestCase
{
    use RefreshDatabase;

    private const STATUS_URL = 'https://sandbox-api.feexpay.me/api/transactions/public/single/status/*';

    private User $client;

    private Reservation $reservation;

    protected function setUp(): void
    {
        parent::setUp();

        Http::preventStrayRequests();
        Mail::fake();

        $room = Room::where('apartment_number', 1)->firstOrFail();
        $this->client = User::factory()->create();
        $this->reservation = Reservation::create([
            'user_id' => $this->client->id,
            'room_id' => $room->id,
            'category_type' => $room->type,
            'check_in' => now()->addDays(10)->toDateString(),
            'check_out' => now()->addDays(12)->toDateString(),
            'guests' => 1,
            'total_price' => 60000,
            'stay_amount' => 60000,
            'deposit_amount' => 0,
            'status' => 'VALIDEE_PAIEMENT_REQUIS',
            'approved_at' => now(),
            'payment_deadline' => now()->addHours(12),
        ]);
    }

    private function preparer(?string $key = null): TestResponse
    {
        return $this->actingAsJwt($this->client)
            ->withIdempotencyKey($key)
            ->postJson("/api/reservations/{$this->reservation->id}/payments");
    }

    private function verifier(int $paymentId, ?string $reference = null): TestResponse
    {
        return $this->actingAsJwt($this->client)
            ->postJson("/api/payments/{$paymentId}/verify", array_filter(['reference' => $reference]));
    }

    private function fakeStatus(string $status, int $amount = 60000, string $reference = 'ref-123'): void
    {
        Http::fake([
            self::STATUS_URL => Http::response(['reference' => $reference, 'status' => $status, 'amount' => $amount, 'reason' => '']),
        ]);
    }

    public function test_la_preparation_renvoie_la_configuration_du_checkout_sans_appeler_feexpay(): void
    {
        Http::fake();

        $response = $this->preparer()
            ->assertCreated()
            ->assertJsonPath('payment.status', 'pending')
            ->assertJsonPath('checkout.amount', 60000)
            ->assertJsonPath('checkout.id', 'shop_phpunit')
            ->assertJsonPath('checkout.token', 'test_key_phpunit')
            ->assertJsonPath('checkout.mode', 'SANDBOX')
            ->assertJsonPath('checkout.currency', 'XOF');

        $payment = Payment::sole();
        $this->assertSame('checkout', $payment->payment_method);
        $this->assertTrue(Str::isUuid($response->json('checkout.custom_id')));
        $this->assertSame($payment->idempotency_key, $response->json('checkout.custom_id'));
        $this->assertSame($payment->transaction_id, $response->json('checkout.description'));
        $this->assertDoesNotMatchRegularExpression('/\s/', $payment->transaction_id);
        $this->assertLessThanOrEqual(40, strlen($payment->transaction_id));
        Http::assertNothingSent();
    }

    public function test_la_cle_n_est_jamais_renvoyee_hors_preparation(): void
    {
        Http::fake();
        $paymentId = $this->preparer()->json('payment.id');

        $this->actingAsJwt($this->client)
            ->getJson("/api/payments/{$paymentId}/status")
            ->assertOk()
            ->assertJsonPath('checkout', null);
    }

    public function test_un_paiement_confirme_par_feexpay_genere_un_seul_bon_de_sejour(): void
    {
        $paymentId = $this->preparer()->json('payment.id');
        $this->fakeStatus('SUCCESSFUL');

        $this->verifier($paymentId)
            ->assertOk()
            ->assertJsonPath('payment.status', 'success')
            ->assertJsonPath('reservation_status', 'SEJOUR_PAYE');

        $voucher = StayVoucher::sole();
        $this->assertSame('ref-123', $voucher->transaction_reference);
        $this->assertSame($voucher->number, $this->reservation->fresh()->stay_invoice_number);

        // La transaction est retrouvee par la description fixee par le serveur.
        $payment = Payment::findOrFail($paymentId);
        Http::assertSent(fn (HttpRequest $request) => str_contains($request->url(), '/single/status/'.$payment->transaction_id)
            && str_contains($request->url(), 'by=description')
            && $request->header('Authorization')[0] === 'Bearer test_key_phpunit');
    }

    public function test_la_confirmation_sandbox_du_sdk_marque_le_paiement_paye_quand_elle_est_autorisee(): void
    {
        config(['feexpay.sandbox_trust_sdk' => true]);
        Http::fake();

        $paymentId = $this->preparer()->json('payment.id');
        $payment = Payment::findOrFail($paymentId);

        $this->actingAsJwt($this->client)
            ->postJson("/api/payments/{$paymentId}/sandbox-confirm", [
                'description' => $payment->transaction_id,
                'callback_info' => ['payment_id' => $payment->id],
            ])
            ->assertOk()
            ->assertJsonPath('payment.status', 'success')
            ->assertJsonPath('reservation_status', 'SEJOUR_PAYE');

        $voucher = StayVoucher::sole();
        $this->assertStringStartsWith('SANDBOX-', $voucher->transaction_reference);
        $this->assertSame($voucher->number, $this->reservation->fresh()->stay_invoice_number);
        Http::assertNothingSent();
    }

    public function test_la_confirmation_sandbox_est_refusee_si_le_drapeau_est_desactive(): void
    {
        config(['feexpay.sandbox_trust_sdk' => false]);
        Http::fake();

        $paymentId = $this->preparer()->json('payment.id');
        $payment = Payment::findOrFail($paymentId);

        $this->actingAsJwt($this->client)
            ->postJson("/api/payments/{$paymentId}/sandbox-confirm", [
                'description' => $payment->transaction_id,
                'callback_info' => ['payment_id' => $payment->id],
            ])
            ->assertStatus(403);

        $this->assertSame('pending', Payment::findOrFail($paymentId)->status);
        $this->assertSame(0, StayVoucher::count());
    }

    public function test_la_confirmation_sandbox_refuse_une_description_etrangere(): void
    {
        config(['feexpay.sandbox_trust_sdk' => true]);
        Http::fake();

        $paymentId = $this->preparer()->json('payment.id');

        $this->actingAsJwt($this->client)
            ->postJson("/api/payments/{$paymentId}/sandbox-confirm", [
                'description' => 'AUTREPAIEMENT',
                'callback_info' => ['payment_id' => $paymentId],
            ])
            ->assertStatus(422);

        $this->assertSame(0, StayVoucher::count());
    }

    public function test_la_confirmation_declenchee_plusieurs_fois_ne_produit_qu_un_bon(): void
    {
        $paymentId = $this->preparer()->json('payment.id');
        $this->fakeStatus('SUCCESSFUL');

        $this->verifier($paymentId)->assertJsonPath('payment.status', 'success');
        $this->verifier($paymentId)->assertOk();

        $service = app(PaymentService::class);
        $service->applyProviderStatus(Payment::findOrFail($paymentId), 'SUCCESSFUL', null, ['amount' => 60000]);
        $service->handleProviderNotification('ref-123', 'SUCCESSFUL', ['amount' => 60000]);

        $this->assertSame(1, StayVoucher::count());
        Mail::assertQueuedCount(1);
    }

    public function test_un_bon_ne_peut_pas_etre_emis_deux_fois_pour_la_meme_reference(): void
    {
        $paymentId = $this->preparer()->json('payment.id');
        $this->fakeStatus('SUCCESSFUL');
        $this->verifier($paymentId)->assertOk();

        $this->expectException(UniqueConstraintViolationException::class);

        StayVoucher::create([
            'payment_id' => $paymentId,
            'reservation_id' => $this->reservation->id,
            'number' => 'BS-DOUBLON',
            'transaction_reference' => 'ref-123',
            'amount' => 60000,
            'issued_at' => now(),
        ]);
    }

    public function test_l_operateur_annonce_par_feexpay_est_enregistre(): void
    {
        $paymentId = $this->preparer()->json('payment.id');
        Http::fake([
            self::STATUS_URL => Http::response(['reference' => 'ref-123', 'status' => 'SUCCESSFUL', 'amount' => 60000, 'reseau' => 'MOOV TG']),
        ]);

        $this->verifier($paymentId)->assertOk()->assertJsonPath('payment.channel', 'moov');
    }

    public function test_l_operateur_du_checkout_sert_d_affichage_quand_feexpay_ne_le_donne_pas(): void
    {
        $paymentId = $this->preparer()->json('payment.id');
        $this->fakeStatus('PENDING');

        $this->actingAsJwt($this->client)
            ->postJson("/api/payments/{$paymentId}/verify", ['network' => 'mtn'])
            ->assertOk()
            ->assertJsonPath('payment.status', 'pending')
            ->assertJsonPath('payment.channel', 'mtn');
    }

    public function test_un_operateur_inconnu_n_est_pas_enregistre(): void
    {
        $paymentId = $this->preparer()->json('payment.id');
        $this->fakeStatus('PENDING');

        $this->actingAsJwt($this->client)
            ->postJson("/api/payments/{$paymentId}/verify", ['network' => 'operateur pirate'])
            ->assertOk()
            ->assertJsonPath('payment.channel', null);
    }

    public function test_un_checkout_non_paye_reste_en_attente(): void
    {
        $paymentId = $this->preparer()->json('payment.id');
        Http::fake([self::STATUS_URL => Http::response(['message' => 'Not found'], 404)]);

        $this->verifier($paymentId)->assertOk()->assertJsonPath('payment.status', 'pending');

        $this->assertSame('VALIDEE_PAIEMENT_REQUIS', $this->reservation->fresh()->status);
        $this->assertSame(0, StayVoucher::count());
    }

    public function test_la_reference_du_navigateur_n_est_retenue_que_si_elle_correspond_au_paiement(): void
    {
        $paymentId = $this->preparer()->json('payment.id');

        // Introuvable par description, et la reference fournie appartient a
        // une autre transaction (autre description).
        Http::fake(function (HttpRequest $request) {
            if (str_contains($request->url(), 'by=description')) {
                return Http::response(['message' => 'Not found'], 404);
            }

            return Http::response(['reference' => 'autre-ref', 'status' => 'SUCCESSFUL', 'amount' => 60000, 'description' => 'AUTRECOMMANDE']);
        });

        $this->verifier($paymentId, 'autre-ref')->assertOk()->assertJsonPath('payment.status', 'pending');

        $this->assertNull(Payment::findOrFail($paymentId)->provider_reference);
        $this->assertSame(0, StayVoucher::count());
    }

    public function test_la_reference_du_navigateur_est_acceptee_quand_feexpay_confirme_qu_elle_correspond(): void
    {
        $paymentId = $this->preparer()->json('payment.id');
        $description = Payment::findOrFail($paymentId)->transaction_id;

        Http::fake(function (HttpRequest $request) use ($description) {
            if (str_contains($request->url(), 'by=description')) {
                return Http::response(['message' => 'Not found'], 404);
            }

            return Http::response(['reference' => 'ref-ok', 'status' => 'SUCCESSFUL', 'amount' => 60000, 'description' => $description]);
        });

        $this->verifier($paymentId, 'ref-ok')->assertOk()->assertJsonPath('payment.status', 'success');
        $this->assertSame('ref-ok', StayVoucher::sole()->transaction_reference);
    }

    public function test_une_reference_deja_utilisee_ne_peut_pas_regler_un_second_paiement(): void
    {
        $premier = $this->preparer()->json('payment.id');
        $this->fakeStatus('SUCCESSFUL');
        $this->verifier($premier)->assertJsonPath('payment.status', 'success');

        $autre = Reservation::create(array_merge($this->reservation->only([
            'user_id', 'room_id', 'category_type', 'guests', 'total_price', 'stay_amount', 'deposit_amount', 'status', 'approved_at', 'payment_deadline',
        ]), ['check_in' => now()->addDays(30)->toDateString(), 'check_out' => now()->addDays(32)->toDateString()]));

        $second = $this->actingAsJwt($this->client)->withIdempotencyKey()->postJson("/api/reservations/{$autre->id}/payments")->json('payment.id');
        $this->fakeStatus('SUCCESSFUL');

        $this->verifier($second)->assertOk()->assertJsonPath('payment.status', 'pending');
        $this->assertSame(1, StayVoucher::count());
    }

    public function test_un_montant_inferieur_annonce_par_feexpay_ne_valide_pas_le_paiement(): void
    {
        $paymentId = $this->preparer()->json('payment.id');
        $this->fakeStatus('SUCCESSFUL', 100);

        $this->verifier($paymentId)->assertOk()->assertJsonPath('payment.status', 'pending');
        $this->assertSame(0, StayVoucher::count());
    }

    public function test_un_echec_feexpay_marque_le_paiement_en_echec_sans_bon(): void
    {
        $paymentId = $this->preparer()->json('payment.id');
        $this->fakeStatus('FAILED');

        $this->verifier($paymentId)->assertOk()->assertJsonPath('payment.status', 'failed');

        $this->assertSame('VALIDEE_PAIEMENT_REQUIS', $this->reservation->fresh()->status);
        $this->assertSame(0, StayVoucher::count());
    }

    public function test_un_double_clic_ou_un_rechargement_ne_cree_qu_une_tentative(): void
    {
        $key = (string) Str::uuid();

        $premier = $this->preparer($key)->assertCreated();
        $rejoue = $this->preparer($key)->assertCreated();

        Http::fake([self::STATUS_URL => Http::response(['message' => 'Not found'], 404)]);
        $nouveauClic = $this->preparer()->assertCreated();

        $this->assertSame($premier->json('payment.id'), $rejoue->json('payment.id'));
        $this->assertSame($premier->json('payment.id'), $nouveauClic->json('payment.id'));
        $this->assertSame($premier->json('checkout.custom_id'), $nouveauClic->json('checkout.custom_id'));
        $this->assertSame(1, Payment::count());
    }

    public function test_une_tentative_deja_payee_n_est_pas_reproposee(): void
    {
        $this->preparer()->assertCreated();
        $this->fakeStatus('SUCCESSFUL');

        $this->preparer()
            ->assertCreated()
            ->assertJsonPath('payment.status', 'success')
            ->assertJsonPath('checkout', null);

        $this->assertSame(1, StayVoucher::count());
    }

    public function test_le_client_ne_peut_pas_payer_avant_la_validation(): void
    {
        $this->reservation->update(['status' => 'EN_ATTENTE', 'payment_deadline' => null]);

        $this->preparer()->assertStatus(422);

        $this->assertSame(0, Payment::count());
    }

    public function test_un_autre_client_ne_peut_ni_preparer_ni_verifier(): void
    {
        $paymentId = $this->preparer()->json('payment.id');
        $intrus = User::factory()->create();

        $this->actingAsJwt($intrus)
            ->withIdempotencyKey()
            ->postJson("/api/reservations/{$this->reservation->id}/payments")
            ->assertNotFound();
        $this->actingAsJwt($intrus)->postJson("/api/payments/{$paymentId}/verify")->assertNotFound();
    }

    public function test_le_bon_de_sejour_n_est_telechargeable_qu_apres_paiement(): void
    {
        $this->actingAsJwt($this->client)
            ->get("/api/reservations/{$this->reservation->id}/invoice-pdf?type=stay-voucher")
            ->assertStatus(422);

        $paymentId = $this->preparer()->json('payment.id');
        $this->fakeStatus('SUCCESSFUL');
        $this->verifier($paymentId)->assertOk();
        $voucher = StayVoucher::sole();

        $this->actingAsJwt($this->client)
            ->get("/api/vouchers/{$voucher->id}/pdf")
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf');

        $this->actingAsJwt(User::factory()->create())
            ->get("/api/vouchers/{$voucher->id}/pdf")
            ->assertNotFound();
    }

    public function test_sans_cle_api_le_paiement_est_indisponible(): void
    {
        config(['feexpay.api_key' => null]);

        $this->preparer()->assertStatus(503);

        $this->assertSame(0, Payment::count());
    }
}
