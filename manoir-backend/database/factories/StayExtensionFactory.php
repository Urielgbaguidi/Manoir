<?php

namespace Database\Factories;

use App\Models\Reservation;
use App\Models\StayExtension;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<StayExtension>
 */
class StayExtensionFactory extends Factory
{
    /**
     * Prolongation de 2 nuits d'une reservation existante, a fournir via
     * `for($reservation)`.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'nights' => 2,
            'price_per_night' => 30000,
            'amount' => 60000,
            'status' => StayExtension::STATUS_PENDING,
        ];
    }

    public function forReservation(Reservation $reservation, int $nights = 2): static
    {
        $previous = $reservation->check_out->copy();

        return $this->state(fn () => [
            'reservation_id' => $reservation->id,
            'user_id' => $reservation->user_id,
            'previous_check_out' => $previous->toDateString(),
            'requested_check_out' => $previous->copy()->addDays($nights)->toDateString(),
            'nights' => $nights,
        ]);
    }

    public function awaitingPayment(): static
    {
        return $this->state(fn () => [
            'status' => StayExtension::STATUS_AWAITING_PAYMENT,
            'approved_at' => now(),
            'payment_deadline' => now()->addHours(12),
        ]);
    }
}
