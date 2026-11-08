<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Supprime l'ancien systeme de token maison (une seule session par utilisateur),
 * remplace par Laravel Sanctum et sa table personal_access_tokens.
 */
return new class extends Migration
{
    public function up(): void
    {
        // L'index unique doit tomber avant la colonne (SQLite refuse l'inverse).
        if (Schema::hasColumn('users', 'api_token')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropUnique('users_api_token_unique');
            });
        }

        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'api_token')) {
                $table->dropColumn('api_token');
            }

            if (Schema::hasColumn('users', 'api_token_expires_at')) {
                $table->dropColumn('api_token_expires_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (! Schema::hasColumn('users', 'api_token')) {
                $table->string('api_token', 64)->nullable()->unique();
            }

            if (! Schema::hasColumn('users', 'api_token_expires_at')) {
                $table->timestamp('api_token_expires_at')->nullable();
            }
        });
    }
};
