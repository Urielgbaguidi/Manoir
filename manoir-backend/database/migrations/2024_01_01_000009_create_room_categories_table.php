<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('room_categories', function (Blueprint $table) {
            $table->id();
            $table->string('type')->unique();
            $table->string('slug')->unique();
            $table->string('label');
            $table->string('rank_label');
            $table->text('short_description');
            $table->text('full_description');
            $table->integer('price_per_night')->default(0);
            $table->integer('deposit_per_day')->default(0);
            $table->boolean('is_blocked')->default(false);
            $table->json('images')->nullable();
            $table->json('videos')->nullable();
            $table->timestamps();
        });

        DB::table('room_categories')->insert([
            [
                'type' => 'vip',
                'slug' => 'appartement-vip',
                'label' => 'Appartement VIP',
                'rank_label' => 'Categorie 1',
                'short_description' => "L'excellence du Manoir dans un appartement raffine avec salon spacieux, chambre king-size et prestations premium.",
                'full_description' => 'Les Appartements VIP reunissent les finitions les plus soignees du Manoir: volumes genereux, atmosphere feutree, terrasse ou vue privilegiee, salle de bain premium et services concus pour un sejour exclusif.',
                'price_per_night' => 145000,
                'deposit_per_day' => 500000,
                'images' => json_encode(['/assets/rooms/room1.jpg', '/assets/rooms/room2.jpg', '/assets/rooms/room3.jpg']),
                'videos' => json_encode([]),
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'type' => 'deux_chambres',
                'slug' => 'appartement-2-chambres',
                'label' => 'Appartement 2 Chambres',
                'rank_label' => 'Categorie 2',
                'short_description' => 'Un appartement spacieux pense pour les familles et les groupes, avec deux chambres, salon confortable et cuisine equipee.',
                'full_description' => 'Les Appartements 2 Chambres offrent un bel equilibre entre espace, confort et fonctionnalite. Chaque unite propose deux chambres separees, un salon convivial, une cuisine equipee et des espaces pratiques.',
                'price_per_night' => 118000,
                'deposit_per_day' => 300000,
                'images' => json_encode(['/assets/rooms/room4.jpg', '/assets/rooms/room3.jpg', '/assets/rooms/room1.jpg', '/assets/rooms/room2.jpg']),
                'videos' => json_encode([]),
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'type' => 'une_chambre',
                'slug' => 'appartement-1-chambre',
                'label' => 'Appartement 1 Chambre',
                'rank_label' => 'Categorie 3',
                'short_description' => 'Un cocon elegant et fonctionnel pour deux personnes, parfait pour un sejour calme, simple et soigne.',
                'full_description' => "Les Appartements 1 Chambre privilegient l'intimite et la fluidite du quotidien. Ils combinent une chambre confortable, un salon agreable et une kitchenette moderne.",
                'price_per_night' => 85000,
                'deposit_per_day' => 200000,
                'images' => json_encode(['/assets/rooms/room3.jpg', '/assets/rooms/room1.jpg', '/assets/rooms/room2.jpg']),
                'videos' => json_encode([]),
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('room_categories');
    }
};
