<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\RoomBlock;
use App\Services\CalendarSyncService;
use GuzzleHttp\Promise\PromiseInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class CalendarSyncTest extends TestCase
{
    use RefreshDatabase;

    private const URL = 'https://calendar.google.com/calendar/ical/appart1/private-xyz/basic.ics';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'calendar_sync.apartments' => [1 => self::URL],
            'calendar_sync.general' => null,
        ]);

        // Les migrations creent deja les 8 appartements : en fabriquer un
        // neuvieme porterait le meme numero et fausserait la correspondance.
        $this->room = Room::where('apartment_number', 1)->firstOrFail();

        // Un seul enregistrement de faux appel, qui relit `reponse` a chaque
        // requete : reappeler Http::fake() n'ecraserait pas le precedent, c'est
        // le premier enregistre qui repond.
        Http::fake(fn () => $this->reponse);
    }

    private Room $room;

    private \Illuminate\Http\Client\Response|PromiseInterface $reponse;

    /**
     * @param  array<int, array{uid: string, start: string, end: string, summary?: string, cancelled?: bool}>  $evenements
     */
    private function agenda(array $evenements): string
    {
        $ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\n";

        foreach ($evenements as $e) {
            $ics .= "BEGIN:VEVENT\r\n";
            $ics .= 'UID:'.$e['uid']."\r\n";
            $ics .= 'DTSTART;VALUE=DATE:'.$e['start']."\r\n";
            $ics .= 'DTEND;VALUE=DATE:'.$e['end']."\r\n";
            $ics .= 'SUMMARY:'.($e['summary'] ?? 'Reservation')."\r\n";
            if ($e['cancelled'] ?? false) {
                $ics .= "STATUS:CANCELLED\r\n";
            }
            $ics .= "END:VEVENT\r\n";
        }

        return $ics."END:VCALENDAR\r\n";
    }

    private function repondre(array $evenements): void
    {
        $this->reponse = Http::response($this->agenda($evenements));
    }

    private function synchroniser(): array
    {
        return app(CalendarSyncService::class)->synchroniser();
    }

    public function test_un_evenement_devient_un_blocage(): void
    {
        // Dans l'agenda : « du 7 au 9, 2 nuitees » se saisit 07 -> 10 (DTEND exclusif).
        $this->repondre([['uid' => 'e1', 'start' => '20990807', 'end' => '20990810']]);

        $rapport = $this->synchroniser();

        $this->assertSame(1, $rapport['crees']);

        $bloc = RoomBlock::sole();
        $this->assertSame('2099-08-07', $bloc->starts_on->toDateString());
        // Le jour du depart est libere : 10 - 1 = 9.
        $this->assertSame('2099-08-09', $bloc->ends_on->toDateString());
    }

    public function test_l_appartement_devient_indisponible(): void
    {
        $this->repondre([['uid' => 'e1', 'start' => '20990807', 'end' => '20990810']]);
        $this->synchroniser();

        $this->assertFalse($this->room->isAvailableForDates('2099-08-07', '2099-08-09'));
        // Le client precedent part le 9 : la nuit du 9 reste louable.
        $this->assertTrue($this->room->isAvailableForDates('2099-08-09', '2099-08-11'));
    }

    public function test_la_synchronisation_est_idempotente(): void
    {
        $this->repondre([['uid' => 'e1', 'start' => '20990807', 'end' => '20990810']]);

        $this->synchroniser();
        $second = $this->synchroniser();

        $this->assertSame(0, $second['crees']);
        $this->assertSame(1, RoomBlock::count());
    }

    public function test_un_evenement_deplace_met_a_jour_le_blocage(): void
    {
        $this->repondre([['uid' => 'e1', 'start' => '20990807', 'end' => '20990810']]);
        $this->synchroniser();

        $this->repondre([['uid' => 'e1', 'start' => '20990814', 'end' => '20990817']]);
        $rapport = $this->synchroniser();

        $this->assertSame(1, $rapport['majs']);
        $this->assertSame(1, RoomBlock::count());
        $this->assertSame('2099-08-14', RoomBlock::sole()->starts_on->toDateString());
    }

    public function test_un_evenement_supprime_libere_l_appartement(): void
    {
        $this->repondre([
            ['uid' => 'e1', 'start' => '20990807', 'end' => '20990810'],
            ['uid' => 'e2', 'start' => '20990901', 'end' => '20990903'],
        ]);
        $this->synchroniser();
        $this->assertSame(2, RoomBlock::count());

        // e2 a disparu de l'agenda.
        $this->repondre([['uid' => 'e1', 'start' => '20990807', 'end' => '20990810']]);
        $rapport = $this->synchroniser();

        $this->assertSame(1, $rapport['supprimes']);
        $this->assertTrue($this->room->isAvailableForDates('2099-09-01', '2099-09-03'));
    }

    public function test_un_evenement_annule_ne_bloque_pas(): void
    {
        $this->repondre([['uid' => 'e1', 'start' => '20990807', 'end' => '20990810', 'cancelled' => true]]);

        $this->synchroniser();

        $this->assertSame(0, RoomBlock::count());
    }

    public function test_les_evenements_passes_sont_ignores(): void
    {
        $this->repondre([['uid' => 'vieux', 'start' => '20200101', 'end' => '20200105']]);

        $rapport = $this->synchroniser();

        $this->assertSame(0, $rapport['crees']);
        $this->assertSame(1, $rapport['appartements'][1]['ignores']);
    }

    public function test_un_agenda_injoignable_n_efface_pas_les_blocages(): void
    {
        $this->repondre([['uid' => 'e1', 'start' => '20990807', 'end' => '20990810']]);
        $this->synchroniser();

        $this->reponse = Http::response('', 500);
        $rapport = $this->synchroniser();

        // Une panne de Google ne doit pas rouvrir a la location un appartement occupe.
        $this->assertNotEmpty($rapport['erreurs']);
        $this->assertSame(1, RoomBlock::count());
        $this->assertFalse($this->room->isAvailableForDates('2099-08-07', '2099-08-09'));
    }

    public function test_un_titre_coupe_sur_plusieurs_lignes_est_recolle(): void
    {
        $ics = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:e1\r\n"
            ."DTSTART;VALUE=DATE:20990807\r\nDTEND;VALUE=DATE:20990810\r\n"
            ."SUMMARY:Reservation du 1 du 7 au 9 pour Madame\r\n  Chinasa Okpara\r\n"
            ."END:VEVENT\r\nEND:VCALENDAR\r\n";
        $this->reponse = Http::response($ics);

        $this->synchroniser();

        $this->assertStringContainsString('Chinasa Okpara', RoomBlock::sole()->summary);
    }
}
