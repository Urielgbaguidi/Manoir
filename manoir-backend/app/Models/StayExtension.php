<?php

namespace App\Models;

use Database\Factories\StayExtensionFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Carbon;

/**
 * Demande de prolongation d'un sejour en cours.
 *
 * Cycle : EN_ATTENTE -> (admin) VALIDEE_PAIEMENT_REQUIS -> (paiement) PAYEE,
 * ou REFUSEE / EXPIREE / ANNULEE.
 *
 * @property Carbon $previous_check_out
 * @property Carbon $requested_check_out
 * @property Carbon|null $payment_deadline
 */
class StayExtension extends Model
{
    /** @use HasFactory<StayExtensionFactory> */
    use HasFactory;

    public const STATUS_PENDING = 'EN_ATTENTE';

    public const STATUS_AWAITING_PAYMENT = 'VALIDEE_PAIEMENT_REQUIS';

    public const STATUS_PAID = 'PAYEE';

    public const STATUS_REJECTED = 'REFUSEE';

    public const STATUS_EXPIRED = 'EXPIREE';

    /** @var array<int, string> */
    public const STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_AWAITING_PAYMENT,
        self::STATUS_PAID,
        self::STATUS_REJECTED,
        self::STATUS_EXPIRED,
    ];

    /** Statuts qui empechent une nouvelle demande sur la meme reservation. */
    public const OPEN_STATUSES = [self::STATUS_PENDING, self::STATUS_AWAITING_PAYMENT];

    protected $fillable = [
        'reservation_id',
        'user_id',
        'previous_check_out',
        'requested_check_out',
        'nights',
        'price_per_night',
        'amount',
        'status',
        'admin_notes',
        'approved_at',
        'processed_at',
        'payment_deadline',
        'paid_at',
    ];

    protected function casts(): array
    {
        return [
            'previous_check_out' => 'date:Y-m-d',
            'requested_check_out' => 'date:Y-m-d',
            'nights' => 'integer',
            'price_per_night' => 'integer',
            'amount' => 'integer',
            'approved_at' => 'datetime',
            'processed_at' => 'datetime',
            'payment_deadline' => 'datetime',
            'paid_at' => 'datetime',
        ];
    }

    public function reservation(): BelongsTo
    {
        return $this->belongsTo(Reservation::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function voucher(): HasOne
    {
        return $this->hasOne(StayVoucher::class);
    }

    /**
     * Prolongations validees dont le paiement est encore attendu : elles
     * retiennent les nuits supplementaires jusqu'a l'echeance.
     *
     * @param  Builder<StayExtension>  $query
     */
    public function scopeHoldingNights(Builder $query): void
    {
        $query->where('status', self::STATUS_AWAITING_PAYMENT)
            ->where(function (Builder $query) {
                $query->whereNull('payment_deadline')->orWhere('payment_deadline', '>', now());
            });
    }

    public function isPayable(): bool
    {
        return $this->status === self::STATUS_AWAITING_PAYMENT
            && ($this->payment_deadline === null || $this->payment_deadline->isFuture());
    }

    public static function expireOverdue(): int
    {
        return self::query()
            ->where('status', self::STATUS_AWAITING_PAYMENT)
            ->whereNotNull('payment_deadline')
            ->where('payment_deadline', '<=', now())
            ->update(['status' => self::STATUS_EXPIRED, 'processed_at' => now()]);
    }
}
