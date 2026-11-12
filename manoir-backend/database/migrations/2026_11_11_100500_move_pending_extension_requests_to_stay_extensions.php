<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Reprend les demandes de prolongation encore en attente, stockees jusqu'ici
 * dans les colonnes `extension_*` des reservations, dans la nouvelle table.
 * Sans cela, l'administration perdrait de vue des demandes deja envoyees.
 */
return new class extends Migration
{
    public function up(): void
    {
        $pending = DB::table('reservations')
            ->leftJoin('rooms', 'rooms.id', '=', 'reservations.room_id')
            ->where('reservations.extension_status', 'EN_ATTENTE')
            ->whereNotNull('reservations.extension_requested_check_out')
            ->select([
                'reservations.id',
                'reservations.user_id',
                'reservations.check_out',
                'reservations.extension_requested_check_out',
                'reservations.extension_requested_at',
                'rooms.base_price',
            ])
            ->get();

        foreach ($pending as $reservation) {
            $previous = Carbon::parse($reservation->check_out)->startOfDay();
            $requested = Carbon::parse($reservation->extension_requested_check_out)->startOfDay();
            $nights = max(1, (int) $previous->diffInDays($requested));
            $pricePerNight = (int) ($reservation->base_price ?? 0);

            DB::table('stay_extensions')->insert([
                'reservation_id' => $reservation->id,
                'user_id' => $reservation->user_id,
                'previous_check_out' => $previous->toDateString(),
                'requested_check_out' => $requested->toDateString(),
                'nights' => $nights,
                'price_per_night' => $pricePerNight,
                'amount' => $nights * $pricePerNight,
                'status' => 'EN_ATTENTE',
                'created_at' => $reservation->extension_requested_at ?? now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        //
    }
};
