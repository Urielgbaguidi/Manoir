<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Room extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'description',
        'max_occupants',
        'apartment_number',
        'base_price',
        'deposit',
        'type',
        'images',
        'videos',
        'equipments',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'apartment_number' => 'integer',
            'images' => 'array',
            'videos' => 'array',
            'equipments' => 'array',
        ];
    }

    public function seasonalPrices(): HasMany
    {
        return $this->hasMany(SeasonalPrice::class);
    }

    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class);
    }

    public function isAvailableForDates(string $checkIn, string $checkOut, ?int $excludeReservationId = null): bool
    {
        if ($this->status !== 'available') {
            return false;
        }

        $query = $this->reservations()
            ->whereIn('status', ['VALIDEE_PAIEMENT_REQUIS', 'CONFIRMEE', 'SEJOUR_PAYE'])
            ->where(function ($query) use ($checkIn, $checkOut) {
                $query->where('check_in', '<', $checkOut)
                    ->where('check_out', '>', $checkIn);
            });

        if ($excludeReservationId) {
            $query->where('id', '!=', $excludeReservationId);
        }

        return ! $query->exists();
    }

    public function getPriceForDates(string $checkIn, string $checkOut): int
    {
        $totalPrice = 0;
        $currentDate = new \DateTime($checkIn);
        $endDate = new \DateTime($checkOut);
        $interval = new \DateInterval('P1D');
        $period = new \DatePeriod($currentDate, $interval, $endDate);

        foreach ($period as $date) {
            $dateStr = $date->format('Y-m-d');
            $dayOfWeek = $date->format('N'); // 1 (lundi) à 7 (dimanche)
            $isWeekend = $dayOfWeek >= 6; // samedi et dimanche

            $seasonalPrice = $this->seasonalPrices()
                ->where('start_date', '<=', $dateStr)
                ->where('end_date', '>=', $dateStr)
                ->first();

            if ($seasonalPrice) {
                $totalPrice += $seasonalPrice->price;
            } elseif ($isWeekend) {
                $totalPrice += $this->base_price * 1.2; // +20% le week-end
            } else {
                $totalPrice += $this->base_price;
            }
        }

        return (int) $totalPrice;
    }
}
