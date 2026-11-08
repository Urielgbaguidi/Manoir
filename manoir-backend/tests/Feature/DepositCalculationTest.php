<?php

namespace Tests\Feature;

use App\Models\Reservation;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * L'acompte est une part du sejour, DEDUITE du total.
 *
 * L'ancienne formule multipliait une caution journaliere par le nombre de jours
 * separant la demande de l'arrivee : un sejour de 60 000 F reclamait 11 500 000 F.
 */
class DepositCalculationTest extends TestCase
{
    use RefreshDatabase;

    private function client(): User
    {
        return User::factory()->create(['email_verified_at' => now()]);
    }

    private function connecte(User $user): static
    {
        return $this->withHeader('Authorization', 'Bearer '.$user->createToken('tests')->plainTextToken);
    }

    private function reserver(User $user, int $joursAvant, int $nuits, string $categorie = 'une_chambre'): Reservation
    {
        $this->connecte($user)->postJson('/api/reservations', [
            'category_type' => $categorie,
            'check_in' => now()->addDays($joursAvant)->toDateString(),
            'check_out' => now()->addDays($joursAvant + $nuits)->toDateString(),
            'guests' => 1,
        ])->assertCreated();

        return Reservation::latest('id')->firstOrFail();
    }

    public function test_l_acompte_vaut_trente_pour_cent_du_sejour(): void
    {
        $reservation = $this->reserver($this->client(), 25, 2);

        $this->assertSame(
            (int) round($reservation->stay_amount * 0.30),
            (int) $reservation->deposit_amount
        );
    }

    public function test_acompte_et_solde_font_exactement_le_sejour(): void
    {
        $reservation = $this->reserver($this->client(), 25, 3);

        // Le client ne doit jamais payer plus que le prix du sejour.
        $this->assertSame(
            (int) $reservation->stay_amount,
            (int) $reservation->deposit_amount + $reservation->balanceAmount()
        );
    }

    public function test_l_acompte_ne_depend_plus_du_delai_avant_l_arrivee(): void
    {
        $proche = $this->reserver($this->client(), 2, 2);
        $lointain = $this->reserver($this->client(), 60, 2);

        // Meme sejour, meme acompte : c'est tout l'objet du changement.
        $this->assertSame((int) $proche->deposit_amount, (int) $lointain->deposit_amount);
    }

    public function test_l_acompte_suit_la_duree_du_sejour(): void
    {
        $court = $this->reserver($this->client(), 20, 2);
        $long = $this->reserver($this->client(), 20, 6);

        $this->assertGreaterThan((int) $court->deposit_amount, (int) $long->deposit_amount);
    }

    public function test_le_paiement_du_sejour_ne_reclame_que_le_solde(): void
    {
        $user = $this->client();
        $reservation = $this->reserver($user, 25, 2);
        $reservation->update(['status' => 'CONFIRMEE']);

        $reponse = $this->connecte($user)
            ->postJson("/api/reservations/{$reservation->id}/payments/initiate", [
                'payment_method' => 'mobile_money',
                'provider' => 'kkiapay',
                'payment_type' => 'stay',
                'phone_number' => '+22997000000',
            ])->assertOk();

        // Refacturer le sejour entier reviendrait a encaisser 130 %.
        $this->assertSame($reservation->balanceAmount(), (int) $reponse->json('payment.amount'));
        $this->assertNotSame((int) $reservation->stay_amount, (int) $reponse->json('payment.amount'));
    }

    public function test_le_paiement_de_l_acompte_reclame_bien_l_acompte(): void
    {
        $user = $this->client();
        $reservation = $this->reserver($user, 25, 2);
        $reservation->update(['status' => 'VALIDEE_PAIEMENT_REQUIS', 'payment_deadline' => now()->addDay()]);

        $reponse = $this->connecte($user)
            ->postJson("/api/reservations/{$reservation->id}/payments/initiate", [
                'payment_method' => 'mobile_money',
                'provider' => 'kkiapay',
                'payment_type' => 'deposit',
                'phone_number' => '+22997000000',
            ])->assertOk();

        $this->assertSame((int) $reservation->deposit_amount, (int) $reponse->json('payment.amount'));
    }

    public function test_le_taux_est_configurable(): void
    {
        config(['booking.deposit_rate' => 0.5]);

        $reservation = $this->reserver($this->client(), 25, 2);

        $this->assertSame((int) round($reservation->stay_amount * 0.5), (int) $reservation->deposit_amount);
    }

    public function test_l_acompte_reste_raisonnable_face_au_sejour(): void
    {
        $reservation = $this->reserver($this->client(), 40, 2);

        // Garde-fou contre un retour de l'ancienne formule : elle produisait
        // un acompte plusieurs dizaines de fois superieur au sejour.
        $this->assertLessThan((int) $reservation->stay_amount, (int) $reservation->deposit_amount);
    }

    public function test_le_prix_de_l_appartement_choisi_est_utilise(): void
    {
        $user = $this->client();
        $vip7 = Room::where('apartment_number', 7)->firstOrFail();

        $this->connecte($user)->postJson('/api/reservations', [
            'category_type' => 'vip',
            'check_in' => now()->addDays(25)->toDateString(),
            'check_out' => now()->addDays(27)->toDateString(),
            'room_id' => $vip7->id,
            'guests' => 1,
        ])->assertCreated();

        $reservation = Reservation::latest('id')->firstOrFail();

        $this->assertSame(2 * (int) $vip7->base_price, (int) $reservation->stay_amount);
    }
}
