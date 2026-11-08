<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Masquage d'une reservation dans l'historique du client.
 *
 * On ne supprime rien : factures, bons d'annulation et montants encaisses
 * doivent rester consultables par l'administration et opposables en cas de
 * litige. Seule la ligne disparait de la liste du client.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->timestamp('client_hidden_at')->nullable()->after('release_notes');
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropColumn('client_hidden_at');
        });
    }
};
