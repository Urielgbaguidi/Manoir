<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            // Accelere les controles de disponibilite / conflits de dates par chambre.
            $table->index(
                ['room_id', 'status', 'check_in', 'check_out'],
                'reservations_room_status_dates_idx'
            );
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropIndex('reservations_room_status_dates_idx');
        });
    }
};
