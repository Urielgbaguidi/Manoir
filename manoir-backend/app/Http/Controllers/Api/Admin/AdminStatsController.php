<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\User;
use Illuminate\Http\JsonResponse;

class AdminStatsController extends Controller
{
    public function dashboard(): JsonResponse
    {
        Reservation::expireOverduePaymentRequests();

        $totalReservations = Reservation::count();
        $totalRooms = Room::count();
        // Seul le parc réellement réservable doit servir de dénominateur au taux
        // d'occupation : on exclut les chambres désactivées / auto-créées.
        $bookableRoomsCount = Room::where('status', 'available')->count();
        $totalUsers = User::count();
        $totalRevenue = Payment::where('status', 'success')->sum('amount');

        // CA du mois en cours : somme des paiements validés sur le mois courant
        // (paid_at est toujours renseigné lorsqu'un paiement passe en "success").
        $revenueThisMonth = Payment::where('status', 'success')
            ->whereBetween('paid_at', [now()->startOfMonth(), now()->endOfMonth()])
            ->sum('amount');

        $today = now()->format('Y-m-d');
        $occupiedRoomsCount = Reservation::whereIn('status', ['CONFIRMEE', 'SEJOUR_PAYE'])
            ->where('check_in', '<=', $today)
            ->where('check_out', '>', $today)
            ->distinct('room_id')
            ->count('room_id');

        $occupancyRate = $bookableRoomsCount > 0
            ? round(($occupiedRoomsCount / $bookableRoomsCount) * 100, 1)
            : 0;

        $recentReservations = Reservation::with(['user', 'room'])
            ->orderByDesc('created_at')
            ->limit(5)
            ->get();

        $recentPayments = Payment::where('status', 'success')
            ->orderByDesc('created_at')
            ->limit(10)
            ->get();

        return response()->json([
            'stats' => [
                'total_reservations' => $totalReservations,
                'total_rooms' => $totalRooms,
                'bookable_rooms_count' => $bookableRoomsCount,
                'total_users' => $totalUsers,
                'total_revenue' => $totalRevenue,
                'revenue_this_month' => $revenueThisMonth,
                'occupancy_rate' => $occupancyRate,
                'occupied_rooms_count' => $occupiedRoomsCount,
            ],
            'recent_reservations' => $recentReservations,
            'recent_payments' => $recentPayments,
        ]);
    }
}
