<?php

namespace App\Services;

use Carbon\CarbonImmutable;

/**
 * Lecteur iCal minimal, limite a ce dont la synchronisation a besoin :
 * les evenements sur journee entiere d'un agenda Google.
 *
 * Volontairement sans dependance externe : le format produit par Google est
 * stable et restreint, une bibliotheque complete serait disproportionnee.
 */
class IcalParser
{
    /**
     * @return array<int, array{uid: string, summary: string, starts_on: CarbonImmutable, ends_on: CarbonImmutable, all_day: bool}>
     */
    public function parse(string $ics): array
    {
        $evenements = [];

        foreach ($this->decouperEvenements($this->deplierLignes($ics)) as $bloc) {
            $evenement = $this->lireEvenement($bloc);

            if ($evenement !== null) {
                $evenements[] = $evenement;
            }
        }

        return $evenements;
    }

    /**
     * iCal coupe les lignes longues et prefixe la suite d'une espace ou d'une
     * tabulation. Sans ce recollage, un titre long serait tronque.
     */
    private function deplierLignes(string $ics): string
    {
        return preg_replace("/\r\n[ \t]/", '', str_replace("\n", "\r\n", str_replace("\r\n", "\n", $ics)));
    }

    /**
     * @return array<int, string>
     */
    private function decouperEvenements(string $ics): array
    {
        preg_match_all('/BEGIN:VEVENT(.*?)END:VEVENT/s', $ics, $matches);

        return $matches[1] ?? [];
    }

    /**
     * @return array{uid: string, summary: string, starts_on: CarbonImmutable, ends_on: CarbonImmutable, all_day: bool}|null
     */
    private function lireEvenement(string $bloc): ?array
    {
        // Un evenement annule reste present dans le flux : il ne doit plus bloquer.
        if (preg_match('/^STATUS:CANCELLED/mi', $bloc)) {
            return null;
        }

        $uid = $this->champ($bloc, 'UID');
        $debut = $this->champ($bloc, 'DTSTART');
        $fin = $this->champ($bloc, 'DTEND');

        if ($uid === null || $debut === null) {
            return null;
        }

        $journeeEntiere = (bool) preg_match('/^DTSTART[^:]*VALUE=DATE[^:]*:/mi', $bloc);

        $debutDate = $this->versDate($debut);

        if ($debutDate === null) {
            return null;
        }

        // Un evenement sans DTEND dure une journee.
        $finDate = $fin !== null ? $this->versDate($fin) : $debutDate->addDay();

        if ($finDate === null || $finDate->lessThanOrEqualTo($debutDate)) {
            $finDate = $debutDate->addDay();
        }

        return [
            'uid' => $uid,
            'summary' => $this->dechapper($this->champ($bloc, 'SUMMARY') ?? ''),
            'starts_on' => $debutDate,
            'ends_on' => $finDate,
            'all_day' => $journeeEntiere,
        ];
    }

    private function champ(string $bloc, string $nom): ?string
    {
        if (! preg_match('/^'.$nom.'(?:;[^:\r\n]*)?:(.*)$/mi', $bloc, $matches)) {
            return null;
        }

        return trim($matches[1]);
    }

    /**
     * Accepte les deux formes produites par Google : 20260807 (journee entiere)
     * et 20260807T140000Z (horaire).
     */
    private function versDate(string $valeur): ?CarbonImmutable
    {
        if (! preg_match('/^(\d{4})(\d{2})(\d{2})/', $valeur, $m)) {
            return null;
        }

        try {
            return CarbonImmutable::create((int) $m[1], (int) $m[2], (int) $m[3], 0, 0, 0);
        } catch (\Throwable) {
            return null;
        }
    }

    private function dechapper(string $texte): string
    {
        return str_replace(
            ['\\,', '\\;', '\\n', '\\N', '\\\\'],
            [',', ';', ' ', ' ', '\\'],
            $texte
        );
    }
}
