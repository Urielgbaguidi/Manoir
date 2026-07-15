<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->string('extension_status')->nullable()->after('stay_invoice_downloaded');
            $table->date('extension_previous_check_out')->nullable()->after('extension_status');
            $table->date('extension_requested_check_out')->nullable()->after('extension_previous_check_out');
            $table->timestamp('extension_requested_at')->nullable()->after('extension_requested_check_out');
            $table->timestamp('extension_processed_at')->nullable()->after('extension_requested_at');
            $table->text('extension_admin_notes')->nullable()->after('extension_processed_at');
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropColumn([
                'extension_status',
                'extension_previous_check_out',
                'extension_requested_check_out',
                'extension_requested_at',
                'extension_processed_at',
                'extension_admin_notes',
            ]);
        });
    }
};
