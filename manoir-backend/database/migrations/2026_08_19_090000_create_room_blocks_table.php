<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Periodes d'indisponibilite d'un appartement qui ne viennent PAS d'une
 * reservation du site : reservations prises par telephone et notees dans
 * Google Agenda, travaux, blocage manuel par l'administration.
 *
 * Sans cette table, le site ne sait exprimer qu'un blocage permanent
 * (`rooms.status`) et propose donc a la location un appartement deja occupe.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('room_blocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('room_id')->constrained()->cascadeOnDelete();

            // Convention identique aux reservations : nuit d'arrivee incluse,
            // jour de depart exclu. Un depart le 21 libere la nuit du 21.
            $table->date('starts_on');
            $table->date('ends_on');

            // 'google_calendar' (synchronise) ou 'manual' (saisi en back-office).
            $table->string('source', 32)->default('manual');

            // UID de l'evenement iCal : permet de reconnaitre un evenement deja
            // importe, de le mettre a jour, et de supprimer les blocages dont
            // l'evenement a disparu de l'agenda.
            $table->string('external_id')->nullable();

            $table->string('summary')->nullable();
            $table->text('notes')->nullable();
            $table->timestamp('synced_at')->nullable();
            $table->timestamps();

            // Un meme evenement ne doit produire qu'un seul blocage.
            $table->unique(['source', 'external_id']);

            // Requete de disponibilite : par chambre, sur un intervalle.
            $table->index(['room_id', 'starts_on', 'ends_on']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('room_blocks');
    }
};
