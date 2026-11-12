<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Reservations\InitiatePaymentRequest;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\StayExtension;
use App\Services\Payments\PaymentException;
use App\Services\Payments\PaymentService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Paiements FeexPay cote client.
 *
 * Le paiement se deroule dans le checkout officiel FeexPay (navigateur). Le
 * serveur prepare la tentative, puis, quand le checkout se referme, le
 * frontend appelle `verify` : le serveur interroge FeexPay et ne marque le
 * paiement reussi que si FeexPay le confirme. MODE SANDBOX : pas de webhook.
 */
class PaymentController extends Controller
{
    public function __construct(private readonly PaymentService $payments) {}

    /**
     * Disponibilite du paiement en ligne (cle FeexPay renseignee ou non).
     */
    public function channels(): JsonResponse
    {
        return response()->json([
            'mode' => config('feexpay.mode'),
            'available' => filled(config('feexpay.api_key')) && filled(config('feexpay.shop_id')),
            'channels' => [],
        ]);
    }

    /**
     * Prepare (ou repropose) la tentative et renvoie la configuration du
     * checkout FeexPay.
     */
    public function initiateForReservation(Request $request, string $id): JsonResponse
    {
        $reservation = Reservation::where('user_id', $request->user()->id)->findOrFail($id);

        return $this->respond(fn () => $this->payments->initiateForReservation($reservation, $request->user()), 201, true);
    }

    public function initiateForExtension(Request $request, string $id): JsonResponse
    {
        $extension = StayExtension::where('user_id', $request->user()->id)->with('reservation')->findOrFail($id);

        return $this->respond(fn () => $this->payments->initiateForExtension($extension, $request->user()), 201, true);
    }

    /**
     * Verification cote serveur aupres de FeexPay. `reference` (renvoyee par
     * le checkout) n'est qu'un indice, controle aupres de FeexPay.
     */
    public function verify(InitiatePaymentRequest $request, string $paymentId): JsonResponse
    {
        $payment = $this->ownedPayment($request, fn ($query) => $query->whereKey($paymentId));

        return $this->respond(
            fn () => $this->payments->refresh(
                $payment,
                $request->validated('reference'),
                $request->validated('network'),
            ),
            200
        );
    }

    /**
     * Confirmation d'un paiement simule par le SDK FeexPay en SANDBOX.
     *
     * Route de developpement : le service refuse si
     * `feexpay.sandbox_trust_sdk` n'est pas explicitement active.
     */
    public function confirmSandbox(Request $request, string $paymentId): JsonResponse
    {
        $payment = $this->ownedPayment($request, fn ($query) => $query->whereKey($paymentId));

        $data = $request->validate([
            'description' => ['required', 'string', 'max:100'],
            'callback_info' => ['required', 'array'],
            'callback_info.payment_id' => ['required', 'integer'],
            'reseau' => ['nullable', 'string', 'max:40'],
        ]);

        return $this->respond(
            fn () => $this->payments->confirmSandboxCheckout($payment, $data),
            200
        );
    }

    /**
     * Retour de la page de paiement par carte : FeexPay ajoute `ref` a l'URL.
     * La reference doit appartenir a un paiement du client connecte.
     */
    public function verifyByReference(Request $request): JsonResponse
    {
        $data = $request->validate(['reference' => ['required', 'string', 'max:100']]);

        $payment = $this->ownedPayment($request, fn ($query) => $query->where('provider_reference', $data['reference']));

        return $this->respond(fn () => $this->payments->refresh($payment), 200);
    }

    public function status(Request $request, string $paymentId): JsonResponse
    {
        $payment = $this->ownedPayment($request, fn ($query) => $query->whereKey($paymentId));

        return response()->json($this->present($payment));
    }

    /**
     * @param  callable(Builder<Payment>): mixed  $constraint
     */
    private function ownedPayment(Request $request, callable $constraint): Payment
    {
        $query = Payment::query()->whereHas('reservation', fn ($q) => $q->where('user_id', $request->user()->id));
        $constraint($query);

        return $query->firstOrFail();
    }

    /**
     * @param  callable(): Payment  $action
     */
    private function respond(callable $action, int $successStatus = 201, bool $withCheckout = false): JsonResponse
    {
        try {
            $payment = $action();
        } catch (PaymentException $exception) {
            // Meme forme que les reponses normales : le paiement deja en cours
            // (409) est directement dans `payment`.
            $body = $exception->payment ? $this->present($exception->payment) : [];
            $body['message'] = $exception->getMessage();

            return response()->json($body, $exception->status);
        }

        return response()->json($this->present($payment, $withCheckout), $successStatus);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(Payment $payment, bool $withCheckout = false): array
    {
        $payment->loadMissing(['reservation', 'stayExtension', 'voucher']);

        $message = match ($payment->status) {
            Payment::STATUS_SUCCESS => 'Paiement confirme. Votre Bon de Sejour est disponible.',
            Payment::STATUS_FAILED => $payment->failure_reason ?: 'Le paiement a echoue.',
            default => 'Finalisez le paiement dans la fenetre securisee FeexPay.',
        };

        return [
            // Configuration du checkout FeexPay, remise uniquement a la
            // preparation d'un paiement encore ouvert.
            'checkout' => $withCheckout && $payment->status === Payment::STATUS_PENDING && $payment->payment_method === 'checkout'
                ? $this->payments->checkoutConfig($payment)
                : null,
            'message' => $message,
            'payment' => [
                'id' => $payment->id,
                'reservation_id' => $payment->reservation_id,
                'stay_extension_id' => $payment->stay_extension_id,
                'status' => $payment->status,
                'provider_status' => $payment->provider_status,
                'payment_method' => $payment->payment_method,
                'channel' => $payment->channel,
                'payment_type' => $payment->payment_type,
                'amount' => $payment->amount,
                'reference' => $payment->provider_reference,
                'failure_reason' => $payment->failure_reason,
                'paid_at' => $payment->paid_at?->toIso8601String(),
            ],
            'reservation_status' => $payment->reservation?->status,
            'extension_status' => $payment->stayExtension?->status,
            'voucher' => $payment->voucher ? [
                'id' => $payment->voucher->id,
                'number' => $payment->voucher->number,
            ] : null,
        ];
    }
}
