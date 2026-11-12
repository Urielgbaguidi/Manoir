<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Bon de Sejour : facture emise une seule fois, apres un paiement confirme.
 */
class StayVoucher extends Model
{
    protected $fillable = [
        'payment_id',
        'reservation_id',
        'stay_extension_id',
        'number',
        'transaction_reference',
        'amount',
        'issued_at',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'issued_at' => 'datetime',
        ];
    }

    public function payment(): BelongsTo
    {
        return $this->belongsTo(Payment::class);
    }

    public function reservation(): BelongsTo
    {
        return $this->belongsTo(Reservation::class);
    }

    public function stayExtension(): BelongsTo
    {
        return $this->belongsTo(StayExtension::class);
    }

    public function isForExtension(): bool
    {
        return $this->stay_extension_id !== null;
    }
}
