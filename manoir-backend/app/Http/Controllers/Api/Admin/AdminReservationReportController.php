<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Reservation;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AdminReservationReportController extends Controller
{
    public function download(Request $request): Response
    {
        $data = $request->validate([
            'reservation_ids' => 'required|array|min:1|max:500',
            'reservation_ids.*' => 'required|integer|distinct|exists:reservations,id',
            'filter_label' => 'nullable|string|max:100',
            'search' => 'nullable|string|max:255',
            'date_from' => 'nullable|date_format:Y-m-d',
            'date_to' => 'nullable|date_format:Y-m-d|after_or_equal:date_from',
        ]);

        $reservationsById = Reservation::with(['user', 'room'])
            ->whereIn('id', $data['reservation_ids'])
            ->get()
            ->keyBy('id');

        $reservations = collect($data['reservation_ids'])
            ->map(fn (int $id) => $reservationsById->get($id))
            ->filter()
            ->values();

        $exportedAt = now();
        $reference = 'RAP-'.$exportedAt->format('Ymd-His');
        $depositTotal = $reservations->sum(
            fn (Reservation $reservation) => (int) ($reservation->deposit_amount ?? $reservation->total_price ?? 0)
        );
        $stayTotal = $reservations->sum(fn (Reservation $reservation) => (int) ($reservation->stay_amount ?? 0));

        $pdf = Pdf::loadView('admin.reservations-report', [
            'reservations' => $reservations,
            'exportedAt' => $exportedAt,
            'exportedBy' => $request->user(),
            'reference' => $reference,
            'filterLabel' => $data['filter_label'] ?? 'Toutes',
            'search' => $data['search'] ?? null,
            'dateFrom' => $data['date_from'] ?? null,
            'dateTo' => $data['date_to'] ?? null,
            'depositTotal' => $depositTotal,
            'stayTotal' => $stayTotal,
            'logoDataUri' => $this->logoDataUri(),
        ])->setPaper('a4', 'landscape');

        return $pdf->download("rapport-reservations-{$exportedAt->format('Y-m-d-His')}.pdf");
    }

    private function logoDataUri(): ?string
    {
        $candidates = [
            public_path('assets/logo.jpg'),
            base_path('../manoir-frontend/public/assets/logo.jpg'),
        ];

        foreach ($candidates as $path) {
            if (is_file($path) && is_readable($path)) {
                return 'data:image/jpeg;base64,'.base64_encode((string) file_get_contents($path));
            }
        }

        return null;
    }
}
