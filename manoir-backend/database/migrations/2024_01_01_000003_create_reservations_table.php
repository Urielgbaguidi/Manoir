<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reservations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('room_id')->constrained()->cascadeOnDelete();
            $table->date('check_in');
            $table->date('check_out');
            $table->integer('guests');
            $table->integer('total_price'); // en FCFA
            $table->string('status')->default('pending'); // pending, approved_pending_payment, paid, rejected, expired
            $table->text('admin_notes')->nullable();
            $table->text('special_requests')->nullable(); // late check-out, lit d'appoint, etc.
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('payment_deadline')->nullable(); // 24h après approbation
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reservations');
    }
};
