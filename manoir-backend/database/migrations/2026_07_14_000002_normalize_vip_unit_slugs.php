<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $this->normalizeVipUnit(3, 'VIP 3', 'appartement-vip-1');
        $this->normalizeVipUnit(7, 'VIP 7', 'appartement-vip-2');
    }

    public function down(): void
    {
        DB::table('rooms')->where('type', 'vip')->where('apartment_number', 3)->update([
            'name' => 'VIP 1',
            'updated_at' => now(),
        ]);

        DB::table('rooms')->where('type', 'vip')->where('apartment_number', 7)->update([
            'name' => 'VIP 2',
            'updated_at' => now(),
        ]);
    }

    private function normalizeVipUnit(int $apartmentNumber, string $name, string $canonicalSlug): void
    {
        $room = DB::table('rooms')
            ->where('type', 'vip')
            ->where('apartment_number', $apartmentNumber)
            ->orderBy('id')
            ->first();

        if (! $room) {
            $room = DB::table('rooms')->where('slug', $canonicalSlug)->first();
        }

        if (! $room) {
            return;
        }

        $slugAlreadyUsed = DB::table('rooms')
            ->where('slug', $canonicalSlug)
            ->where('id', '!=', $room->id)
            ->exists();

        $updates = [
            'name' => $name,
            'apartment_number' => $apartmentNumber,
            'updated_at' => now(),
        ];

        if (! $slugAlreadyUsed) {
            $updates['slug'] = $canonicalSlug;
        }

        DB::table('rooms')->where('id', $room->id)->update($updates);
    }
};
