<?php

namespace App\Console\Commands;

use App\Models\Reservation;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('reservations:complete-stays')]
#[Description('Cloture les sejours payes dont la date de depart est arrivee : l\'appartement redevient libre automatiquement.')]
class CompleteFinishedStays extends Command
{
    public function handle(): int
    {
        $count = Reservation::completeFinishedStays();

        $this->info("{$count} sejour(s) cloture(s).");

        return self::SUCCESS;
    }
}
