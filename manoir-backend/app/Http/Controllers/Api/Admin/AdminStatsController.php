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
        $totalReservations = Reservation::count();
        $totalRooms = Room::count();
        $totalUsers = User::count();
        $totalRevenue = Payment::where('status', 'success')->sum('amount');

        $today = now()->format('Y-m-d');
        $occupiedRoomsCount = Reservation::whereIn('status', ['VALIDEE_PAIEMENT_REQUIS', 'CONFIRMEE', 'SEJOUR_PAYE'])
            ->where('check_in', '<=', $today)
            ->where('check_out', '>=', $today)
            ->distinct('room_id')
            ->count('room_id');

        $occupancyRate = $totalRooms > 0 ? round(($occupiedRoomsCount / $totalRooms) * 100, 1) : 0;

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
                'total_users' => $totalUsers,
                'total_revenue' => $totalRevenue,
                'occupancy_rate' => $occupancyRate,
                'occupied_rooms_count' => $occupiedRoomsCount,
            ],
            'recent_reservations' => $recentReservations,
            'recent_payments' => $recentPayments,
        ]);
    }
}
