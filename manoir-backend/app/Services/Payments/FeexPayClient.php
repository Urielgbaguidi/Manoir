<?php

namespace App\Services\Payments;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Client HTTP FeexPay (API v2), cote serveur uniquement.
 *
 * Le paiement est realise par le checkout officiel FeexPay dans le
 * navigateur ; le serveur ne fait que VERIFIER le resultat :
 *  - GET /api/transactions/public/single/status/{reference}
 *  - GET /api/transactions/public/single/status/{valeur}?by=description
 *
 * Reference : https://docs.feexpay.me/?section=sandbox&version=v2
 */
class FeexPayClient
{
    public function isConfigured(): bool
    {
        return filled(config('feexpay.api_key')) && filled(config('feexpay.shop_id'));
    }

    /**
     * Statut d'une transaction, par reference FeexPay ou, avec `$by`, par un
     * autre champ (`description`, `callback_info`). La valeur doit etre un
     * seul mot ; 409 SEARCHKEY_AMBIGUOUS si plusieurs transactions correspondent.
     */
    public function transactionStatus(string $value, ?string $by = null): FeexPayResponse
    {
        $this->ensureConfigured();

        try {
            $response = $this->http()->get(
                '/api/transactions/public/single/status/'.rawurlencode($value),
                $by ? ['by' => $by] : []
            );
        } catch (ConnectionException $exception) {
            Log::warning('FeexPay injoignable (statut)', ['error' => $exception->getMessage()]);

            return FeexPayResponse::unreachable();
        }

        return new FeexPayResponse($response->status(), (array) ($response->json() ?? []));
    }

    private function http(): PendingRequest
    {
        return Http::baseUrl((string) config('feexpay.base_url'))
            ->withToken((string) config('feexpay.api_key'))
            ->acceptJson()
            ->timeout(max(5, (int) config('feexpay.timeout', 20)))
            ->connectTimeout(10)
            // Nouvel essai uniquement sur coupure reseau (un 404 « pas encore
            // payee » est une reponse normale).
            ->retry(
                max(1, (int) config('feexpay.retries', 2) + 1),
                500,
                fn ($exception) => $exception instanceof ConnectionException,
                throw: false,
            );
    }

    private function ensureConfigured(): void
    {
        if (! $this->isConfigured()) {
            throw new FeexPayNotConfiguredException;
        }
    }
}
