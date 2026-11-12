<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Reservation;
use App\Models\StayVoucher;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Bons de Sejour : generes uniquement apres un paiement confirme, et
 * telechargeables en PDF par le client proprietaire.
 */
class StayVoucherController extends Controller
{
    public function index(Request $request, string $id): JsonResponse
    {
        $reservation = Reservation::where('user_id', $request->user()->id)->findOrFail($id);

        return response()->json([
            'vouchers' => $reservation->vouchers()->with('stayExtension')->get(),
        ]);
    }

    public function download(Request $request, string $voucherId): Response
    {
        $voucher = StayVoucher::with(['reservation.user', 'reservation.room', 'payment', 'stayExtension'])
            ->whereHas('reservation', fn ($query) => $query->where('user_id', $request->user()->id))
            ->findOrFail($voucherId);

        return $this->renderPdf($voucher);
    }

    public function renderPdf(StayVoucher $voucher): Response
    {
        $reservation = $voucher->reservation;
        $extension = $voucher->stayExtension;
        $room = $reservation->room;

        if ($extension) {
            $quantity = (int) $extension->nights;
            $unitPrice = (int) $extension->price_per_night;
            $description = 'Prolongation de séjour du '.$extension->previous_check_out->format('d/m/Y')
                .' au '.$extension->requested_check_out->format('d/m/Y');
        } else {
            $quantity = max(1, (int) $reservation->check_in->diffInDays($reservation->check_out));
            $unitPrice = (int) round($voucher->amount / $quantity);
            $description = 'Séjour du '.$reservation->check_in->format('d/m/Y').' au '.$reservation->check_out->format('d/m/Y');
        }

        $roomLabel = $room?->apartment_number
            ? 'Appartement N°'.$room->apartment_number.' — '.$room->name
            : ($room?->name ?? 'Appartement');

        $pdf = Pdf::loadView('invoices.reservation', [
            'reservation' => $reservation,
            'payment' => $voucher->payment,
            'invoiceNumber' => $voucher->number,
            'invoiceDate' => $voucher->issued_at,
            'title' => $extension ? 'Bon de Séjour — Prolongation' : 'Bon de Séjour',
            'description' => $description,
            'quantityLabel' => 'Nombre de nuits',
            'quantity' => $quantity,
            'unitPrice' => $unitPrice,
            'amount' => (int) $voucher->amount,
            'roomLabel' => $roomLabel,
            'logoDataUri' => $this->logoDataUri(),
        ])->setPaper('a4', 'portrait');

        $safeNumber = preg_replace('/[^A-Za-z0-9_-]/', '-', $voucher->number);

        return $pdf->download("Bon-de-Sejour-{$safeNumber}.pdf");
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
