<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class RoomCategory extends Model
{
    protected $fillable = [
        'type',
        'slug',
        'label',
        'rank_label',
        'short_description',
        'full_description',
        'price_per_night',
        'deposit_per_day',
        'is_blocked',
        'images',
        'videos',
    ];

    protected function casts(): array
    {
        return [
            'is_blocked' => 'boolean',
            'images' => 'array',
            'videos' => 'array',
        ];
    }

    public const TYPES = ['vip', 'deux_chambres', 'une_chambre'];

    private const DEFAULT_OCCUPANTS = [
        'vip' => 2,
        'deux_chambres' => 4,
        'une_chambre' => 2,
    ];

    public static function findBySlugOrType(string $value): ?self
    {
        return self::where('slug', $value)->orWhere('type', $value)->first();
    }

    public function rooms(): Builder
    {
        return Room::query()->where('type', $this->type);
    }

    public function hasDateConflict(string $checkIn, string $checkOut, ?int $excludeReservationId = null): bool
    {
        return $this->availableRoomForDates($checkIn, $checkOut, null, $excludeReservationId) === null;
    }

    public function availableRoomForDates(
        string $checkIn,
        string $checkOut,
        ?int $preferredRoomId = null,
        ?int $excludeReservationId = null
    ): ?Room {
        if ($this->is_blocked) {
            return null;
        }

        $query = $this->rooms()
            ->where('status', 'available')
            ->whereNotNull('apartment_number')
            ->orderBy('apartment_number')
            ->orderBy('id');

        if ($preferredRoomId) {
            $preferredRoom = (clone $query)->where('id', $preferredRoomId)->first();

            if (! $preferredRoom) {
                return null;
            }

            return $preferredRoom->isAvailableForDates($checkIn, $checkOut, $excludeReservationId)
                ? $preferredRoom
                : null;
        }

        return $query->get()->first(
            fn (Room $room) => $room->isAvailableForDates($checkIn, $checkOut, $excludeReservationId)
        );
    }

    public function isAvailableForDates(string $checkIn, string $checkOut): bool
    {
        return $this->availableRoomForDates($checkIn, $checkOut) !== null;
    }

    public function bookableRoom(): Room
    {
        $room = $this->rooms()
            ->where('status', 'available')
            ->whereNotNull('apartment_number')
            ->orderBy('apartment_number')
            ->orderBy('id')
            ->first();

        if ($room) {
            return $room;
        }

        return Room::create([
            'name' => $this->label,
            'slug' => "{$this->slug}-reservation-unit",
            'description' => $this->full_description,
            'max_occupants' => self::DEFAULT_OCCUPANTS[$this->type] ?? 2,
            'apartment_number' => null,
            'base_price' => $this->price_per_night,
            'deposit' => $this->deposit_per_day,
            'type' => $this->type,
            'images' => $this->images ?? [],
            'videos' => $this->videos ?? [],
            'equipments' => [],
            'status' => 'available',
        ]);
    }
}
