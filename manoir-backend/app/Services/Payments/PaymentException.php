<?php

namespace App\Services\Payments;

use App\Models\Payment;
use RuntimeException;

/**
 * Refus metier d'un paiement, avec le code HTTP a renvoyer au client.
 */
class PaymentException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly int $status = 422,
        public readonly ?Payment $payment = null,
    ) {
        parent::__construct($message);
    }
}
