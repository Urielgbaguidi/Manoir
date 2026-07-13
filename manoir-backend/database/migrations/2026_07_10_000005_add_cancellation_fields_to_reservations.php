<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->timestamp('cancelled_at')->nullable()->after('stay_paid_at');
            $table->timestamp('refunded_at')->nullable()->after('cancelled_at');
            $table->integer('cancellation_consumed_days')->default(0)->after('stay_amount');
            $table->integer('cancellation_retained_amount')->default(0)->after('cancellation_consumed_days');
            $table->integer('cancellation_refund_amount')->default(0)->after('cancellation_retained_amount');
            $table->string('cancellation_document_number')->nullable()->after('stay_invoice_number');
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropColumn([
                'cancelled_at',
                'refunded_at',
                'cancellation_consumed_days',
                'cancellation_retained_amount',
                'cancellation_refund_amount',
                'cancellation_document_number',
            ]);
        });
    }
};
