<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Champs requis par la connexion Google et la double authentification.
 *
 * - `password` devient facultatif : un compte cree via Google n'en a pas.
 * - `google_id` (claim `sub` de Google) identifie le compte Google de facon
 *   stable, meme si l'adresse email change chez Google.
 * - Le secret TOTP est stocke chiffre (cast `encrypted` du modele).
 * - `two_factor_last_used_step` empeche de rejouer un code TOTP deja utilise.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('password')->nullable()->change();
            $table->string('google_id')->nullable()->unique()->after('email');
            $table->text('two_factor_secret')->nullable()->after('password');
            $table->text('two_factor_recovery_codes')->nullable()->after('two_factor_secret');
            $table->timestamp('two_factor_confirmed_at')->nullable()->after('two_factor_recovery_codes');
            $table->unsignedBigInteger('two_factor_last_used_step')->nullable()->after('two_factor_confirmed_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['google_id']);
            $table->dropColumn([
                'google_id',
                'two_factor_secret',
                'two_factor_recovery_codes',
                'two_factor_confirmed_at',
                'two_factor_last_used_step',
            ]);
        });
    }
};
