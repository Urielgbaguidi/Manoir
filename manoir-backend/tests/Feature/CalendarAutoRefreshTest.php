<?php

namespace Tests\Feature;

use App\Models\RoomBlock;
use App\Services\CalendarSyncService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Le site se maintient a jour tout seul : l'hebergement ne fournit pas de
 * taches planifiees, la fraicheur vient donc des visites.
 */
class CalendarAutoRefreshTest extends TestCase
{
    use RefreshDatabase;

    private const AGENDAS = [
        1 => 'https://calendar.google.com/ical/a1/private-x/basic.ics',
        2 => 'https://calendar.google.com/ical/a2/private-x/basic.ics',
        3 => 'https://calendar.google.com/ical/a3/private-x/basic.ics',
    ];

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'calendar_sync.apartments' => self::AGENDAS,
            'calendar_sync.general' => null,
            'calendar_sync.stale_after_minutes' => 15,
        ]);

        Cache::flush();

        $ics = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:e1\r\n"
            ."DTSTART;VALUE=DATE:20990807\r\nDTEND;VALUE=DATE:20990810\r\n"
            ."SUMMARY:Reservation\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";

        Http::fake(fn () => Http::response($ics));
    }

    /**
     * `terminating` ne s'execute qu'a la fin du cycle de vie de la requete :
     * en test, il faut le provoquer.
     */
    private function declencherEtTerminer(): void
    {
        app(CalendarSyncService::class)->synchroniserSiObsolete();
        $this->app->terminate();
    }

    public function test_des_donnees_fraiches_ne_declenchent_aucun_appel(): void
    {
        Cache::put('calendar-sync:last-full', now()->toIso8601String(), now()->addDay());

        $this->declencherEtTerminer();

        Http::assertNothingSent();
    }

    public function test_une_visite_rafraichit_tous_les_agendas(): void
    {
        $this->declencherEtTerminer();

        // Les agendas sont telecharges en parallele : une synchronisation
        // complete a chaque visite reste abordable.
        Http::assertSentCount(count(self::AGENDAS));
    }

    public function test_chaque_agenda_est_bien_appele(): void
    {
        $this->declencherEtTerminer();

        foreach (self::AGENDAS as $url) {
            Http::assertSent(fn ($request) => $request->url() === $url);
        }
    }

    public function test_la_synchronisation_est_horodatee(): void
    {
        $this->declencherEtTerminer();

        // Sans cet horodatage, chaque visite relancerait une synchronisation.
        $this->assertNotNull(Cache::get('calendar-sync:last-full'));
    }

    public function test_des_donnees_perimees_relancent_la_synchronisation(): void
    {
        Cache::put('calendar-sync:last-full', now()->subHour()->toIso8601String(), now()->addDay());

        $this->declencherEtTerminer();

        Http::assertSentCount(count(self::AGENDAS));
    }

    public function test_le_verrou_empeche_deux_synchros_simultanees(): void
    {
        Cache::lock('calendar-sync', 180)->get();

        app(CalendarSyncService::class)->synchroniserSiObsolete();
        $this->app->terminate();

        Http::assertNothingSent();
    }

    public function test_le_rafraichissement_cree_bien_les_blocages(): void
    {
        $this->declencherEtTerminer();

        $this->assertSame(1, RoomBlock::count());
    }
}
