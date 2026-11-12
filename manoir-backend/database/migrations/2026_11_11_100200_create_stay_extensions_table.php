<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Demandes de prolongation de sejour.
 *
 * Une table dediee plutot que des colonnes sur `reservations` : une prolongation
 * a son propre cycle (en attente -> validee -> payee), son propre paiement et
 * son propre Bon de Sejour, et un client peut prolonger plusieurs fois.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stay_extensions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reservation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('previous_check_out');
            $table->date('requested_check_out');
            $table->unsignedInteger('nights');
            $table->unsignedInteger('price_per_night');
            $table->unsignedInteger('amount');
            $table->string('status', 30)->default('EN_ATTENTE');
            $table->text('admin_notes')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamp('payment_deadline')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();

            $table->index('status');
            $table->index(['reservation_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stay_extensions');
    }
};
