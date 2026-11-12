<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Payment extends Model
{
    public const STATUS_PENDING = 'pending';

    public const STATUS_SUCCESS = 'success';

    public const STATUS_FAILED = 'failed';

    public const TYPE_STAY = 'stay';

    public const TYPE_EXTENSION = 'extension';

    protected $fillable = [
        'reservation_id',
        'stay_extension_id',
        'payment_method',
        'provider',
        'channel',
        'transaction_id',
        'idempotency_key',
        'provider_reference',
        'payment_type',
        'invoice_number',
        'status',
        'provider_status',
        'failure_reason',
        'amount',
        'metadata',
        'paid_at',
        'last_checked_at',
    ];

    /**
     * La requete envoyee a FeexPay (conservee pour la rejouer a l'identique)
     * et la cle d'idempotence restent internes.
     *
     * @var array<int, string>
     */
    protected $hidden = ['metadata', 'idempotency_key'];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'paid_at' => 'datetime',
            'last_checked_at' => 'datetime',
            'amount' => 'integer',
        ];
    }

    public function reservation(): BelongsTo
    {
        return $this->belongsTo(Reservation::class);
    }

    public function stayExtension(): BelongsTo
    {
        return $this->belongsTo(StayExtension::class);
    }

    public function voucher(): HasOne
    {
        return $this->hasOne(StayVoucher::class);
    }

    public function isFinal(): bool
    {
        return in_array($this->status, [self::STATUS_SUCCESS, self::STATUS_FAILED], true);
    }
}
