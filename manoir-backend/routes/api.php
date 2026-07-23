<?php

use App\Http\Controllers\Api\Admin\AdminReservationController;
use App\Http\Controllers\Api\Admin\AdminRoomCategoryController;
use App\Http\Controllers\Api\Admin\AdminRoomController;
use App\Http\Controllers\Api\Admin\AdminStatsController;
use App\Http\Controllers\Api\Admin\AdminUserController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\ReservationController;
use App\Http\Controllers\Api\RoomCategoryController;
use App\Http\Controllers\Api\RoomController;
use Illuminate\Support\Facades\Route;

// Routes publiques d'authentification (limitées: 6 tentatives / minute / IP)
Route::middleware('throttle:6,1')->group(function () {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
});

// Routes publiques de consultation
Route::get('/rooms', [RoomController::class, 'index']);
Route::get('/rooms/{slug}', [RoomController::class, 'show']);
Route::post('/rooms/{slug}/check-availability', [RoomController::class, 'checkAvailability']);
Route::get('/room-categories', [RoomCategoryController::class, 'index']);
Route::get('/room-categories/{category}', [RoomCategoryController::class, 'show']);
Route::post('/room-categories/{category}/check-availability', [RoomCategoryController::class, 'checkAvailability']);

// Routes protégées (authentification requise)
Route::middleware('api.token')->group(function () {
    // Authentification
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'me']);
    Route::put('/user/profile', [AuthController::class, 'updateProfile']);
    Route::put('/user/password', [AuthController::class, 'updatePassword']);

    // Réservations client
    Route::post('/reservations', [ReservationController::class, 'store']);
    Route::get('/reservations', [ReservationController::class, 'myReservations']);
    Route::get('/reservations/{id}', [ReservationController::class, 'show']);
    Route::get('/reservations/{id}/payments', [ReservationController::class, 'payments']);
    Route::post('/reservations/{id}/invoice-download', [ReservationController::class, 'markInvoiceDownloaded']);
    Route::post('/reservations/{id}/cancel', [ReservationController::class, 'cancel']);
    Route::post('/reservations/{id}/extension', [ReservationController::class, 'requestExtension']);

    // Paiements
    Route::post('/reservations/{reservationId}/payments/initiate', [PaymentController::class, 'initiate']);
    Route::get('/payments/{paymentId}/status', [PaymentController::class, 'checkStatus']);

    // Factures
    Route::get('/payments/{paymentId}/invoice', [InvoiceController::class, 'show']);

    // Notifications in-app
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead']);
});

// Webhook pour les paiements (pas d'authentification, mais signature vérifiée)
Route::post('/payments/{paymentId}/webhook', [PaymentController::class, 'webhook']);

// Routes admin (protégées par middleware admin)
Route::middleware(['api.token', 'admin'])->prefix('admin')->group(function () {
    Route::get('/reservations', [AdminReservationController::class, 'index']);
    Route::get('/occupied-rooms', [AdminReservationController::class, 'occupiedRooms']);
    Route::post('/reservations/{id}/approve', [AdminReservationController::class, 'approve']);
    Route::post('/reservations/{id}/reject', [AdminReservationController::class, 'reject']);
    Route::post('/reservations/{id}/release-room', [AdminReservationController::class, 'releaseRoom']);
    Route::post('/reservations/{id}/mark-refunded', [AdminReservationController::class, 'markRefunded']);
    Route::post('/reservations/{id}/extension/approve', [AdminReservationController::class, 'approveExtension']);
    Route::post('/reservations/{id}/extension/reject', [AdminReservationController::class, 'rejectExtension']);
    Route::post('/reservations/check-conflicts', [AdminReservationController::class, 'checkConflicts']);

    // Gestion des chambres
    Route::post('/rooms/{room}/media', [AdminRoomController::class, 'uploadMedia']);
    Route::apiResource('/rooms', AdminRoomController::class);
    Route::get('/room-categories', [AdminRoomCategoryController::class, 'index']);
    Route::put('/room-categories/{category}', [AdminRoomCategoryController::class, 'update']);
    Route::post('/room-categories/{category}/media', [AdminRoomCategoryController::class, 'uploadMedia']);

    // Statistiques
    Route::get('/stats', [AdminStatsController::class, 'dashboard']);

    // Utilisateurs
    Route::get('/users', [AdminUserController::class, 'index']);
    Route::put('/users/{id}', [AdminUserController::class, 'update']);
    Route::put('/users/{id}/toggle-admin', [AdminUserController::class, 'toggleAdmin']);
    Route::delete('/users/{id}', [AdminUserController::class, 'destroy']);
});
