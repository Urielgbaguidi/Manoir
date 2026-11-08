<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Codes de confirmation d'adresse email, a 6 chiffres.
 *
 * Un seul code actif par utilisateur : en redemander un remplace le precedent.
 * Le code est stocke HACHE, jamais en clair : une fuite de la base ne doit pas
 * permettre de valider les comptes des autres.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('email_verification_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('code_hash');
            $table->timestamp('expires_at');

            // Compteur de tentatives ratees : au-dela d'un seuil, le code est
            // brule et il faut en redemander un. Sans cela, 6 chiffres se
            // devinent par force brute.
            $table->unsignedTinyInteger('attempts')->default(0);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_verification_codes');
    }
};
