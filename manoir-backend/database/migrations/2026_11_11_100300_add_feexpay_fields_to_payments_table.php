<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Paiements FeexPay.
 *
 * - `idempotency_key` : cle envoyee a FeexPay (en-tete Idempotency-Key), une
 *   par tentative de paiement, conservee jusqu'a l'etat final pour pouvoir
 *   rejouer exactement la meme requete apres un timeout.
 * - `provider_reference` : reference de transaction FeexPay, UNIQUE : une meme
 *   transaction ne peut jamais etre rattachee a deux paiements.
 * - `stay_extension_id` : renseigne quand le paiement regle une prolongation.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->foreignId('stay_extension_id')->nullable()->after('reservation_id')
                ->constrained('stay_extensions')->nullOnDelete();
            $table->string('channel', 30)->nullable()->after('provider');
            $table->uuid('idempotency_key')->nullable()->unique()->after('transaction_id');
            $table->string('provider_reference', 100)->nullable()->unique()->after('idempotency_key');
            $table->string('provider_status', 30)->nullable()->after('status');
            $table->string('failure_reason')->nullable()->after('provider_status');
            $table->timestamp('last_checked_at')->nullable()->after('paid_at');
        });
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropConstrainedForeignId('stay_extension_id');
            $table->dropUnique(['idempotency_key']);
            $table->dropUnique(['provider_reference']);
            $table->dropColumn(['channel', 'idempotency_key', 'provider_reference', 'provider_status', 'failure_reason', 'last_checked_at']);
        });
    }
};
