<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Sessions d'authentification JWT, une par appareil.
 *
 * Le jeton d'acces (JWT) porte l'identifiant de session (`sid`) : revoquer la
 * session coupe immediatement l'acces, sans attendre l'expiration du JWT.
 *
 * Les refresh tokens ne sont jamais stockes en clair : seule leur empreinte
 * SHA-256 est conservee. Un refresh token deja utilise (`used_at` renseigne)
 * qui revient signe un vol : toute la session est alors revoquee.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('auth_sessions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('device_name', 100);
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('reauthenticated_at')->nullable();
            $table->dateTime('expires_at');
            $table->timestamp('revoked_at')->nullable();
            $table->string('revoked_reason', 50)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'revoked_at']);
        });

        Schema::create('refresh_tokens', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('auth_session_id')->constrained('auth_sessions')->cascadeOnDelete();
            $table->char('token_hash', 64)->unique();
            $table->dateTime('expires_at');
            $table->timestamp('used_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('refresh_tokens');
        Schema::dropIfExists('auth_sessions');
    }
};
