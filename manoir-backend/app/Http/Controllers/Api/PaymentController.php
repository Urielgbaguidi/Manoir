<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Reservation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PaymentController extends Controller
{
    public function initiate(Request $request, string $reservationId): JsonResponse
    {
        $request->validate([
            'payment_method' => 'required|in:mobile_money,card',
            'provider' => 'required|in:fedapay,kkiapay',
            'payment_type' => 'sometimes|in:deposit,stay',
            'phone_number' => 'required_if:payment_method,mobile_money|nullable|string',
        ]);

        $reservation = Reservation::where('user_id', $request->user()->id)
            ->where('id', $reservationId)
            ->firstOrFail();

        $paymentType = $request->input('payment_type', 'deposit');

        if ($paymentType === 'deposit') {
            if ($reservation->status !== 'VALIDEE_PAIEMENT_REQUIS') {
                return response()->json([
                    'message' => 'Cette reservation n\'est pas en attente de paiement de caution.',
                ], 422);
            }

            if ($reservation->isExpired()) {
                $reservation->update(['status' => 'EXPIREE']);

                return response()->json([
                    'message' => 'Le delai de paiement de la caution a expire.',
                ], 422);
            }

            $amount = (int) $reservation->deposit_amount;
        } else {
            if ($reservation->status !== 'CONFIRMEE') {
                return response()->json([
                    'message' => 'Le sejour ne peut etre paye qu\'apres confirmation de la caution.',
                ], 422);
            }

            $amount = (int) $reservation->stay_amount;
        }

        $payment = Payment::create([
            'reservation_id' => $reservation->id,
            'payment_method' => $request->payment_method,
            'provider' => $request->provider,
            'transaction_id' => uniqid(strtoupper($paymentType).'_'),
            'payment_type' => $paymentType,
            'status' => 'pending',
            'amount' => $amount,
            'metadata' => [
                'phone_number' => $request->phone_number,
                'initiated_at' => now()->toIso8601String(),
            ],
        ]);

        return response()->json([
            'message' => 'Paiement initie avec succes.',
            'payment' => $payment,
            'payment_url' => "https://payment.manoir.com/pay/{$payment->transaction_id}",
        ]);
    }

    public function webhook(Request $request, string $paymentId): JsonResponse
    {
        $payment = Payment::findOrFail($paymentId);
        $status = $request->input('status');

        if ($status === 'success') {
            DB::transaction(function () use ($payment, $request) {
                $invoiceNumber = $this->generateInvoiceNumber($payment);

                $payment->update([
                    'status' => 'success',
                    'invoice_number' => $invoiceNumber,
                    'paid_at' => now(),
                    'metadata' => array_merge($payment->metadata ?? [], $request->all()),
                ]);

                $reservation = $payment->reservation;

                if ($payment->payment_type === 'stay') {
                    $reservation->update([
                        'status' => 'SEJOUR_PAYE',
                        'stay_paid_at' => now(),
                        'stay_invoice_number' => $invoiceNumber,
                    ]);
                } else {
                    $reservation->update([
                        'status' => 'CONFIRMEE',
                        'paid_at' => now(),
                        'deposit_invoice_number' => $invoiceNumber,
                    ]);
                }
            });

            return response()->json(['status' => 'success']);
        }

        $payment->update([
            'status' => 'failed',
            'metadata' => array_merge($payment->metadata ?? [], $request->all()),
        ]);

        return response()->json(['status' => 'failed']);
    }

    public function checkStatus(string $paymentId): JsonResponse
    {
        $payment = Payment::with('reservation')->findOrFail($paymentId);

        return response()->json([
            'status' => $payment->status,
            'reservation_status' => $payment->reservation->status,
            'amount' => $payment->amount,
            'payment_type' => $payment->payment_type,
            'invoice_number' => $payment->invoice_number,
        ]);
    }

    private function generateInvoiceNumber(Payment $payment): string
    {
        $year = now()->format('Y');
        $sequence = str_pad((string) $payment->id, 5, '0', STR_PAD_LEFT);

        if ($payment->payment_type === 'stay') {
            return "FAC-SEJ-{$year}-{$sequence}";
        }

        return "FAC-{$year}-{$sequence}";
    }
}
