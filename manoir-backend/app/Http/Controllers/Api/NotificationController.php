<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * Liste les notifications de l'utilisateur authentifie (30 plus recentes)
     * ainsi que le nombre de notifications non lues.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $notifications = Notification::where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->limit(30)
            ->get();

        return response()->json([
            'notifications' => $notifications,
            'unread_count' => $this->unreadCount($user->id),
        ]);
    }

    /**
     * Marque une notification de l'utilisateur comme lue.
     * Renvoie 403 si la notification n'appartient pas a l'utilisateur.
     */
    public function markRead(Request $request, string $id): JsonResponse
    {
        $notification = Notification::findOrFail($id);

        if ($notification->user_id !== $request->user()->id) {
            return response()->json([
                'message' => 'Action non autorisee.',
            ], 403);
        }

        if ($notification->status !== 'read') {
            $notification->update(['status' => 'read']);
        }

        return response()->json([
            'notification' => $notification,
            'unread_count' => $this->unreadCount($request->user()->id),
        ]);
    }

    /**
     * Marque toutes les notifications non lues de l'utilisateur comme lues.
     */
    public function markAllRead(Request $request): JsonResponse
    {
        $user = $request->user();

        Notification::where('user_id', $user->id)
            ->where('status', '!=', 'read')
            ->update(['status' => 'read']);

        return response()->json([
            'unread_count' => 0,
        ]);
    }

    /**
     * Nombre de notifications non lues (convention: status != 'read').
     */
    private function unreadCount(int $userId): int
    {
        return Notification::where('user_id', $userId)
            ->where('status', '!=', 'read')
            ->count();
    }
}
