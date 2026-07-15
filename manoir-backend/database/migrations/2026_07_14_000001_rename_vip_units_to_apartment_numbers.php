<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('rooms')->where('slug', 'appartement-vip-1')->update([
            'name' => 'VIP 3',
            'updated_at' => now(),
        ]);

        DB::table('rooms')->where('slug', 'appartement-vip-2')->update([
            'name' => 'VIP 7',
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        DB::table('rooms')->where('slug', 'appartement-vip-1')->update([
            'name' => 'VIP 1',
            'updated_at' => now(),
        ]);

        DB::table('rooms')->where('slug', 'appartement-vip-2')->update([
            'name' => 'VIP 2',
            'updated_at' => now(),
        ]);
    }
};
