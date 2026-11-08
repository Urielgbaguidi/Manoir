<?php

namespace Tests\Feature;

use App\Models\Room;
use App\Models\RoomBlock;
use App\Services\CalendarSyncService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * L'appartement est identifie par l'AGENDA, jamais par le titre.
 *
 * Plusieurs personnes ecrivent dans ces agendas, chacune a sa maniere. Ces
 * tests garantissent qu'aucune fantaisie de redaction ne casse la disponibilite.
 *
 * Aucun appel reel n'est fait : le contenu iCal est fabrique ici meme.
 */
class CalendarRobustnessTest extends TestCase
{
    use RefreshDatabase;

    private const URL = 'https://calendar.google.com/ical/appart7/private-x/basic.ics';

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'calendar_sync.apartments' => [7 => self::URL],
            'calendar_sync.general' => null,
        ]);
    }

    private function agenda(string $titre, string $debut = '20990810', string $fin = '20990813', string $uid = 'e1'): string
    {
        return "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:{$uid}\r\n"
            ."DTSTART;VALUE=DATE:{$debut}\r\nDTEND;VALUE=DATE:{$fin}\r\n"
            ."SUMMARY:{$titre}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";
    }

    private function synchroniser(string $ics): void
    {
        Http::fake([self::URL => Http::response($ics)]);
        app(CalendarSyncService::class)->synchroniser();
    }

    /**
     * @return array<int, array{0: string, 1: string}>
     */
    public static function titresFantaisistes(): array
    {
        return [
            'format habituel' => ['Réservation du 7 du 10 au 13 août pour Mr Olawole'],
            'sans accent' => ['Reservation du 7 du 10 au 13 aout'],
            'tout en majuscules' => ['RESERVATION APPART 7 DU 10 AU 13'],
            'numero absent' => ['Reservation pour madame Chinasa'],
            'mauvais numero dans le titre' => ['Réservation du 2 du 10 au 13 août'],
            'abreviation' => ['resa 7'],
            'titre vide' => [''],
            'un seul mot' => ['Occupe'],
            'avec emoji' => ['🔒 Bloqué — travaux salle de bain'],
            'ponctuation exotique' => ['Résa n°7 ; du 10/08 au 13/08 : 120.000 FCFA (payé)'],
            'texte tres long' => ['Réservation du 7 du 10 au 13 août pour Monsieur Olawole Adebayo, arrivée tardive vers 23h, prévoir un lit supplémentaire et une bouteille de champagne, paiement par virement déjà reçu, contact au +229 97 00 00 00'],
            'langue etrangere' => ['Booking apartment seven, three nights'],
        ];
    }

    #[DataProvider('titresFantaisistes')]
    public function test_le_blocage_fonctionne_quel_que_soit_le_titre(string $titre): void
    {
        $this->synchroniser($this->agenda($titre));

        $bloc = RoomBlock::sole();
        $appart7 = Room::where('apartment_number', 7)->firstOrFail();

        // Le numero vient de l'agenda : meme un titre annoncant l'appartement 2
        // bloque bien le 7, puisque l'evenement est dans l'agenda du 7.
        $this->assertSame($appart7->id, $bloc->room_id);
        $this->assertSame('2099-08-10', $bloc->starts_on->toDateString());
        $this->assertSame('2099-08-12', $bloc->ends_on->toDateString());
        $this->assertFalse($appart7->fresh()->isAvailableForDates('2099-08-10', '2099-08-12'));
    }

    public function test_un_evenement_horaire_bloque_aussi_la_journee(): void
    {
        // Certains saisissent un creneau horaire plutot qu'une journee entiere.
        $ics = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:h1\r\n"
            ."DTSTART:20990810T140000Z\r\nDTEND:20990813T110000Z\r\n"
            ."SUMMARY:Arrivee 14h depart 11h\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";

        $this->synchroniser($ics);

        $this->assertSame(1, RoomBlock::count());
        $this->assertSame('2099-08-10', RoomBlock::sole()->starts_on->toDateString());
    }

    public function test_un_evenement_sans_date_de_fin_bloque_une_nuit(): void
    {
        $ics = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:s1\r\n"
            ."DTSTART;VALUE=DATE:20990810\r\nSUMMARY:Bloque\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n";

        $this->synchroniser($ics);

        $this->assertSame(1, RoomBlock::count());
    }

    public function test_un_agenda_vide_ne_bloque_rien(): void
    {
        $this->synchroniser("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n");

        $this->assertSame(0, RoomBlock::count());
        $this->assertTrue(Room::where('apartment_number', 7)->firstOrFail()->isAvailableForDates('2099-08-10', '2099-08-12'));
    }

    public function test_plusieurs_reservations_le_meme_jour_sont_toutes_lues(): void
    {
        $ics = "BEGIN:VCALENDAR\r\n";
        foreach ([['a', '20990810', '20990812'], ['b', '20990812', '20990815'], ['c', '20990815', '20990818']] as [$uid, $d, $f]) {
            $ics .= "BEGIN:VEVENT\r\nUID:{$uid}\r\nDTSTART;VALUE=DATE:{$d}\r\nDTEND;VALUE=DATE:{$f}\r\nSUMMARY:Resa\r\nEND:VEVENT\r\n";
        }
        $this->synchroniser($ics."END:VCALENDAR\r\n");

        $this->assertSame(3, RoomBlock::count());
    }
}
