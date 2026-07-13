<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->integer('deposit')->nullable()->after('base_price'); // Caution en FCFA
            $table->json('videos')->nullable()->after('images'); // Vidéos de la chambre
        });
    }

    public function down(): void
    {
        Schema::table('rooms', function (Blueprint $table) {
            $table->dropColumn(['deposit', 'videos']);
        });
    }
};
