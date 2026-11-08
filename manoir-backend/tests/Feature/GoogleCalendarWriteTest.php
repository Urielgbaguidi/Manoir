<?php

namespace Tests\Feature;

use App\Models\Reservation;
use App\Models\Room;
use App\Models\RoomBlock;
use App\Models\User;
use App\Services\CalendarSyncService;
use App\Services\GoogleCalendarWriter;
use App\Services\IcalParser;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Ecriture des reservations du site dans les agendas Google.
 *
 * Aucun appel reel : les reponses de Google sont simulees. Le compte de service
 * du Manoir n'est jamais sollicite par la suite de tests.
 */
class GoogleCalendarWriteTest extends TestCase
{
    use RefreshDatabase;

    private const AGENDA = 'appartement1@group.calendar.google.com';

    private Room $room;

    private Reservation $reservation;

    protected function setUp(): void
    {
        parent::setUp();

        $this->room = Room::where('apartment_number', 1)->firstOrFail();

        config([
            'calendar_sync.write.enabled' => true,
            'calendar_sync.write.credentials' => $this->cleFactice(),
            'calendar_sync.write.calendars' => [1 => self::AGENDA],
            'calendar_sync.checkout_day_is_marked_occupied' => true,
        ]);

        Cache::put('google-calendar:access-token', 'jeton-de-test', 600);

        $client = User::factory()->create(['name' => 'Awa Doe', 'phone' => '+229 01 02 03 04']);

        $this->reservation = Reservation::create([
            'user_id' => $client->id,
            'room_id' => $this->room->id,
            'category_type' => $this->room->type,
            'check_in' => '2026-09-10',
            'check_out' => '2026-09-13',
            'guests' => 2,
            'total_price' => 90000,
            'deposit_amount' => 27000,
            'status' => 'CONFIRMEE',
        ]);
    }

    /**
     * Cle de compte de service jetable : la vraie ne doit jamais servir en test.
     */
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

    public function test_l_evenement_couvre_la_nuit_du_depart_comme_dans_l_agenda(): void
    {
        Http::fake([
            'www.googleapis.com/*' => Http::response(['id' => 'evt123', 'iCalUID' => 'evt123@google.com']),
        ]);

        $this->assertTrue(app(GoogleCalendarWriter::class)->publier($this->reservation));

        Http::assertSent(function ($requete) {
            $corps = $requete->data();

            // Arrivee le 10, depart le 13. `end.date` etant exclusif chez
            // Google, il faut le 14 pour que l'agenda affiche le 13 occupe :
            // c'est la convention suivie a la main par l'equipe, et celle que
            // l'import retranche ensuite.
            return $corps['start']['date'] === '2026-09-10'
                && $corps['end']['date'] === '2026-09-14'
                && str_contains($corps['summary'], 'Awa Doe')
                && str_contains($corps['summary'], '3 nuitees')
                && str_contains($corps['description'], '+229 01 02 03 04');
        });

        $this->reservation->refresh();
        $this->assertSame('evt123', $this->reservation->google_event_id);
        $this->assertSame('evt123@google.com', $this->reservation->google_ical_uid);
    }

    public function test_un_sejour_paye_sans_evenement_est_rattrape(): void
    {
        $this->reservation->forceFill(['status' => 'CONFIRMEE'])->save();

        Http::fake([
            'www.googleapis.com/*' => Http::response(['id' => 'evt999', 'iCalUID' => 'evt999@google.com']),
        ]);

        // L'ecriture immediate peut echouer (reseau lent, delai depasse) :
        // sans rattrapage, la reservation resterait absente de l'agenda et
        // l'equipe pourrait relouer la periode.
        $this->assertSame(1, app(GoogleCalendarWriter::class)->publierEnRetard());

        $this->assertSame('evt999', $this->reservation->fresh()->google_event_id);
    }

    public function test_le_rattrapage_ignore_ce_qui_est_deja_publie(): void
    {
        $this->reservation->forceFill([
            'status' => 'CONFIRMEE',
            'google_event_id' => 'evt123',
        ])->save();

        Http::fake();

        $this->assertSame(0, app(GoogleCalendarWriter::class)->publierEnRetard());

        Http::assertNothingSent();
    }

    public function test_une_reservation_deja_publiee_est_modifiee_et_non_dupliquee(): void
    {
        $this->reservation->forceFill(['google_event_id' => 'evt123'])->save();

        Http::fake([
            'www.googleapis.com/*' => Http::response(['id' => 'evt123', 'iCalUID' => 'evt123@google.com']),
        ]);

        app(GoogleCalendarWriter::class)->publier($this->reservation);

        Http::assertSent(fn ($requete) => $requete->method() === 'PUT'
            && str_contains($requete->url(), '/events/evt123'));
    }

    public function test_l_annulation_retire_l_evenement_de_l_agenda(): void
    {
        $this->reservation->forceFill(['google_event_id' => 'evt123'])->save();

        Http::fake(['www.googleapis.com/*' => Http::response('', 204)]);

        $this->assertTrue(app(GoogleCalendarWriter::class)->retirer($this->reservation));

        Http::assertSent(fn ($requete) => $requete->method() === 'DELETE');

        $this->reservation->refresh();
        $this->assertNull($this->reservation->google_event_id);
    }

    public function test_une_panne_de_google_ne_fait_pas_echouer_la_reservation(): void
    {
        Http::fake(['www.googleapis.com/*' => Http::response(['error' => ['message' => 'panne']], 500)]);

        $this->assertFalse(app(GoogleCalendarWriter::class)->publier($this->reservation));

        // La reservation reste confirmee : le client a paye, cela prime.
        $this->assertSame('CONFIRMEE', $this->reservation->fresh()->status);
    }

    public function test_sans_cle_de_compte_de_service_rien_n_est_envoye(): void
    {
        config(['calendar_sync.write.credentials' => storage_path('cle-absente.json')]);

        Http::fake();

        $this->assertFalse(app(GoogleCalendarWriter::class)->publier($this->reservation));

        Http::assertNothingSent();
    }

    /**
     * Le piege principal : sans garde-fou, l'evenement que le site vient
     * d'ecrire revient par le flux iCal et bloque l'appartement une seconde
     * fois, pour la meme reservation.
     */
    public function test_l_evenement_ecrit_par_le_site_n_est_pas_reimporte_comme_blocage(): void
    {
        $this->reservation->forceFill([
            'google_event_id' => 'evt123',
            'google_ical_uid' => 'evt123@google.com',
        ])->save();

        $ics = implode("\r\n", [
            'BEGIN:VCALENDAR',
            'BEGIN:VEVENT',
            'UID:evt123@google.com',
            'SUMMARY:Site - Awa Doe - 3 nuitees',
            'DTSTART;VALUE=DATE:20260910',
            'DTEND;VALUE=DATE:20260914',
            'END:VEVENT',
            'BEGIN:VEVENT',
            'UID:autre@google.com',
            'SUMMARY:Reservation telephone',
            'DTSTART;VALUE=DATE:20260920',
            'DTEND;VALUE=DATE:20260923',
            'END:VEVENT',
            'END:VCALENDAR',
        ]);

        config(['calendar_sync.apartments' => [1 => 'https://exemple.test/agenda-1.ics']]);
        Http::fake(['exemple.test/*' => Http::response($ics)]);

        app(CalendarSyncService::class, ['parser' => new IcalParser()])->synchroniser();

        $blocs = RoomBlock::where('room_id', $this->room->id)->get();

        $this->assertCount(1, $blocs, 'Seule la reservation prise au telephone doit produire un blocage.');
        $this->assertSame('autre@google.com', $blocs->first()->external_id);
    }
}
