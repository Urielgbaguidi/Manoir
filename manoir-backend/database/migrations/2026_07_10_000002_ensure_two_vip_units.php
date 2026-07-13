<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        foreach ($this->vipUnits() as $unit) {
            DB::table('rooms')->updateOrInsert(
                ['slug' => $unit['slug']],
                [
                    'name' => $unit['name'],
                    'description' => $unit['description'],
                    'max_occupants' => 2,
                    'apartment_number' => $unit['apartment_number'],
                    'base_price' => $unit['base_price'],
                    'deposit' => 500000,
                    'type' => 'vip',
                    'images' => json_encode($unit['images']),
                    'videos' => json_encode([]),
                    'equipments' => json_encode($unit['equipments']),
                    'status' => 'available',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }

        DB::table('rooms')
            ->where('type', 'vip')
            ->whereNotIn('slug', ['appartement-vip-1', 'appartement-vip-2'])
            ->update([
                'status' => 'unavailable',
                'updated_at' => now(),
            ]);

        DB::table('room_categories')->where('type', 'vip')->update([
            'price_per_night' => 30000,
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('rooms')
            ->where('type', 'vip')
            ->whereNotIn('slug', ['appartement-vip-1', 'appartement-vip-2'])
            ->update([
                'status' => 'available',
                'updated_at' => now(),
            ]);
    }

    private function vipUnits(): array
    {
        return [
            [
                'name' => 'VIP 1',
                'slug' => 'appartement-vip-1',
                'description' => 'Appartement VIP 1 du Manoir, pense pour un sejour intime avec finitions premium, salon elegant et galerie propre a cet appartement.',
                'apartment_number' => 3,
                'base_price' => 30000,
                'images' => ['/assets/rooms/room1.jpg', '/assets/rooms/room2.jpg', '/assets/rooms/room3.jpg'],
                'equipments' => ['wifi', 'climatisation', 'jacuzzi', 'tv', 'minibar', 'vue_panoramique', 'terrasse', 'concierge'],
            ],
            [
                'name' => 'VIP 2',
                'slug' => 'appartement-vip-2',
                'description' => 'Appartement VIP 2 du Manoir, plus exclusif, avec ambiance feutree, confort renforce et galerie dediee.',
                'apartment_number' => 7,
                'base_price' => 40000,
                'images' => ['/assets/rooms/room2.jpg', '/assets/rooms/room1.jpg', '/assets/rooms/room4.jpg'],
                'equipments' => ['wifi', 'climatisation', 'jacuzzi', 'tv', 'minibar', 'jardin', 'piscine', 'concierge'],
            ],
        ];
    }
};
