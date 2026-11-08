<?php

namespace App\Services;

use App\Models\Reservation;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Report des reservations du site dans les agendas Google du Manoir.
 *
 * Sens inverse de CalendarSyncService, qui lui importe l'agenda vers le site.
 * L'authentification passe par un compte de service : on signe un jeton JWT
 * avec sa cle privee, Google le troque contre un jeton d'acces. Pas de
 * bibliotheque tierce, il ne s'agit que de deux appels HTTP.
 *
 * Regle absolue : une panne de Google ne doit jamais faire echouer une
 * reservation payee. Toutes les erreurs sont donc journalisees, jamais
 * propagees.
 */
class GoogleCalendarWriter
{
    private const CLE_JETON = 'google-calendar:access-token';

    private const URL_JETON = 'https://oauth2.googleapis.com/token';

    private const URL_API = 'https://www.googleapis.com/calendar/v3/calendars';

    /**
     * L'ecriture est-elle configuree ? Sans cle de compte de service, le site
     * continue de fonctionner : il lit l'agenda sans jamais y ecrire.
     */
    public function estActif(): bool
    {
        if (! config('calendar_sync.write.enabled', true)) {
            return false;
        }

        $fichier = config('calendar_sync.write.credentials');

        return is_string($fichier) && is_file($fichier);
    }

    /**
     * Cree ou met a jour l'evenement correspondant a la reservation.
     *
     * @return bool vrai si l'agenda est desormais a jour
     */
    public function publier(Reservation $reservation): bool
    {
        $agenda = $this->agenda($reservation);

        if ($agenda === null) {
            return false;
        }

        $charge = $this->evenement($reservation);

        // Un evenement deja publie est modifie, pas duplique : une prolongation
        // de sejour doit deplacer la date de fin, pas creer un second blocage.
        $existant = $reservation->google_event_id;

        $reponse = $existant
            ? $this->appeler('PUT', $agenda.'/events/'.rawurlencode($existant), $charge)
            : $this->appeler('POST', $agenda.'/events', $charge);

        // Evenement supprime a la main dans l'agenda entre-temps : on le recree
        // plutot que de laisser la reservation sans trace.
        if ($existant && $reponse === null) {
            $reservation->forceFill(['google_event_id' => null, 'google_ical_uid' => null])->save();

            $reponse = $this->appeler('POST', $agenda.'/events', $charge);
        }

        if ($reponse === null) {
            return false;
        }

        $reservation->forceFill([
            'google_event_id' => $reponse['id'] ?? null,
            'google_ical_uid' => $reponse['iCalUID'] ?? null,
            'google_synced_at' => now(),
        ])->save();

        return true;
    }

    /**
     * Publie les sejours payes qui n'ont pas encore d'evenement.
     *
     * L'ecriture immediate peut echouer : reseau lent, Google injoignable,
     * delai depasse. Sans rattrapage, la reservation resterait invisible dans
     * l'agenda pour toujours, et l'equipe pourrait relouer la periode. Ce
     * balayage tourne a chaque synchronisation et repare tout seul.
     *
     * @return int nombre d'evenements publies
     */
    public function publierEnRetard(): int
    {
        if (! $this->estActif()) {
            return 0;
        }

        $oubliees = Reservation::query()
            ->whereIn('status', ['CONFIRMEE', 'SEJOUR_PAYE'])
            ->whereNull('google_event_id')
            // Le passe n'a plus besoin d'apparaitre : il ne bloque plus rien.
            ->whereDate('check_out', '>=', now()->toDateString())
            ->with(['room', 'user'])
            ->get();

        $publies = 0;

        foreach ($oubliees as $reservation) {
            if ($this->publier($reservation)) {
                $publies++;
            }
        }

        return $publies;
    }

    /**
     * Retire l'evenement : la periode se relibere dans l'agenda comme sur le
     * site, sans intervention manuelle.
     */
    public function retirer(Reservation $reservation): bool
    {
        $agenda = $this->agenda($reservation);

        if ($agenda === null || ! $reservation->google_event_id) {
            return false;
        }

        $supprime = $this->appeler(
            'DELETE',
            $agenda.'/events/'.rawurlencode($reservation->google_event_id)
        );

        // Une suppression deja faite a la main renvoie 404 ou 410 : le resultat
        // voulu est atteint, on oublie la reference dans les deux cas.
        $reservation->forceFill([
            'google_event_id' => null,
            'google_ical_uid' => null,
            'google_synced_at' => now(),
        ])->save();

        return $supprime !== null;
    }

    /**
     * Agenda de l'appartement concerne, ou null si rien n'est configure.
     */
    private function agenda(Reservation $reservation): ?string
    {
        if (! $this->estActif()) {
            return null;
        }

        $numero = $reservation->room?->apartment_number;

        if (! $numero) {
            return null;
        }

        return config('calendar_sync.write.calendars.'.$numero);
    }

    /**
     * Corps de l'evenement, dans la convention de dates de la maison.
     *
     * @return array<string, mixed>
     */
    private function evenement(Reservation $reservation): array
    {
        $arrivee = CarbonImmutable::parse($reservation->check_in)->startOfDay();
        $depart = CarbonImmutable::parse($reservation->check_out)->startOfDay();

        // `end.date` est exclusif chez Google. Pour que l'agenda affiche le jour
        // du depart comme occupe — la convention suivie a la main dans les
        // agendas du Manoir, et celle que l'import defait ensuite — il faut
        // pousser la borne d'un jour de plus.
        $fin = config('calendar_sync.checkout_day_is_marked_occupied', true)
            ? $depart->addDay()
            : $depart;

        if ($fin->lessThanOrEqualTo($arrivee)) {
            $fin = $arrivee->addDay();
        }

        $nuits = max(1, (int) $arrivee->diffInDays($depart));
        $client = $reservation->user;
        $prefixe = config('calendar_sync.write.prefix', 'Site');

        $titre = sprintf(
            '%s - %s - %d nuitee%s',
            $prefixe,
            $client?->name ?: 'Client',
            $nuits,
            $nuits > 1 ? 's' : ''
        );

        $details = array_filter([
            'Reservation #'.$reservation->id.' (site web)',
            $client?->name ? 'Client : '.$client->name : null,
            $client?->phone ? 'Telephone : '.$client->phone : null,
            $client?->email ? 'Email : '.$client->email : null,
            $reservation->guests ? 'Personnes : '.$reservation->guests : null,
            'Arrivee : '.$arrivee->format('d/m/Y').' - Depart : '.$depart->format('d/m/Y'),
            $reservation->special_requests ? 'Demandes : '.$reservation->special_requests : null,
        ]);

        return [
            'summary' => mb_substr($titre, 0, 200),
            'description' => implode("\n", $details),
            'start' => ['date' => $arrivee->toDateString()],
            'end' => ['date' => $fin->toDateString()],
            // Repere lisible par une machine : meme si quelqu'un renomme
            // l'evenement dans l'agenda, on sait qu'il vient du site.
            'extendedProperties' => [
                'private' => [
                    'manoir_reservation_id' => (string) $reservation->id,
                ],
            ],
        ];
    }

    /**
     * Appel de l'API. Renvoie le corps decode, ou null en cas d'echec.
     *
     * @param  array<string, mixed>|null  $corps
     * @return array<string, mixed>|null
     */
    private function appeler(string $methode, string $chemin, ?array $corps = null): ?array
    {
        $jeton = $this->jeton();

        if ($jeton === null) {
            return null;
        }

        $url = self::URL_API.'/'.$chemin;

        try {
            $requete = Http::withToken($jeton)
                ->timeout((int) config('calendar_sync.write.timeout', 10))
                ->acceptJson();

            $reponse = match ($methode) {
                'POST' => $requete->post($url, $corps ?? []),
                'PUT' => $requete->put($url, $corps ?? []),
                'DELETE' => $requete->delete($url),
                default => $requete->get($url),
            };
        } catch (\Throwable $e) {
            Log::warning('Agenda Google injoignable.', ['erreur' => $e->getMessage()]);

            return null;
        }

        // Une suppression reussie ne renvoie aucun contenu.
        if ($methode === 'DELETE' && $reponse->successful()) {
            return [];
        }

        if ($reponse->failed()) {
            Log::warning('Ecriture refusee par Google Agenda.', [
                'methode' => $methode,
                'code' => $reponse->status(),
                'message' => $reponse->json('error.message'),
            ]);

            return null;
        }

        return $reponse->json();
    }

    /**
     * Jeton d'acces OAuth, obtenu en signant un JWT avec la cle du compte de
     * service. Garde en cache : Google le donne pour une heure.
     */
    private function jeton(): ?string
    {
        $cache = Cache::get(self::CLE_JETON);

        if (is_string($cache) && $cache !== '') {
            return $cache;
        }

        $cle = $this->cle();

        if ($cle === null) {
            return null;
        }

        $base64 = fn (string $donnees) => rtrim(strtr(base64_encode($donnees), '+/', '-_'), '=');
        $emis = time();

        $entete = $base64(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
        $charge = $base64(json_encode([
            'iss' => $cle['client_email'],
            'scope' => 'https://www.googleapis.com/auth/calendar',
            'aud' => self::URL_JETON,
            'iat' => $emis,
            'exp' => $emis + 3600,
        ]));

        if (! openssl_sign($entete.'.'.$charge, $signature, $cle['private_key'], 'sha256')) {
            Log::error('Signature du jeton Google impossible : cle privee illisible.');

            return null;
        }

        try {
            $reponse = Http::asForm()
                ->timeout((int) config('calendar_sync.write.timeout', 10))
                ->post(self::URL_JETON, [
                    'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    'assertion' => $entete.'.'.$charge.'.'.$base64($signature),
                ]);
        } catch (\Throwable $e) {
            Log::warning('Jeton Google inaccessible.', ['erreur' => $e->getMessage()]);

            return null;
        }

        $jeton = $reponse->json('access_token');

        if (! is_string($jeton) || $jeton === '') {
            Log::error('Google a refuse le compte de service.', [
                'message' => $reponse->json('error_description'),
            ]);

            return null;
        }

        // Une minute de marge : mieux vaut redemander un jeton que d'essuyer un
        // refus au moment ou un client vient de payer.
        $duree = max(60, (int) $reponse->json('expires_in', 3600) - 60);
        Cache::put(self::CLE_JETON, $jeton, $duree);

        return $jeton;
    }

    /**
     * @return array{client_email: string, private_key: string}|null
     */
    private function cle(): ?array
    {
        $fichier = config('calendar_sync.write.credentials');

        if (! is_string($fichier) || ! is_file($fichier)) {
            return null;
        }

        $cle = json_decode((string) file_get_contents($fichier), true);

        if (! is_array($cle) || empty($cle['client_email']) || empty($cle['private_key'])) {
            Log::error('Cle de compte de service Google illisible.', ['fichier' => $fichier]);

            return null;
        }

        return $cle;
    }
}
