<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('reservations:check-expirations')->everyMinute();

// Agendas Google des appartements : les reservations prises hors du site
// doivent rendre l'appartement indisponible sans intervention manuelle.
// Toutes les 15 minutes : Google met de toute facon son flux iCal en cache,
// interroger plus souvent n'apporterait rien.
Schedule::command('calendar:sync')
    ->everyFifteenMinutes()
    ->withoutOverlapping()
    ->runInBackground();
