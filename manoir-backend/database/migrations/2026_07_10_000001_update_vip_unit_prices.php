<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('rooms')->where('slug', 'appartement-vip-1')->update([
            'base_price' => 30000,
            'updated_at' => now(),
        ]);

        DB::table('rooms')->where('slug', 'appartement-vip-2')->update([
            'base_price' => 40000,
            'updated_at' => now(),
        ]);

        DB::table('seasonal_prices')
            ->whereIn('room_id', DB::table('rooms')->where('slug', 'appartement-vip-1')->select('id'))
            ->update([
                'price' => 30000,
                'updated_at' => now(),
            ]);

        DB::table('seasonal_prices')
            ->whereIn('room_id', DB::table('rooms')->where('slug', 'appartement-vip-2')->select('id'))
            ->update([
                'price' => 40000,
                'updated_at' => now(),
            ]);

        DB::table('room_categories')->where('type', 'vip')->update([
            'price_per_night' => 30000,
            'short_description' => 'Deux appartements VIP distincts, avec galeries propres et prix differencies a partir de 30 000 F.',
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('rooms')->where('slug', 'appartement-vip-1')->update([
            'base_price' => 40000,
            'updated_at' => now(),
        ]);

        DB::table('rooms')->where('slug', 'appartement-vip-2')->update([
            'base_price' => 50000,
            'updated_at' => now(),
        ]);

        DB::table('seasonal_prices')
            ->whereIn('room_id', DB::table('rooms')->where('slug', 'appartement-vip-1')->select('id'))
            ->update([
                'price' => 40000,
                'updated_at' => now(),
            ]);

        DB::table('seasonal_prices')
            ->whereIn('room_id', DB::table('rooms')->where('slug', 'appartement-vip-2')->select('id'))
            ->update([
                'price' => 50000,
                'updated_at' => now(),
            ]);

        DB::table('room_categories')->where('type', 'vip')->update([
            'price_per_night' => 40000,
            'updated_at' => now(),
        ]);
    }
};
