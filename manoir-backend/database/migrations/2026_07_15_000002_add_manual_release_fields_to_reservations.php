<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->timestamp('released_at')->nullable();
            $table->unsignedBigInteger('released_by_admin_id')->nullable();
            $table->text('release_notes')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropColumn([
                'released_at',
                'released_by_admin_id',
                'release_notes',
            ]);
        });
    }
};
