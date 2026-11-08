<?php

namespace App\Services;

use App\Models\Reservation;
use App\Models\Room;
use App\Models\RoomBlock;
use Carbon\CarbonImmutable;
use Illuminate\Http\Client\Pool;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Importe les agendas Google (un par appartement) dans `room_blocks`, pour que
 * les reservations prises hors du site rendent l'appartement indisponible.
 */
class CalendarSyncService
{
    /** Horodatage de la derniere synchronisation complete. */
    private const CLE_DERNIERE_SYNCHRO = 'calendar-sync:last-full';

    public function __construct(private IcalParser $parser) {}

    /**
     * Resynchronise TOUS les agendas quand les donnees ont vieilli, sans faire
     * attendre le visiteur.
     *
     * Le travail part apres l'envoi de la reponse. Les huit agendas sont
     * telecharges en parallele : l'attente se resume au plus lent, ce qui rend
     * une synchronisation complete abordable a chaque visite.
     *
     * Ce mecanisme remplace la tache planifiee, absente de l'hebergement
     * gratuit. Le declencheur externe (POST /api/calendar/sync) reste utile
     * pour rafraichir meme sans visiteur.
     */
    public function synchroniserSiObsolete(): void
    {
        if (config('calendar_sync.apartments', []) === []) {
            return;
        }

        $derniere = Cache::get(self::CLE_DERNIERE_SYNCHRO);

        if ($derniere !== null
            && CarbonImmutable::parse($derniere)->diffInMinutes(now()) < (int) config('calendar_sync.stale_after_minutes', 15)) {
            return;
        }

        // Empeche dix visiteurs simultanes de lancer dix synchronisations.
        $verrou = Cache::lock('calendar-sync', 180);

        if (! $verrou->get()) {
            return;
        }

        app()->terminating(function () use ($verrou) {
            try {
                $this->synchroniser();
            } catch (\Throwable $e) {
                Log::error('Rafraichissement differe des agendas : '.$e->getMessage());
            } finally {
                $verrou->release();
            }
        });
    }

    private function marquerSynchronise(int $numero): void
    {
        Cache::put($this->cleFraicheur($numero), now()->toIso8601String(), now()->addDays(7));
        Cache::put(self::CLE_DERNIERE_SYNCHRO, now()->toIso8601String(), now()->addDays(7));
    }

    private function cleFraicheur(int $numero): string
    {
        return "calendar-sync:last:{$numero}";
    }

    /**
     * @return array<string, mixed> rapport de synchronisation
     */
    public function synchroniser(): array
    {
        $rapport = [
            'appartements' => [],
            'crees' => 0,
            'majs' => 0,
            'supprimes' => 0,
            'erreurs' => [],
        ];

        $depuis = CarbonImmutable::today()->subDays((int) config('calendar_sync.past_days', 7));
        $appartements = config('calendar_sync.apartments', []);

        // Les huit agendas sont telecharges EN PARALLELE. Enchaines, ils
        // prenaient neuf secondes ; ensemble, le temps se resume au plus lent.
        $contenus = $this->telechargerTous($appartements);

        foreach ($appartements as $numero => $url) {
            try {
                $contenu = $contenus[(string) $numero] ?? null;

                if ($contenu instanceof \Throwable) {
                    throw $contenu;
                }

                if (! is_string($contenu)) {
                    throw new \RuntimeException('Aucune reponse de cet agenda.');
                }

                $resultat = $this->importerAppartement((int) $numero, $contenu, $depuis);
                $this->marquerSynchronise((int) $numero);
                $rapport['appartements'][$numero] = $resultat;
                $rapport['crees'] += $resultat['crees'];
                $rapport['majs'] += $resultat['majs'];
                $rapport['supprimes'] += $resultat['supprimes'];
            } catch (\Throwable $e) {
                $rapport['erreurs'][$numero] = $e->getMessage();
                Log::error("Synchronisation agenda appartement {$numero} : ".$e->getMessage());
            }
        }

        // Rattrapage du sens inverse : un sejour paye dont l'ecriture a echoue
        // (reseau lent, Google injoignable) resterait invisible dans l'agenda
        // pour toujours, et l'equipe pourrait relouer la periode. Isole des
        // erreurs de lecture : un agenda en panne ne doit pas empecher la
        // reparation des autres.
        try {
            $rapport['publies'] = app(GoogleCalendarWriter::class)->publierEnRetard();
        } catch (\Throwable $e) {
            $rapport['publies'] = 0;
            Log::error('Rattrapage des ecritures agenda : '.$e->getMessage());
        }

        return $rapport;
    }

    /**
     * Telecharge tous les agendas simultanement.
     *
     * @param  array<int|string, string>  $appartements
     * @return array<string, string|\Throwable> corps iCal, ou l'erreur rencontree
     */
    private function telechargerTous(array $appartements): array
    {
        $timeout = (int) config('calendar_sync.timeout', 30);

        $reponses = Http::pool(function (Pool $pool) use ($appartements, $timeout) {
            $requetes = [];

            foreach ($appartements as $numero => $url) {
                $requetes[] = $pool->as((string) $numero)->timeout($timeout)->get($url);
            }

            return $requetes;
        });

        $contenus = [];

        foreach ($appartements as $numero => $url) {
            $reponse = $reponses[(string) $numero] ?? null;

            // Une panne reseau revient sous forme d'exception, pas de reponse.
            if ($reponse instanceof \Throwable) {
                $contenus[(string) $numero] = $reponse;

                continue;
            }

            if ($reponse === null) {
                $contenus[(string) $numero] = new \RuntimeException('Agenda injoignable.');

                continue;
            }

            $contenus[(string) $numero] = $reponse->successful()
                ? $reponse->body()
                : new \RuntimeException("L'agenda a repondu HTTP {$reponse->status()}.");
        }

        return $contenus;
    }

    /**
     * Transforme le contenu iCal deja telecharge en blocages de disponibilite.
     *
     * @return array{crees: int, majs: int, supprimes: int, ignores: int}
     */
    private function importerAppartement(int $numero, string $ics, CarbonImmutable $depuis): array
    {
        $room = Room::where('apartment_number', $numero)->first();

        if (! $room) {
            throw new \RuntimeException("Aucun appartement n{$numero} en base.");
        }

        $evenements = $this->parser->parse($ics);

        // Evenements que le site a lui-meme ecrits dans l'agenda. Les reimporter
        // comme occupations exterieures bloquerait l'appartement deux fois pour
        // le meme sejour, et le blocage survivrait a l'annulation puisque rien
        // ne le rattacherait a la reservation.
        $lesNotres = Reservation::whereNotNull('google_ical_uid')
            ->where('room_id', $room->id)
            ->pluck('google_ical_uid')
            ->flip();

        $crees = $majs = $ignores = 0;
        $uidsVus = [];

        foreach ($evenements as $evenement) {
            if ($lesNotres->has($evenement['uid'])) {
                $ignores++;

                continue;
            }

            // Le jour de depart est marque occupe dans l'agenda, alors que le
            // site libere cette nuit-la : on retire donc un jour.
            $fin = config('calendar_sync.checkout_day_is_marked_occupied', true)
                ? $evenement['ends_on']->subDay()
                : $evenement['ends_on'];

            // Un evenement d'une seule journee ne libere rien : on garde au
            // minimum une nuit pour ne pas produire un blocage vide.
            if ($fin->lessThanOrEqualTo($evenement['starts_on'])) {
                $fin = $evenement['starts_on']->addDay();
            }

            // Le passe n'influence plus la disponibilite.
            if ($fin->lessThan($depuis)) {
                $ignores++;

                continue;
            }

            $uidsVus[] = $evenement['uid'];

            $bloc = RoomBlock::firstOrNew([
                'source' => RoomBlock::SOURCE_GOOGLE,
                'external_id' => $evenement['uid'],
            ]);

            $existait = $bloc->exists;

            $bloc->fill([
                'room_id' => $room->id,
                'starts_on' => $evenement['starts_on']->toDateString(),
                'ends_on' => $fin->toDateString(),
                'summary' => mb_substr($evenement['summary'], 0, 255) ?: null,
                'synced_at' => now(),
            ]);

            if (! $existait) {
                $bloc->save();
                $crees++;
            } elseif ($bloc->isDirty(['room_id', 'starts_on', 'ends_on', 'summary'])) {
                $bloc->save();
                $majs++;
            } else {
                $bloc->save(); // rafraichit synced_at
            }
        }

        // Un evenement supprime de l'agenda ne doit plus bloquer. On ne touche
        // qu'aux blocages de CET appartement, issus de Google, et dans la
        // fenetre synchronisee : l'historique reste intact.
        $supprimes = RoomBlock::where('source', RoomBlock::SOURCE_GOOGLE)
            ->where('room_id', $room->id)
            ->whereDate('ends_on', '>=', $depuis->toDateString())
            ->when($uidsVus !== [], fn ($q) => $q->whereNotIn('external_id', $uidsVus))
            ->delete();

        return compact('crees', 'majs', 'supprimes', 'ignores');
    }

    /**
     * Evenements futurs de l'agenda general « LE MANOIR ».
     *
     * Cet agenda melange des reservations multi-appartements et des elements
     * qui n'en sont pas. Rien n'en est bloque automatiquement : deduire d'une
     * phrase libre quels appartements sont concernes rendrait indisponibles
     * plusieurs logements sur une supposition. On se contente de signaler.
     *
     * @return array<int, array{summary: string, starts_on: string, ends_on: string, couvert_par: array<int, int>}>
     */
    public function controlerAgendaGeneral(): array
    {
        $url = config('calendar_sync.general');

        if (! $url) {
            return [];
        }

        $reponse = Http::timeout((int) config('calendar_sync.timeout', 30))->get($url);

        if (! $reponse->successful()) {
            throw new \RuntimeException("L'agenda general a repondu HTTP {$reponse->status()}.");
        }

        $aujourdhui = CarbonImmutable::today();
        $signalements = [];

        foreach ($this->parser->parse($reponse->body()) as $evenement) {
            if ($evenement['ends_on']->lessThan($aujourdhui) || trim($evenement['summary']) === '') {
                continue;
            }

            $fin = $evenement['ends_on']->subDay();

            $couvert = DB::table('room_blocks')
                ->join('rooms', 'rooms.id', '=', 'room_blocks.room_id')
                ->whereDate('room_blocks.starts_on', '<', $fin->toDateString())
                ->whereDate('room_blocks.ends_on', '>', $evenement['starts_on']->toDateString())
                ->pluck('rooms.apartment_number')
                ->unique()
                ->sort()
                ->values()
                ->all();

            $signalements[] = [
                'summary' => $evenement['summary'],
                'starts_on' => $evenement['starts_on']->toDateString(),
                'ends_on' => $fin->toDateString(),
                'couvert_par' => $couvert,
            ];
        }

        return $signalements;
    }
}
