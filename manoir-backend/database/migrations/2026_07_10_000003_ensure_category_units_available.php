<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        foreach ($this->units() as $unit) {
            DB::table('rooms')->updateOrInsert(
                ['slug' => $unit['slug']],
                [
                    'name' => $unit['name'],
                    'description' => $unit['description'],
                    'max_occupants' => $unit['max_occupants'],
                    'apartment_number' => $unit['apartment_number'],
                    'base_price' => $unit['base_price'],
                    'deposit' => $unit['deposit'],
                    'type' => $unit['type'],
                    'images' => json_encode($unit['images']),
                    'videos' => json_encode([]),
                    'equipments' => json_encode($unit['equipments']),
                    'status' => 'available',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }

        DB::table('room_categories')->where('type', 'deux_chambres')->update([
            'price_per_night' => 118000,
            'deposit_per_day' => 300000,
            'is_blocked' => false,
            'updated_at' => now(),
        ]);

        DB::table('room_categories')->where('type', 'une_chambre')->update([
            'price_per_night' => 85000,
            'deposit_per_day' => 200000,
            'is_blocked' => false,
            'updated_at' => now(),
        ]);

        DB::table('rooms')
            ->whereIn('type', ['deux_chambres', 'une_chambre'])
            ->whereNull('apartment_number')
            ->update([
                'status' => 'unavailable',
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        // No destructive rollback: these are the expected bookable physical units.
    }

    private function units(): array
    {
        return [
            ...array_map(
                fn (array $unit) => $this->categoryUnit(
                    $unit,
                    'deux_chambres',
                    'Appartement 2 Chambres',
                    4,
                    118000,
                    300000,
                    ['/assets/rooms/room4.jpg', '/assets/rooms/room3.jpg', '/assets/rooms/room1.jpg', '/assets/rooms/room2.jpg'],
                    ['wifi', 'climatisation', 'cuisine', 'tv', 'parking', 'balcon']
                ),
                [
                    ['number' => 2, 'slug' => 'appartement-2ch-1'],
                    ['number' => 4, 'slug' => 'appartement-2ch-2'],
                    ['number' => 6, 'slug' => 'appartement-2ch-3'],
                    ['number' => 8, 'slug' => 'appartement-2ch-4'],
                ]
            ),
            ...array_map(
                fn (array $unit) => $this->categoryUnit(
                    $unit,
                    'une_chambre',
                    'Appartement 1 Chambre',
                    2,
                    85000,
                    200000,
                    ['/assets/rooms/room3.jpg', '/assets/rooms/room1.jpg', '/assets/rooms/room2.jpg'],
                    ['wifi', 'climatisation', 'cuisine', 'tv', 'minibar']
                ),
                [
                    ['number' => 1, 'slug' => 'appartement-1ch-1'],
                    ['number' => 5, 'slug' => 'appartement-1ch-2'],
                ]
            ),
        ];
    }

    private function categoryUnit(
        array $unit,
        string $type,
        string $label,
        int $maxOccupants,
        int $price,
        int $deposit,
        array $images,
        array $equipments
    ): array {
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
            'equipments' => $equipments,
        ];
    }
};
