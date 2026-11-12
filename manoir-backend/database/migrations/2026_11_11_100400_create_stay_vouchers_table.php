<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Bons de Sejour (factures emises APRES paiement).
 *
 * Les contraintes d'unicite sur `payment_id` et `transaction_reference`
 * garantissent qu'un paiement ne produit jamais deux bons, meme si sa
 * confirmation est traitee deux fois en parallele (verification de statut et,
 * plus tard, webhook FeexPay).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stay_vouchers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('reservation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('stay_extension_id')->nullable()->constrained('stay_extensions')->nullOnDelete();
            $table->string('number', 40)->unique();
            $table->string('transaction_reference', 100)->unique();
            $table->unsignedInteger('amount');
            $table->dateTime('issued_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stay_vouchers');
    }
};
