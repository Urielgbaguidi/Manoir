<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('rooms', 'apartment_number')) {
            Schema::table('rooms', function (Blueprint $table) {
                $table->unsignedInteger('apartment_number')->nullable()->after('max_occupants');
            });
        }

        DB::table('room_categories')->where('type', 'vip')->update([
            'price_per_night' => 30000,
            'deposit_per_day' => 500000,
            'short_description' => 'Deux appartements VIP avec chacun son ambiance, ses photos et son prix par nuit.',
            'full_description' => "La categorie VIP reunit deux appartements distincts du Manoir. Chaque appartement dispose de sa propre galerie, de ses videos et d'un niveau de confort exclusif.",
            'updated_at' => now(),
        ]);

        DB::table('room_categories')->where('type', 'deux_chambres')->update([
            'price_per_night' => 118000,
            'deposit_per_day' => 300000,
            'updated_at' => now(),
        ]);

        DB::table('room_categories')->where('type', 'une_chambre')->update([
            'price_per_night' => 85000,
            'deposit_per_day' => 200000,
            'updated_at' => now(),
        ]);

        foreach ($this->units() as $unit) {
            DB::table('rooms')->where('slug', $unit['slug'])->update([
                'name' => $unit['name'],
                'description' => $unit['description'],
                'max_occupants' => $unit['max_occupants'],
                'apartment_number' => $unit['apartment_number'],
                'base_price' => $unit['base_price'],
                'deposit' => $unit['deposit'],
                'type' => $unit['type'],
                'images' => json_encode($unit['images']),
                'videos' => json_encode($unit['videos']),
                'equipments' => json_encode($unit['equipments']),
                'status' => 'available',
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('rooms', 'apartment_number')) {
            Schema::table('rooms', function (Blueprint $table) {
                $table->dropColumn('apartment_number');
            });
        }
    }

    private function units(): array
    {
        return [
            [
                'name' => 'VIP 3',
                'slug' => 'appartement-vip-1',
                'description' => 'Appartement VIP 3 du Manoir, pense pour un sejour intime avec finitions premium, salon elegant et galerie propre a cet appartement.',
                'max_occupants' => 2,
                'apartment_number' => 3,
                'base_price' => 30000,
                'deposit' => 500000,
                'type' => 'vip',
                'images' => ['/assets/rooms/room1.jpg', '/assets/rooms/room2.jpg', '/assets/rooms/room3.jpg'],
                'videos' => [],
                'equipments' => ['wifi', 'climatisation', 'tv', 'minibar', 'concierge'],
            ],
            [
                'name' => 'VIP 7',
                'slug' => 'appartement-vip-2',
                'description' => 'Appartement VIP 7 du Manoir, plus exclusif, avec ambiance feutree, confort renforce et galerie dediee.',
                'max_occupants' => 2,
                'apartment_number' => 7,
                'base_price' => 40000,
                'deposit' => 500000,
                'type' => 'vip',
                'images' => ['/assets/rooms/room2.jpg', '/assets/rooms/room1.jpg', '/assets/rooms/room4.jpg'],
                'videos' => [],
                'equipments' => ['wifi', 'climatisation', 'tv', 'minibar', 'concierge'],
            ],
            ...array_map(fn (array $unit) => $this->categoryUnit($unit, 'deux_chambres', 'Appartement 2 Chambres', 4, 118000, 300000), [
                ['number' => 2, 'slug' => 'appartement-2ch-1'],
                ['number' => 4, 'slug' => 'appartement-2ch-2'],
                ['number' => 6, 'slug' => 'appartement-2ch-3'],
                ['number' => 8, 'slug' => 'appartement-2ch-4'],
            ]),
            ...array_map(fn (array $unit) => $this->categoryUnit($unit, 'une_chambre', 'Appartement 1 Chambre', 2, 85000, 200000), [
                ['number' => 1, 'slug' => 'appartement-1ch-1'],
                ['number' => 5, 'slug' => 'appartement-1ch-2'],
            ]),
        ];
    }

    private function categoryUnit(array $unit, string $type, string $label, int $maxOccupants, int $price, int $deposit): array
    {
        $images = $type === 'deux_chambres'
            ? ['/assets/rooms/room4.jpg', '/assets/rooms/room3.jpg', '/assets/rooms/room1.jpg', '/assets/rooms/room2.jpg']
            : ['/assets/rooms/room3.jpg', '/assets/rooms/room1.jpg', '/assets/rooms/room2.jpg'];

        return [
            'name' => $label,
            'slug' => $unit['slug'],
            'description' => "{$label} du Manoir. Le numero exact est attribue automatiquement selon les disponibilites.",
            'max_occupants' => $maxOccupants,
            'apartment_number' => $unit['number'],
            'base_price' => $price,
            'deposit' => $deposit,
            'type' => $type,
            'images' => $images,
            'videos' => [],
            'equipments' => ['wifi', 'climatisation', 'tv'],
        ];
    }
};
