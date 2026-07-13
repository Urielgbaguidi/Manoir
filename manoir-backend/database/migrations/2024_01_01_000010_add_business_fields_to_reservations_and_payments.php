<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->string('category_type')->nullable()->after('room_id');
            $table->integer('deposit_daily_rate')->default(0)->after('total_price');
            $table->integer('deposit_amount')->default(0)->after('deposit_daily_rate');
            $table->integer('stay_amount')->default(0)->after('deposit_amount');
            $table->timestamp('stay_paid_at')->nullable()->after('paid_at');
            $table->string('deposit_invoice_number')->nullable()->after('stay_paid_at');
            $table->string('stay_invoice_number')->nullable()->after('deposit_invoice_number');
        });

        Schema::table('payments', function (Blueprint $table) {
            $table->string('payment_type')->default('deposit')->after('reservation_id');
            $table->string('invoice_number')->nullable()->after('amount');
        });

        DB::table('reservations')->where('status', 'pending')->update(['status' => 'EN_ATTENTE']);
        DB::table('reservations')->where('status', 'approved_pending_payment')->update(['status' => 'VALIDEE_PAIEMENT_REQUIS']);
        DB::table('reservations')->where('status', 'paid')->update(['status' => 'CONFIRMEE']);
        DB::table('reservations')->where('status', 'rejected')->update(['status' => 'REFUSEE']);
        DB::table('reservations')->where('status', 'expired')->update(['status' => 'EXPIREE']);
    }

    public function down(): void
    {
        Schema::table('payments', function (Blueprint $table) {
            $table->dropColumn(['payment_type', 'invoice_number']);
        });

        Schema::table('reservations', function (Blueprint $table) {
            $table->dropColumn([
                'category_type',
                'deposit_daily_rate',
                'deposit_amount',
                'stay_amount',
                'stay_paid_at',
                'deposit_invoice_number',
                'stay_invoice_number',
            ]);
        });
    }
};
