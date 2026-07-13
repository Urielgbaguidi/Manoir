<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
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
        // These numberless rows are legacy fallback units and should not be bookable.
    }
};
