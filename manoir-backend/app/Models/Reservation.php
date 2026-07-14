<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Reservation extends Model
{
    protected $fillable = [
        'user_id',
        'room_id',
        'category_type',
        'check_in',
        'check_out',
        'guests',
        'total_price',
        'deposit_daily_rate',
        'deposit_amount',
        'stay_amount',
        'cancellation_consumed_days',
        'cancellation_retained_amount',
        'cancellation_refund_amount',
        'status',
        'admin_notes',
        'special_requests',
        'approved_at',
        'payment_deadline',
        'paid_at',
        'stay_paid_at',
        'cancelled_at',
        'refunded_at',
        'deposit_invoice_number',
        'stay_invoice_number',
        'cancellation_document_number',
        'deposit_invoice_downloaded',
        'stay_invoice_downloaded',
    ];

    protected function casts(): array
    {
        return [
            'check_in' => 'date',
            'check_out' => 'date',
            'approved_at' => 'datetime',
            'payment_deadline' => 'datetime',
            'paid_at' => 'datetime',
            'stay_paid_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'refunded_at' => 'datetime',
            'deposit_invoice_downloaded' => 'boolean',
            'stay_invoice_downloaded' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class);
    }

    public function isExpired(): bool
    {
        return $this->status === 'VALIDEE_PAIEMENT_REQUIS'
            && $this->payment_deadline
            && now()->greaterThan($this->payment_deadline);
    }

    public function expireIfPaymentDeadlinePassed(): bool
    {
        if (! $this->isExpired()) {
            return false;
        }

        return $this->update(['status' => 'EXPIREE']);
    }

    public static function expireOverduePaymentRequests(?int $userId = null): int
    {
        $query = self::query()
            ->where('status', 'VALIDEE_PAIEMENT_REQUIS')
            ->whereNotNull('payment_deadline')
            ->where('payment_deadline', '<=', now());

        if ($userId) {
            $query->where('user_id', $userId);
        }

        return $query->update(['status' => 'EXPIREE']);
    }

    public function nightsCount(): int
    {
        return max(1, $this->check_in->diffInDays($this->check_out));
    }
}
