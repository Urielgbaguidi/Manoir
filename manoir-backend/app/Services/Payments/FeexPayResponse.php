<?php

namespace App\Services\Payments;

/**
 * Reponse brute d'un appel FeexPay, ou absence de reponse (timeout reseau).
 */
final readonly class FeexPayResponse
{
    /**
     * @param  array<string, mixed>  $body
     */
    public function __construct(
        public ?int $httpStatus,
        public array $body,
    ) {}

    public static function unreachable(): self
    {
        return new self(null, []);
    }

    public function reachedProvider(): bool
    {
        return $this->httpStatus !== null;
    }

    public function successful(): bool
    {
        return $this->httpStatus !== null && $this->httpStatus >= 200 && $this->httpStatus < 300;
    }

    public function reference(): ?string
    {
        $reference = $this->body['reference'] ?? null;

        return is_string($reference) && $reference !== '' ? $reference : null;
    }

    /**
     * PENDING, SUCCESSFUL ou FAILED (en majuscules), ou null.
     */
    public function transactionStatus(): ?string
    {
        $status = $this->body['status'] ?? null;

        return is_string($status) ? strtoupper($status) : null;
    }

    /**
     * Operateur utilise pour la transaction, s'il figure dans la reponse
     * (FeexPay le nomme `reseau` dans ses echanges avec le checkout).
     */
    public function channel(): ?string
    {
        foreach (['reseau', 'network', 'operator', 'payment_method'] as $key) {
            $channel = PaymentChannel::normalize($this->body[$key] ?? null);

            if ($channel !== null) {
                return $channel;
            }
        }

        return null;
    }

    public function errorCode(): ?string
    {
        $code = $this->body['code'] ?? $this->body['idempotency_code'] ?? null;

        return is_string($code) ? $code : null;
    }

    public function message(): ?string
    {
        foreach (['reason', 'message', 'error'] as $key) {
            if (isset($this->body[$key]) && is_string($this->body[$key]) && $this->body[$key] !== '') {
                return mb_substr($this->body[$key], 0, 250);
            }
        }

        return null;
    }
}
