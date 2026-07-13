<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->boolean('deposit_invoice_downloaded')->default(false)->after('deposit_invoice_number');
            $table->boolean('stay_invoice_downloaded')->default(false)->after('stay_invoice_number');
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropColumn(['deposit_invoice_downloaded', 'stay_invoice_downloaded']);
        });
    }
};
