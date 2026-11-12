<?php

namespace App\Services\Payments;

use App\Models\Payment;
use App\Models\Reservation;
use App\Models\StayExtension;
use App\Models\StayVoucher;
use App\Models\User;
use App\Services\Auth\SecurityLogger;
use App\Services\GoogleCalendarWriter;
use App\Services\Notifications\RequestMailer;
use App\Services\ReservationNotificationService;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;

/**
 * Point UNIQUE de gestion des paiements FeexPay.
 *
 * Le paiement lui-meme se fait dans le checkout officiel FeexPay (choix du
 * moyen de paiement, saisie, validation : tout est gere par FeexPay).
 *
 * - initiate*()            : prepare une tentative (montant, reference unique,
 *                            cle d'idempotence) et la configuration du checkout ;
 * - refresh()              : interroge FeexPay (route de statut) pour savoir
 *                            si la transaction a abouti ;
 * - applyProviderStatus()  : seule methode qui fait passer un paiement a
 *                            l'etat final. Idempotente : un meme statut
 *                            applique deux fois ne produit qu'un seul Bon de
 *                            Sejour. Le futur webhook FeexPay devra passer
 *                            par handleProviderNotification(), qui y mene.
 *
 * Le statut n'est JAMAIS deduit de ce que renvoie le navigateur.
 */
class PaymentService
{
    /** Une tentative non aboutie est reproposee pendant ce delai (meme reference). */
    private const REUSE_PENDING_MINUTES = 60;

    public function __construct(
        private readonly FeexPayClient $feexpay,
        private readonly SecurityLogger $securityLogger,
        private readonly RequestMailer $mailer,
    ) {}

    /**
     * @throws PaymentException
     */
    public function initiateForReservation(Reservation $reservation, User $user): Payment
    {
        $this->ensureProviderReady();

        $payment = DB::transaction(function () use ($reservation) {
            /** @var Reservation $locked */
            $locked = Reservation::whereKey($reservation->id)->lockForUpdate()->firstOrFail();
            $locked->expireIfPaymentDeadlinePassed();

            if ($locked->status !== 'VALIDEE_PAIEMENT_REQUIS') {
                throw new PaymentException(match ($locked->status) {
                    'EN_ATTENTE' => 'Votre demande n\'a pas encore ete validee par l\'administration : le paiement sera ouvert apres validation.',
                    'EXPIREE' => 'Le delai de paiement a expire. Faites une nouvelle demande.',
                    'SEJOUR_PAYE', 'CONFIRMEE' => 'Ce sejour est deja paye.',
                    default => 'Cette reservation ne peut pas etre payee.',
                });
            }

            if ($locked->isExpired()) {
                throw new PaymentException('Le delai de paiement a expire. Faites une nouvelle demande.');
            }

            $amount = $locked->amountDue();

            if ($amount <= 0) {
                throw new PaymentException('Ce sejour est deja integralement regle.');
            }

            $locked->loadMissing('room');
            if ($locked->room && ! $locked->room->isAvailableForDates(
                $locked->check_in->toDateString(),
                $locked->check_out->toDateString(),
                $locked->id
            )) {
                throw new PaymentException('Cet appartement n\'est plus disponible sur ces dates. Aucun paiement n\'a ete engage.');
            }

            return $this->reusablePendingAttempt($locked->payments()->whereNull('stay_extension_id'), $amount)
                ?? $this->createAttempt($locked, null, Payment::TYPE_STAY, $amount);
        });

        return $this->refreshIfAlreadyStarted($payment);
    }

    /**
     * @throws PaymentException
     */
    public function initiateForExtension(StayExtension $extension, User $user): Payment
    {
        $this->ensureProviderReady();

        $payment = DB::transaction(function () use ($extension) {
            /** @var StayExtension $locked */
            $locked = StayExtension::whereKey($extension->id)->lockForUpdate()->firstOrFail();

            if ($locked->status === StayExtension::STATUS_AWAITING_PAYMENT && ! $locked->isPayable()) {
                $locked->update(['status' => StayExtension::STATUS_EXPIRED, 'processed_at' => now()]);
            }

            if ($locked->status !== StayExtension::STATUS_AWAITING_PAYMENT) {
                throw new PaymentException(match ($locked->status) {
                    StayExtension::STATUS_PENDING => 'Votre demande de prolongation doit d\'abord etre validee par l\'administration.',
                    StayExtension::STATUS_PAID => 'Cette prolongation est deja payee.',
                    StayExtension::STATUS_EXPIRED => 'Le delai de paiement de cette prolongation a expire.',
                    default => 'Cette prolongation ne peut pas etre payee.',
                });
            }

            return $this->reusablePendingAttempt($locked->payments(), (int) $locked->amount)
                ?? $this->createAttempt($locked->reservation, $locked, Payment::TYPE_EXTENSION, (int) $locked->amount);
        });

        return $this->refreshIfAlreadyStarted($payment);
    }

    /**
     * Configuration du checkout FeexPay pour une tentative en attente.
     *
     * Contient la cle API : le SDK FeexPay l'exige cote navigateur. Elle n'est
     * remise qu'au client connecte, proprietaire du paiement, au moment de payer.
     *
     * @return array<string, mixed>
     */
    public function checkoutConfig(Payment $payment): array
    {
        $payment->loadMissing('reservation.user');
        $user = $payment->reservation->user;

        return [
            'sdk_url' => (string) config('feexpay.sdk_url'),
            'id' => (string) config('feexpay.shop_id'),
            'token' => (string) config('feexpay.api_key'),
            'mode' => (string) config('feexpay.mode'),
            'amount' => (int) $payment->amount,
            'currency' => (string) config('feexpay.currency', 'XOF'),
            // Reference d'idempotence : une par tentative de paiement.
            'custom_id' => (string) $payment->idempotency_key,
            // Reference unique et sans espace : permet au serveur de retrouver
            // la transaction aupres de FeexPay (`?by=description`).
            'description' => (string) $payment->transaction_id,
            'callback_info' => [
                'payment_id' => $payment->id,
                'reservation_id' => $payment->reservation_id,
                'stay_extension_id' => $payment->stay_extension_id,
            ],
            'first_name' => (string) ($user?->name ?? ''),
            'email' => (string) ($user?->email ?? ''),
        ];
    }

    /**
     * Interroge FeexPay pour un paiement non finalise.
     *
     * Sans reference connue, la transaction est retrouvee par sa description
     * unique (fixee par le serveur). La reference eventuellement renvoyee par
     * le checkout n'est qu'un indice : elle n'est retenue que si FeexPay
     * confirme qu'elle correspond bien a CE paiement.
     */
    public function refresh(Payment $payment, ?string $referenceHint = null, ?string $channelHint = null): Payment
    {
        // Paiements finalises, ou anciens paiements anterieurs a FeexPay.
        if ($payment->isFinal() || $payment->provider !== 'feexpay') {
            return $payment;
        }

        $this->rememberChannel($payment, $channelHint);

        $this->ensureProviderReady();

        if ($payment->provider_reference) {
            $response = $this->feexpay->transactionStatus($payment->provider_reference);
        } else {
            $response = $this->locateTransaction($payment, $referenceHint);

            if ($response === null) {
                $payment->forceFill(['last_checked_at' => now()])->save();

                return $payment->fresh();
            }

            try {
                $payment->forceFill(['provider_reference' => $response->reference()])->save();
            } catch (UniqueConstraintViolationException) {
                // Une meme transaction FeexPay ne peut regler qu'un seul paiement.
                $this->securityLogger->warning('payment.reference_already_used', [
                    'payment_id' => $payment->id,
                ]);

                return $payment->fresh();
            }
        }

        $payment->forceFill(array_filter([
            'last_checked_at' => now(),
            // L'operateur annonce par FeexPay prime sur celui du checkout.
            'channel' => $response->channel(),
        ]))->save();

        if (! $response->successful() || ! $response->transactionStatus()) {
            return $payment->fresh();
        }

        return $this->applyProviderStatus($payment, $response->transactionStatus(), $response->message(), $response->body);
    }

    /**
     * Confirmation d'un paiement simule par le SDK FeexPay en SANDBOX.
     *
     * Le SDK sandbox ne cree aucune transaction reelle : il renvoie toujours
     * un statut SUCCESSFUL et une reference factice. Cette methode n'accepte
     * cette confirmation que si le mode SANDBOX, le drapeau explicite
     * `feexpay.sandbox_trust_sdk` et un environnement local/testing sont
     * actifs, et si la description et le `payment_id` renvoyes correspondent
     * a CE paiement.
     *
     * @param  array<string, mixed>  $callback
     *
     * @throws PaymentException
     */
    public function confirmSandboxCheckout(Payment $payment, array $callback): Payment
    {
        if (
            config('feexpay.mode') !== 'SANDBOX'
            || ! config('feexpay.sandbox_trust_sdk')
            || ! app()->environment('local', 'testing')
        ) {
            throw new PaymentException('La confirmation sandbox est desactivee.', 403);
        }

        if ($payment->isFinal()) {
            return $payment;
        }

        if ($payment->provider !== 'feexpay' || $payment->payment_method !== 'checkout') {
            throw new PaymentException('Ce paiement ne peut pas etre confirme en sandbox.');
        }

        $description = $callback['description'] ?? null;
        $callbackInfo = $callback['callback_info'] ?? null;
        $callbackPaymentId = is_array($callbackInfo) ? ($callbackInfo['payment_id'] ?? null) : null;

        if ($description !== $payment->transaction_id || (int) $callbackPaymentId !== (int) $payment->id) {
            $this->securityLogger->warning('payment.sandbox_confirmation_mismatch', [
                'payment_id' => $payment->id,
            ]);

            throw new PaymentException('La confirmation ne correspond pas a ce paiement.');
        }

        $this->rememberChannel($payment, $callback['reseau'] ?? null);

        // Reference locale unique : le SDK sandbox renvoie la meme reference
        // factice pour toutes les transactions.
        $payment->forceFill([
            'provider_reference' => 'SANDBOX-'.$payment->id.'-'.Str::upper(Str::random(10)),
        ])->save();

        $this->securityLogger->info('payment.sandbox_confirmed', [
            'payment_id' => $payment->id,
        ]);

        return $this->applyProviderStatus($payment, 'SUCCESSFUL', null, ['amount' => $payment->amount]);
    }

    /**
     * Point d'entree pour le futur webhook FeexPay (non implemente en
     * SANDBOX). Le webhook devra verifier son authentification et le champ
     * `env`, puis appeler cette methode avec la reference recue.
     *
     * @param  array<string, mixed>  $payload
     */
    public function handleProviderNotification(string $reference, string $status, array $payload = []): ?Payment
    {
        $payment = Payment::where('provider_reference', $reference)->first();

        if (! $payment) {
            Log::warning('Notification FeexPay pour une reference inconnue', ['reference' => $reference]);

            return null;
        }

        return $this->applyProviderStatus($payment, $status, $payload['reason'] ?? null, $payload);
    }

    /**
     * Applique un statut FeexPay. Idempotent : sans effet sur un paiement
     * deja finalise ; un seul Bon de Sejour par paiement (contraintes
     * d'unicite en base sur le paiement et la reference de transaction).
     *
     * @param  array<string, mixed>  $providerPayload
     */
    public function applyProviderStatus(Payment $payment, string $providerStatus, ?string $reason = null, array $providerPayload = []): Payment
    {
        $providerStatus = strtoupper($providerStatus);

        if ($providerStatus === 'PENDING') {
            $payment->forceFill(['provider_status' => 'PENDING'])->save();

            return $payment->fresh();
        }

        $justConfirmed = false;

        try {
            $justConfirmed = DB::transaction(function () use ($payment, $providerStatus, $reason, $providerPayload) {
                /** @var Payment $locked */
                $locked = Payment::whereKey($payment->id)->lockForUpdate()->firstOrFail();

                if ($locked->isFinal()) {
                    return false;
                }

                if ($providerStatus !== 'SUCCESSFUL') {
                    $locked->forceFill([
                        'status' => Payment::STATUS_FAILED,
                        'provider_status' => $providerStatus,
                        'failure_reason' => $reason ?: 'Paiement refuse ou annule.',
                    ])->save();

                    return false;
                }

                if (! $this->amountMatches($locked, $providerPayload)) {
                    $this->securityLogger->warning('payment.amount_mismatch', [
                        'payment_id' => $locked->id,
                        'expected' => $locked->amount,
                        'received' => $providerPayload['amount'] ?? null,
                    ]);
                    $locked->forceFill(['provider_status' => 'AMOUNT_MISMATCH'])->save();

                    return false;
                }

                $this->finalizeSuccess($locked);

                return true;
            });
        } catch (UniqueConstraintViolationException) {
            // Deux confirmations simultanees : l'autre a deja emis le bon.
            return $payment->fresh();
        }

        $payment = $payment->fresh(['reservation.user', 'reservation.room', 'stayExtension', 'voucher']);

        if ($justConfirmed) {
            $this->afterSuccess($payment);
        }

        return $payment;
    }

    /**
     * Retrouve chez FeexPay la transaction de ce paiement.
     */
    private function locateTransaction(Payment $payment, ?string $referenceHint): ?FeexPayResponse
    {
        $byDescription = $this->feexpay->transactionStatus((string) $payment->transaction_id, 'description');

        if ($byDescription->successful() && $byDescription->reference()) {
            return $byDescription;
        }

        if (! $referenceHint) {
            return null;
        }

        $hinted = $this->feexpay->transactionStatus($referenceHint);

        if (! $hinted->successful() || ! $this->belongsTo($payment, $hinted)) {
            if ($hinted->successful()) {
                $this->securityLogger->warning('payment.foreign_reference_rejected', ['payment_id' => $payment->id]);
            }

            return null;
        }

        return $hinted->reference()
            ? $hinted
            : new FeexPayResponse($hinted->httpStatus, array_merge($hinted->body, ['reference' => $referenceHint]));
    }

    /**
     * La transaction annoncee par le navigateur doit porter les marques de
     * CE paiement (description ou callback_info), ou au minimum son montant.
     */
    private function belongsTo(Payment $payment, FeexPayResponse $response): bool
    {
        $body = $response->body;

        if (isset($body['description']) && is_string($body['description']) && $body['description'] !== '') {
            return $body['description'] === $payment->transaction_id;
        }

        $callbackInfo = $body['callback_info'] ?? null;
        if (is_array($callbackInfo) && isset($callbackInfo['payment_id'])) {
            return (int) $callbackInfo['payment_id'] === (int) $payment->id;
        }

        return isset($body['amount']) && is_numeric($body['amount']) && $this->amountMatches($payment, $body);
    }

    /**
     * Tentative encore ouverte pour le meme montant : on la repropose plutot
     * que d'en creer une nouvelle (un double clic ou un rechargement ne doit
     * jamais produire deux paiements).
     *
     * @param  HasMany<Payment, *>  $payments
     */
    private function reusablePendingAttempt(HasMany $payments, int $amount): ?Payment
    {
        return (clone $payments)
            ->where('status', Payment::STATUS_PENDING)
            ->where('payment_method', 'checkout')
            ->where('amount', $amount)
            ->where('created_at', '>', now()->subMinutes(self::REUSE_PENDING_MINUTES))
            ->latest()
            ->first();
    }

    /**
     * Une tentative reproposee a peut-etre deja ete payee : on le verifie
     * avant de rouvrir le checkout.
     */
    private function refreshIfAlreadyStarted(Payment $payment): Payment
    {
        if (! $payment->wasRecentlyCreated) {
            return $this->refresh($payment);
        }

        return $payment;
    }

    private function createAttempt(Reservation $reservation, ?StayExtension $extension, string $type, int $amount): Payment
    {
        return Payment::create([
            'reservation_id' => $reservation->id,
            'stay_extension_id' => $extension?->id,
            'payment_method' => 'checkout',
            'provider' => 'feexpay',
            // Reference lisible, unique et sans espace : c'est la description
            // transmise au checkout, qui sert a retrouver la transaction.
            'transaction_id' => 'MANOIR'.$reservation->id.strtoupper(Str::random(10)),
            // Une cle = une tentative de paiement, conservee jusqu'a l'etat final.
            'idempotency_key' => (string) Str::uuid(),
            'payment_type' => $type,
            'status' => Payment::STATUS_PENDING,
            'amount' => $amount,
            'metadata' => ['initiated_at' => now()->toIso8601String()],
        ]);
    }

    private function finalizeSuccess(Payment $payment): void
    {
        $now = now();
        $voucherNumber = 'BS-'.$now->format('Y').'-'.str_pad((string) $payment->id, 6, '0', STR_PAD_LEFT);

        $payment->forceFill([
            'status' => Payment::STATUS_SUCCESS,
            'provider_status' => 'SUCCESSFUL',
            'failure_reason' => null,
            'paid_at' => $now,
            'invoice_number' => $voucherNumber,
        ])->save();

        StayVoucher::create([
            'payment_id' => $payment->id,
            'reservation_id' => $payment->reservation_id,
            'stay_extension_id' => $payment->stay_extension_id,
            'number' => $voucherNumber,
            'transaction_reference' => (string) $payment->provider_reference,
            'amount' => $payment->amount,
            'issued_at' => $now,
        ]);

        /** @var Reservation $reservation */
        $reservation = Reservation::whereKey($payment->reservation_id)->lockForUpdate()->firstOrFail();

        if ($payment->stay_extension_id) {
            /** @var StayExtension $extension */
            $extension = StayExtension::whereKey($payment->stay_extension_id)->lockForUpdate()->firstOrFail();

            $extension->update([
                'status' => StayExtension::STATUS_PAID,
                'paid_at' => $now,
                'processed_at' => $now,
            ]);

            // Les nuits payees rejoignent le sejour.
            $reservation->update([
                'check_out' => $extension->requested_check_out,
                'stay_amount' => (int) $reservation->stay_amount + (int) $extension->amount,
                'total_price' => (int) $reservation->total_price + (int) $extension->amount,
            ]);

            return;
        }

        if (! in_array($reservation->status, ['VALIDEE_PAIEMENT_REQUIS', 'CONFIRMEE'], true)) {
            // Paiement arrive apres expiration ou annulation : l'argent est
            // encaisse, l'administration doit trancher (sejour ou remboursement).
            $this->securityLogger->warning('payment.received_for_inactive_reservation', [
                'payment_id' => $payment->id,
                'reservation_id' => $reservation->id,
                'reservation_status' => $reservation->status,
            ]);
        }

        $reservation->update([
            'status' => 'SEJOUR_PAYE',
            'paid_at' => $reservation->paid_at ?? $now,
            'stay_paid_at' => $now,
            'stay_invoice_number' => $voucherNumber,
        ]);
    }

    private function afterSuccess(Payment $payment): void
    {
        $reservation = $payment->reservation;
        $amount = number_format((int) $payment->amount, 0, ',', ' ');
        $isExtension = $payment->stay_extension_id !== null;

        // Le sejour paye (ou prolonge) doit apparaitre dans l'agenda de
        // l'appartement. Une panne de Google n'annule pas le paiement.
        try {
            app(GoogleCalendarWriter::class)->publier($reservation->loadMissing(['room', 'user']));
        } catch (\Throwable $exception) {
            Log::warning('Agenda Google non mis a jour apres paiement : '.$exception->getMessage());
        }

        ReservationNotificationService::sendOnce(
            $reservation,
            $isExtension ? 'extension_paid_'.$payment->stay_extension_id : 'stay_paid',
            $isExtension
                ? "Le paiement de {$amount} FCFA pour la prolongation de votre séjour #{$reservation->id} est confirmé. Votre nouveau départ est prévu le {$reservation->check_out->format('d/m/Y')}. Votre Bon de Séjour est disponible."
                : "Le paiement de {$amount} FCFA pour votre séjour #{$reservation->id} est confirmé. Votre Bon de Séjour est disponible dans votre espace client."
        );

        $this->mailer->paymentConfirmed($payment);
    }

    /**
     * Le montant renvoye par FeexPay, s'il est fourni, doit etre celui du
     * paiement : un statut « reussi » pour un autre montant n'est pas une
     * preuve de paiement.
     *
     * @param  array<string, mixed>  $payload
     */
    private function amountMatches(Payment $payment, array $payload): bool
    {
        if (! isset($payload['amount']) || ! is_numeric($payload['amount'])) {
            return true;
        }

        // Carte : FeexPay peut annoncer le montant frais inclus paye par le
        // client ; il ne peut en aucun cas etre inferieur au montant du.
        return (int) round((float) $payload['amount']) >= (int) $payment->amount;
    }

    /**
     * Operateur choisi dans le checkout, conserve pour l'affichage tant que
     * FeexPay n'en a pas annonce un. Information d'affichage uniquement :
     * elle n'influe jamais sur le statut du paiement.
     */
    private function rememberChannel(Payment $payment, mixed $channelHint): void
    {
        $channel = PaymentChannel::normalize($channelHint);

        if ($channel !== null && $payment->channel === null) {
            $payment->forceFill(['channel' => $channel])->save();
        }
    }

    private function ensureProviderReady(): void
    {
        if (! $this->feexpay->isConfigured()) {
            throw new PaymentException('Le paiement en ligne n\'est pas encore disponible. Reessayez plus tard.', 503);
        }
    }
}
