<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Periode pendant laquelle un appartement est indisponible sans qu'une
 * reservation du site en soit la cause (agenda Google, travaux, blocage admin).
 */
class RoomBlock extends Model
{
    public const SOURCE_GOOGLE = 'google_calendar';

    public const SOURCE_MANUAL = 'manual';

    protected $fillable = [
        'room_id',
        'starts_on',
        'ends_on',
        'source',
        'external_id',
        'summary',
        'notes',
        'synced_at',
    ];

    protected function casts(): array
    {
        return [
            'starts_on' => 'date',
            'ends_on' => 'date',
            'synced_at' => 'datetime',
        ];
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    /**
     * Blocages qui chevauchent l'intervalle demande.
     *
     * Le jour de depart est exclu des deux cotes : un blocage qui se termine
     * le 21 n'empeche pas une arrivee le 21.
     */
    public function scopeOverlapping(Builder $query, string $checkIn, string $checkOut): Builder
    {
        // whereDate et non where : selon le moteur, une colonne `date` peut etre
        // stockee avec une heure ('2026-09-15 00:00:00'). Une comparaison de
        // chaines ferait alors passer ce depart pour posterieur au 15 et
        // bloquerait a tort la nuit du 15.
        return $query->whereDate('starts_on', '<', $checkOut)
            ->whereDate('ends_on', '>', $checkIn);
    }
}
