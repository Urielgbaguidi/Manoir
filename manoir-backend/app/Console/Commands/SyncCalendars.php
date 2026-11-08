<?php

namespace App\Console\Commands;

use App\Services\CalendarSyncService;
use Illuminate\Console\Command;

class SyncCalendars extends Command
{
    protected $signature = 'calendar:sync {--check : Affiche aussi le controle de l\'agenda general}';

    protected $description = 'Importe les agendas Google des appartements dans les blocages de disponibilite';

    public function handle(CalendarSyncService $service): int
    {
        $this->info('Synchronisation des agendas Google...');

        $rapport = $service->synchroniser();

        $lignes = [];
        foreach ($rapport['appartements'] as $numero => $r) {
            $lignes[] = ["Appartement {$numero}", $r['crees'], $r['majs'], $r['supprimes'], $r['ignores']];
        }

        if ($lignes !== []) {
            $this->table(['Agenda', 'Crees', 'Mis a jour', 'Supprimes', 'Ignores (passes)'], $lignes);
        }

        foreach ($rapport['erreurs'] as $numero => $message) {
            $this->error("Appartement {$numero} : {$message}");
        }

        $this->line(sprintf(
            '  %d cree(s), %d mis a jour, %d supprime(s).',
            $rapport['crees'],
            $rapport['majs'],
            $rapport['supprimes']
        ));

        if ($this->option('check')) {
            $this->controlerAgendaGeneral($service);
        }

        return $rapport['erreurs'] === [] ? self::SUCCESS : self::FAILURE;
    }

    /**
     * L'agenda general contient des reservations portant sur plusieurs
     * appartements. Elles ne sont jamais bloquees automatiquement : on affiche
     * lesquelles ne sont pas repercutees dans les agendas individuels, pour que
     * l'administration corrige a la main.
     */
    private function controlerAgendaGeneral(CalendarSyncService $service): void
    {
        $this->newLine();
        $this->info('Controle de l\'agenda general « LE MANOIR » :');

        try {
            $signalements = $service->controlerAgendaGeneral();
        } catch (\Throwable $e) {
            $this->error('  '.$e->getMessage());

            return;
        }

        if ($signalements === []) {
            $this->line('  Aucun evenement futur.');

            return;
        }

        foreach ($signalements as $s) {
            $couvert = $s['couvert_par'] === [] ? 'AUCUN' : implode(', ', $s['couvert_par']);
            $this->line(sprintf('  %s -> %s | %s', $s['starts_on'], $s['ends_on'], mb_substr($s['summary'], 0, 60)));
            $this->line(sprintf('      appartements deja bloques sur ces dates : %s', $couvert));
        }
    }
}
