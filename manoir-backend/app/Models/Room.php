<?php

namespace App\Models;

use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Room extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'description',
        'max_occupants',
        'apartment_number',
        'base_price',
        'deposit',
        'type',
        'images',
        'videos',
        'equipments',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'apartment_number' => 'integer',
            'images' => 'array',
            'videos' => 'array',
            'equipments' => 'array',
        ];
    }

    public function seasonalPrices(): HasMany
    {
        return $this->hasMany(SeasonalPrice::class);
    }

    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class);
    }

    public function blocks(): HasMany
    {
        return $this->hasMany(RoomBlock::class);
    }

    public function isAvailableForDates(string $checkIn, string $checkOut, ?int $excludeReservationId = null): bool
    {
        if ($this->status !== 'available') {
            return false;
        }

        // Occupations venues d'ailleurs que du site (agenda Google, travaux,
        // blocage manuel). Sans ce controle, une reservation prise au telephone
        // n'empeche pas un client de louer le meme appartement en ligne.
        if ($this->blocks()->overlapping($checkIn, $checkOut)->exists()) {
            return false;
        }

        $query = $this->reservations()
            // Reserver retient l'appartement le temps du paiement, puis
            // l'acompte encaisse le retient definitivement. Le blocage
            // d'attente est borne par l'echeance : une reservation abandonnee
            // libere le logement d'elle-meme.
            ->where(function ($query) {
                $query->whereIn('status', ['CONFIRMEE', 'SEJOUR_PAYE'])
                    ->orWhere(function ($query) {
                        $query->where('status', 'VALIDEE_PAIEMENT_REQUIS')
                            ->where(function ($query) {
                                $query->whereNull('payment_deadline')
                                    ->orWhere('payment_deadline', '>', now());
                            });
                    });
            })
            ->where(function ($query) use ($checkIn, $checkOut) {
                // whereDate est indispensable ici : avec un stockage qui ajoute
                // une heure, `check_out > $checkIn` etait vrai le jour du depart
                // et interdisait a un nouveau client d'arriver ce jour-la.
                $query->whereDate('check_in', '<', $checkOut)
                    ->whereDate('check_out', '>', $checkIn);
            });

        if ($excludeReservationId) {
            $query->where('id', '!=', $excludeReservationId);
        }

        if ($query->exists()) {
            return false;
        }

        // Prolongation validee mais pas encore payee : les nuits ajoutees
        // restent retenues jusqu'a l'echeance de paiement.
        return ! $this->extensionHolds()
            ->when($excludeReservationId, fn ($query) => $query->where('stay_extensions.reservation_id', '!=', $excludeReservationId))
            ->whereDate('stay_extensions.previous_check_out', '<', $checkOut)
            ->whereDate('stay_extensions.requested_check_out', '>', $checkIn)
            ->exists();
    }

    /**
     * Prolongations de cet appartement qui retiennent des nuits.
     *
     * @return Builder<StayExtension>
     */
    private function extensionHolds(): Builder
    {
        return StayExtension::query()
            ->holdingNights()
            ->whereHas('reservation', fn ($query) => $query->where('room_id', $this->id));
    }

    /**
     * Etat d'occupation a venir, pour afficher un voyant vert ou rouge au client.
     *
     * Tient compte des deux sources : l'agenda Google (`room_blocks`) et les
     * reservations du site. Les periodes qui se touchent sont fusionnees, sinon
     * on annoncerait « libre le 28 » alors qu'un autre sejour commence ce jour-la.
     *
     * @return array{status: string, occupied_until: string|null, free_until: string|null}
     */
    public function availabilitySummary(): array
    {
        if ($this->status !== 'available') {
            return ['status' => 'unavailable', 'occupied_until' => null, 'free_until' => null];
        }

        $aujourdhui = now()->startOfDay();

        $periodes = $this->periodesOccupees($aujourdhui);

        // On avance tant que les periodes se suivent sans interruption.
        $curseur = $aujourdhui->copy();
        foreach ($periodes as [$debut, $fin]) {
            if ($debut->greaterThan($curseur)) {
                break;
            }

            if ($fin->greaterThan($curseur)) {
                $curseur = $fin->copy();
            }
        }

        if ($curseur->greaterThan($aujourdhui)) {
            return [
                'status' => 'occupied',
                'occupied_until' => $curseur->toDateString(),
                'free_until' => null,
            ];
        }

        // Libre aujourd'hui : jusqu'a quand ?
        $prochaine = collect($periodes)->first(fn ($p) => $p[0]->greaterThan($aujourdhui));

        return [
            'status' => 'free',
            'occupied_until' => null,
            'free_until' => $prochaine ? $prochaine[0]->toDateString() : null,
        ];
    }

    /**
     * Plus long creneau libre a l'interieur de la periode demandee.
     *
     * Quand aucun appartement n'est libre sur toute la duree voulue, renvoyer
     * simplement « indisponible » laisse le client sans issue : il ne sait pas
     * combien de nuits retirer. On lui propose donc ce qui est reellement
     * possible, appartement par appartement.
     *
     * @return array{starts_on: string, ends_on: string, nights: int}|null
     */
    public function longestFreeWindow(string $checkIn, string $checkOut): ?array
    {
        if ($this->status !== 'available') {
            return null;
        }

        $debut = CarbonImmutable::parse($checkIn)->startOfDay();
        $fin = CarbonImmutable::parse($checkOut)->startOfDay();

        if ($fin->lessThanOrEqualTo($debut)) {
            return null;
        }

        $occupations = collect($this->periodesOccupees(Carbon::parse($checkIn)->startOfDay()))
            ->map(fn ($p) => [CarbonImmutable::parse($p[0]), CarbonImmutable::parse($p[1])])
            ->filter(fn ($p) => $p[0]->lessThan($fin) && $p[1]->greaterThan($debut))
            ->sortBy(fn ($p) => $p[0]->getTimestamp())
            ->values();

        $meilleur = null;
        $curseur = $debut;

        // On parcourt les trous entre les occupations, puis la fin de periode.
        foreach ($occupations->push([$fin, $fin]) as [$occDebut, $occFin]) {
            $borne = $occDebut->greaterThan($fin) ? $fin : $occDebut;

            if ($borne->greaterThan($curseur)) {
                $nuits = (int) $curseur->diffInDays($borne);

                if ($nuits > 0 && ($meilleur === null || $nuits > $meilleur['nights'])) {
                    $meilleur = [
                        'starts_on' => $curseur->toDateString(),
                        'ends_on' => $borne->toDateString(),
                        'nights' => $nuits,
                    ];
                }
            }

            if ($occFin->greaterThan($curseur)) {
                $curseur = $occFin->greaterThan($fin) ? $fin : $occFin;
            }
        }

        return $meilleur;
    }

    /**
     * Periodes d'occupation a venir, triees, toutes sources confondues.
     *
     * @return array<int, array{0: Carbon, 1: Carbon}>
     */
    private function periodesOccupees(Carbon $depuis): array
    {
        $periodes = $this->blocks()
            ->whereDate('ends_on', '>', $depuis->toDateString())
            ->get()
            ->map(fn (RoomBlock $bloc) => [$bloc->starts_on->copy()->startOfDay(), $bloc->ends_on->copy()->startOfDay()])
            ->all();

        $reservations = $this->reservations()
            // Reserver retient l'appartement le temps du paiement, puis
            // l'acompte encaisse le retient definitivement. Le blocage
            // d'attente est borne par l'echeance : une reservation abandonnee
            // libere le logement d'elle-meme.
            ->where(function ($query) {
                $query->whereIn('status', ['CONFIRMEE', 'SEJOUR_PAYE'])
                    ->orWhere(function ($query) {
                        $query->where('status', 'VALIDEE_PAIEMENT_REQUIS')
                            ->where(function ($query) {
                                $query->whereNull('payment_deadline')
                                    ->orWhere('payment_deadline', '>', now());
                            });
                    });
            })
            ->whereDate('check_out', '>', $depuis->toDateString())
            ->get()
            ->map(fn (Reservation $r) => [$r->check_in->copy()->startOfDay(), $r->check_out->copy()->startOfDay()])
            ->all();

        $prolongations = $this->extensionHolds()
            ->whereDate('stay_extensions.requested_check_out', '>', $depuis->toDateString())
            ->get()
            ->map(fn (StayExtension $e) => [$e->previous_check_out->copy()->startOfDay(), $e->requested_check_out->copy()->startOfDay()])
            ->all();

        $toutes = array_merge($periodes, $reservations, $prolongations);
        usort($toutes, fn ($a, $b) => $a[0] <=> $b[0]);

        return $toutes;
    }

    public function getPriceForDates(string $checkIn, string $checkOut): int
    {
        $totalPrice = 0;
        $currentDate = new \DateTime($checkIn);
        $endDate = new \DateTime($checkOut);
        $interval = new \DateInterval('P1D');
        $period = new \DatePeriod($currentDate, $interval, $endDate);

        foreach ($period as $date) {
            $dateStr = $date->format('Y-m-d');
            $dayOfWeek = $date->format('N'); // 1 (lundi) à 7 (dimanche)
            $isWeekend = $dayOfWeek >= 6; // samedi et dimanche

            $seasonalPrice = $this->seasonalPrices()
                ->where('start_date', '<=', $dateStr)
                ->where('end_date', '>=', $dateStr)
                ->first();

            if ($seasonalPrice) {
                $totalPrice += $seasonalPrice->price;
            } elseif ($isWeekend) {
                $totalPrice += $this->base_price * 1.2; // +20% le week-end
            } else {
                $totalPrice += $this->base_price;
            }
        }

        return (int) $totalPrice;
    }
}
