<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Trace de l'evenement cree dans Google Agenda pour une reservation du site.
 *
 * Sans elle, la synchronisation suivante reimporterait notre propre evenement
 * comme une occupation exterieure : l'appartement serait bloque deux fois pour
 * le meme sejour, et le blocage survivrait a l'annulation de la reservation.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            // Identifiant technique : sert a modifier ou supprimer l'evenement.
            $table->string('google_event_id')->nullable()->after('room_id');
            // UID iCal : c'est lui qu'on retrouve dans le flux au moment de
            // l'import, et il ne coincide pas toujours avec l'identifiant.
            $table->string('google_ical_uid')->nullable()->after('google_event_id');
            $table->timestamp('google_synced_at')->nullable()->after('google_ical_uid');

            $table->index('google_ical_uid');
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropIndex(['google_ical_uid']);
            $table->dropColumn(['google_event_id', 'google_ical_uid', 'google_synced_at']);
        });
    }
};
