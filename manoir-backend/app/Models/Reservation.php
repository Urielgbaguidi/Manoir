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
        'released_at',
        'released_by_admin_id',
        'release_notes',
        'deposit_invoice_number',
        'stay_invoice_number',
        'cancellation_document_number',
        'deposit_invoice_downloaded',
        'stay_invoice_downloaded',
        'extension_status',
        'extension_previous_check_out',
        'extension_requested_check_out',
        'extension_requested_at',
        'extension_processed_at',
        'extension_admin_notes',
    ];

    protected function casts(): array
    {
        return [
            // 'date:Y-m-d' et non 'date' : sans format explicite, Laravel
            // serialise une date en horodatage UTC. Une arrivee le 24 aout a
            // Cotonou sortait en '2026-08-23T23:00:00Z', que le navigateur
            // pouvait afficher au 23.
            'check_in' => 'date:Y-m-d',
            'check_out' => 'date:Y-m-d',
            'approved_at' => 'datetime',
            'payment_deadline' => 'datetime',
            'paid_at' => 'datetime',
            'stay_paid_at' => 'datetime',
            'cancelled_at' => 'datetime',
            'refunded_at' => 'datetime',
            'released_at' => 'datetime',
            'deposit_invoice_downloaded' => 'boolean',
            'stay_invoice_downloaded' => 'boolean',
            'extension_previous_check_out' => 'date:Y-m-d',
            'extension_requested_check_out' => 'date:Y-m-d',
            'extension_requested_at' => 'datetime',
            'extension_processed_at' => 'datetime',
            'google_synced_at' => 'datetime',
            'client_hidden_at' => 'datetime',
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

    public function releasedByAdmin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'released_by_admin_id');
    }

    public function notifications(): HasMany
    {
        return $this->hasMany(Notification::class);
    }

    public function isExpired(): bool
    {
        if ($this->status !== 'VALIDEE_PAIEMENT_REQUIS') {
            return false;
        }

        $paymentDeadlinePassed = $this->payment_deadline && now()->greaterThanOrEqualTo($this->payment_deadline);

        // Une arrivee le jour meme reste valable : un appartement libre ce soir
        // doit pouvoir se louer ce soir. Seule une date d'arrivee DEPASSEE
        // condamne la demande.
        $arrivalDatePassed = $this->check_in->copy()->startOfDay()->lessThan(now()->startOfDay());

        return $paymentDeadlinePassed || $arrivalDatePassed;
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
            ->where(function ($query) {
                $query->where('payment_deadline', '<=', now())
                    ->orWhereDate('check_in', '<', now()->toDateString());
            });

        if ($userId) {
            $query->where('user_id', $userId);
        }

        return $query->update(['status' => 'EXPIREE']);
    }

    /**
     * Solde restant apres l'acompte.
     *
     * L'acompte se deduit du sejour : le client verse d'abord un pourcentage,
     * puis ce solde. Les deux additionnes font le prix du sejour, jamais plus.
     */
    public function balanceAmount(): int
    {
        return max(0, (int) $this->stay_amount - (int) $this->deposit_amount);
    }

    /**
     * Part du sejour representee par l'acompte, pour l'affichage (« 30 % »).
     */
    public function depositPercentage(): int
    {
        $sejour = (int) $this->stay_amount;

        if ($sejour <= 0) {
            return 0;
        }

        return (int) round(((int) $this->deposit_amount / $sejour) * 100);
    }

    /**
     * Statuts pour lesquels le client n'a plus rien a faire ni a attendre.
     *
     * @var array<int, string>
     */
    public const STATUTS_TERMINES = [
        'REFUSEE',
        'EXPIREE',
        'SEJOUR_PAYE',
        'ANNULEE',
        'REMBOURSEE',
        'LIBEREE',
    ];

    /**
     * Le client peut-il retirer cette reservation de son historique ?
     *
     * Une reservation encore vivante ne doit jamais pouvoir etre masquee : le
     * client perdrait l'acces a son paiement ou a son sejour a venir. Un sejour
     * paye ne se masque donc qu'une fois le depart passe.
     */
    public function peutEtreMasquee(): bool
    {
        if (! in_array($this->status, self::STATUTS_TERMINES, true)) {
            return false;
        }

        if ($this->status === 'SEJOUR_PAYE') {
            return $this->check_out->copy()->startOfDay()->lessThan(now()->startOfDay());
        }

        return true;
    }

    public function nightsCount(): int
    {
        return max(1, $this->check_in->diffInDays($this->check_out));
    }

    public function canRequestStayExtension(): bool
    {
        return $this->status === 'CONFIRMEE'
            && $this->room_id
            && ! $this->stay_paid_at
            && ! $this->stay_invoice_number
            && $this->extension_status !== 'EN_ATTENTE'
            && now()->startOfDay()->greaterThanOrEqualTo($this->check_in->copy()->addDay()->startOfDay())
            && now()->startOfDay()->lessThan($this->check_out->copy()->startOfDay());
    }
}
