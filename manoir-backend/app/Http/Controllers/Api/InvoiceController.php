<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\RoomCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InvoiceController extends Controller
{
    public function show(Request $request, string $paymentId): JsonResponse
    {
        $payment = Payment::with(['reservation.user', 'reservation.room'])
            ->whereHas('reservation', function ($query) use ($request) {
                $query->where('user_id', $request->user()->id);
            })
            ->findOrFail($paymentId);

        $reservation = $payment->reservation;
        $user = $reservation->user;
        $room = $reservation->room;
        $nights = $reservation->nightsCount();
        $category = RoomCategory::where('type', $reservation->category_type ?: $room->type)->first();
        $roomLabel = $this->formatApartmentLabel($room, $category);
        $isDeposit = $payment->payment_type === 'deposit';
        $total = (int) $payment->amount;
        $unitPrice = $isDeposit
            ? (int) $reservation->deposit_daily_rate
            : ($nights > 0 ? (int) round($total / $nights) : 0);
        $quantity = $isDeposit && $unitPrice > 0
            ? (int) round($total / $unitPrice)
            : $nights;

        return response()->json([
            'invoice' => [
                'invoice_number' => $payment->invoice_number,
                'invoice_date' => $payment->paid_at ? $payment->paid_at->format('d/m/Y H:i') : now()->format('d/m/Y H:i'),
                'payment_type' => $isDeposit ? 'Caution de réservation' : 'Séjour',
                'payment_method' => $this->formatPaymentMethod($payment->payment_method, $payment->provider),
                'transaction_id' => $payment->transaction_id,
                'hotel' => [
                    'name' => 'LE MANOIR',
                    'tagline' => 'Ce lieu a été façonné par des mains, porté par des cœurs...',
                    'address' => 'Cotonou, Bénin',
                    'phone' => '+229 01 00 00 00 00',
                    'email' => 'contact@manoir.com',
                ],
                'client' => [
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone ?? 'Non renseigné',
                ],
                'reservation' => [
                    'room_name' => $roomLabel,
                    'room_type' => $reservation->category_type ?: $room->type,
                    'check_in' => $reservation->check_in->format('d/m/Y'),
                    'check_out' => $reservation->check_out->format('d/m/Y'),
                    'nights' => $nights,
                    'guests' => $reservation->guests,
                ],
                'pricing' => [
                    'description' => $isDeposit ? 'Caution de réservation' : 'Frais de séjour',
                    'unit_price' => $unitPrice,
                    'quantity' => $quantity,
                    'quantity_label' => $isDeposit ? 'Nombre de jours' : 'Nombre de nuits',
                    'total' => $total,
                ],
            ],
        ]);
    }

    private function formatPaymentMethod(string $method, string $provider): string
    {
        $methods = [
            'mobile_money' => [
                'fedapay' => 'Mobile Money (FedaPay)',
                'kkiapay' => 'Mobile Money (KKiaPay)',
            ],
            'card' => [
                'fedapay' => 'Carte bancaire (FedaPay)',
                'kkiapay' => 'Carte bancaire (KKiaPay)',
            ],
        ];

        return $methods[$method][$provider] ?? ucfirst(str_replace('_', ' ', $method));
    }

    private function formatApartmentLabel($room, ?RoomCategory $category): string
    {
        $label = match ($category?->type ?? $room->type) {
            'vip' => $room->name,
            'deux_chambres' => '2 Chambres',
            'une_chambre' => '1 Chambre',
            default => $category?->label ?? $room->name,
        };

        return $room->apartment_number
            ? "Appartement N°{$room->apartment_number} — {$label}"
            : ($category?->label ?? $room->name);
    }
}
