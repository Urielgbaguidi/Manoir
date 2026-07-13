<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('reservation_id')->constrained()->cascadeOnDelete();
            $table->string('payment_method'); // mobile_money, card
            $table->string('provider'); // fedapay, kkiapay, cinetpay
            $table->string('transaction_id')->unique(); // ID de la transaction chez le provider
            $table->string('status')->default('pending'); // pending, success, failed
            $table->integer('amount'); // en FCFA
            $table->json('metadata')->nullable(); // données supplémentaires du provider
            $table->timestamp('paid_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
