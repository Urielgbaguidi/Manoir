<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rooms', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description');
            $table->integer('max_occupants');
            $table->integer('base_price'); // en FCFA
            $table->string('type'); // standard, deluxe, suite
            $table->json('images')->nullable();
            $table->json('equipments')->nullable(); // wifi, climatisation, etc.
            $table->string('status')->default('available'); // available, maintenance, cleaning
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rooms');
    }
};
