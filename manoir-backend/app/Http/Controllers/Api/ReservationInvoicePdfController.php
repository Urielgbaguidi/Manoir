<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Reservation;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ReservationInvoicePdfController extends Controller
{
    public function download(Request $request, string $id): Response
    {
        $data = $request->validate([
            'type' => 'required|string|in:booking,deposit,stay-voucher,stay,cancellation',
        ]);

        $reservation = Reservation::with(['user', 'room', 'payments'])
            ->where('user_id', $request->user()->id)
            ->findOrFail($id);

        $documentType = $data['type'];
        $isInvoice = in_array($documentType, ['deposit', 'stay'], true);
        $paymentType = $documentType === 'stay' ? 'stay' : 'deposit';
        $payment = $isInvoice
            ? $reservation->payments->first(
                fn ($item) => $item->payment_type === $paymentType && $item->status === 'success'
            )
            : null;
        $year = $reservation->created_at->format('Y');
        $sequence = str_pad((string) $reservation->id, 5, '0', STR_PAD_LEFT);
        $documentNumber = match ($documentType) {
            'deposit' => $reservation->deposit_invoice_number ?: $payment?->invoice_number,
            'stay' => $reservation->stay_invoice_number ?: $payment?->invoice_number,
            'stay-voucher' => "BON-SEJ-{$year}-{$sequence}",
            'cancellation' => $reservation->cancellation_document_number ?: "ANN-{$year}-{$sequence}",
            default => "BON-RES-{$year}-{$sequence}",
        };

        if ($isInvoice && (! $documentNumber || ! $payment)) {
            abort(422, 'Cette facture n’est pas encore disponible.');
        }

        $isDepositDocument = in_array($documentType, ['booking', 'deposit'], true);
        $isCancellation = $documentType === 'cancellation';
        $amount = $isCancellation
            ? (int) ($reservation->cancellation_refund_amount ?? 0)
            : ($isDepositDocument
                ? (int) ($reservation->deposit_amount ?? $reservation->total_price ?? $payment?->amount ?? 0)
                : (int) ($reservation->stay_amount ?? $payment?->amount ?? 0));
        $nights = max(1, $reservation->check_in->diffInDays($reservation->check_out));
        $unitPrice = $isCancellation
            ? (int) ($reservation->deposit_daily_rate ?? 0)
            : ($isDepositDocument
            ? (int) ($reservation->deposit_daily_rate ?: $amount)
            : (int) round($amount / $nights));
        $quantity = $isCancellation
            ? (int) ($reservation->cancellation_consumed_days ?? 0)
            : ($isDepositDocument && $unitPrice > 0 ? max(1, (int) round($amount / $unitPrice)) : $nights);
        $roomType = $reservation->category_type ?: $reservation->room?->type;
        $categoryLabels = [
            'vip' => $reservation->room?->name ?: 'VIP',
            'deux_chambres' => '2 Chambres',
            'une_chambre' => '1 Chambre',
        ];
        $roomLabel = $reservation->room?->apartment_number
            ? "Appartement N°{$reservation->room->apartment_number} — ".($categoryLabels[$roomType] ?? $reservation->room->name)
            : ($categoryLabels[$roomType] ?? $reservation->room?->name ?? 'Appartement');

        $pdf = Pdf::loadView('invoices.reservation', [
            'reservation' => $reservation,
            'payment' => $payment,
            'invoiceNumber' => $documentNumber,
            'invoiceDate' => $payment?->paid_at
                ?: match ($documentType) {
                    'deposit' => $reservation->paid_at,
                    'stay' => $reservation->stay_paid_at,
                    'cancellation' => $reservation->cancelled_at,
                    default => $reservation->created_at,
                }
                ?: now(),
            'title' => match ($documentType) {
                'deposit' => 'Facture de caution',
                'stay' => 'Facture de séjour',
                'stay-voucher' => 'Bon du séjour',
                'cancellation' => 'Bon d’annulation',
                default => 'Bon de réservation',
            },
            'description' => $isCancellation
                ? 'Remboursement après annulation'
                : ($isDepositDocument ? 'Caution de réservation' : 'Frais de séjour'),
            'quantityLabel' => $isCancellation
                ? 'Jours consommés'
                : ($isDepositDocument ? 'Nombre de jours' : 'Nombre de nuits'),
            'quantity' => $quantity,
            'unitPrice' => $unitPrice,
            'amount' => $amount,
            'roomLabel' => $roomLabel,
            'logoDataUri' => $this->logoDataUri(),
        ])->setPaper('a4', 'portrait');

        $safeNumber = preg_replace('/[^A-Za-z0-9_-]/', '-', (string) $documentNumber);

        return $pdf->download("Document-{$safeNumber}.pdf");
    }

    private function logoDataUri(): ?string
    {
        foreach ([public_path('assets/logo.jpg'), base_path('../manoir-frontend/public/assets/logo.jpg')] as $path) {
            if (is_file($path) && is_readable($path)) {
                return 'data:image/jpeg;base64,'.base64_encode((string) file_get_contents($path));
            }
        }

        return null;
    }
}
