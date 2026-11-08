<?php

use App\Http\Controllers\Api\Admin\AdminReservationController;
use App\Http\Controllers\Api\Admin\AdminReservationReportController;
use App\Http\Controllers\Api\Admin\AdminRoomCategoryController;
use App\Http\Controllers\Api\Admin\AdminRoomController;
use App\Http\Controllers\Api\Admin\AdminStatsController;
use App\Http\Controllers\Api\Admin\AdminUserController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CalendarSyncController;
use App\Http\Controllers\Api\EmailVerificationController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\ReservationController;
use App\Http\Controllers\Api\ReservationInvoicePdfController;
use App\Http\Controllers\Api\RoomCategoryController;
use App\Http\Controllers\Api\RoomController;
use Illuminate\Support\Facades\Route;

// Routes publiques d'authentification. Chaque limiteur est nomme pour avoir
// son propre compteur (voir AppServiceProvider::configureRateLimiting).
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:register');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');

// Mot de passe oublie
Route::middleware('throttle:password-reset')->group(function () {
    Route::post('/forgot-password', [PasswordResetController::class, 'sendResetLink']);
    Route::post('/reset-password', [PasswordResetController::class, 'reset']);
});

// Routes publiques de consultation. `calendar.fresh` resynchronise les agendas
// Google quand ils ont vieilli, apres l'envoi de la reponse : le site reste a
// jour tout seul, sans tache planifiee.
Route::middleware('calendar.fresh')->group(function () {
    Route::get('/rooms', [RoomController::class, 'index']);
    Route::get('/rooms/{slug}', [RoomController::class, 'show']);
    Route::post('/rooms/{slug}/check-availability', [RoomController::class, 'checkAvailability']);
    Route::get('/room-categories', [RoomCategoryController::class, 'index']);
    Route::get('/room-categories/{category}', [RoomCategoryController::class, 'show']);
    Route::post('/room-categories/{category}/check-availability', [RoomCategoryController::class, 'checkAvailability']);
});

// Declencheur pour un service de cron externe (l'hebergement gratuit n'en
// fournit pas). Protege par un jeton secret ; sans jeton configure, la route
// repond 404 et n'existe donc pas.
Route::post('/calendar/sync', [CalendarSyncController::class, 'trigger'])
    ->middleware('throttle:calendar-sync');

// Routes protégées (authentification requise)
Route::middleware('auth:sanctum')->group(function () {
    // Authentification
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'me']);
    Route::put('/user/profile', [AuthController::class, 'updateProfile']);
    Route::put('/user/password', [AuthController::class, 'updatePassword']);

    // Confirmation d'adresse email par code a 6 chiffres
    Route::get('/email/status', [EmailVerificationController::class, 'status']);
    Route::post('/email/verify-code', [EmailVerificationController::class, 'verifyCode'])
        ->middleware('throttle:email-verify');
    Route::post('/email/resend', [EmailVerificationController::class, 'resend'])
        ->middleware('throttle:email-resend');

    // Réservations client
    // Creer une demande engage le client et le Manoir : l'adresse email doit
    // etre confirmee, sinon la personne reste injoignable pour son sejour.
    Route::post('/reservations', [ReservationController::class, 'store'])
        ->middleware('email.verified');
    Route::get('/reservations', [ReservationController::class, 'myReservations']);
    Route::get('/reservations/{id}', [ReservationController::class, 'show']);
    Route::get('/reservations/{id}/invoice-pdf', [ReservationInvoicePdfController::class, 'download']);
    Route::get('/reservations/{id}/payments', [ReservationController::class, 'payments']);
    Route::post('/reservations/{id}/invoice-download', [ReservationController::class, 'markInvoiceDownloaded']);
    Route::post('/reservations/{id}/cancel', [ReservationController::class, 'cancel']);

    // Nettoyage de l'historique cote client. Rien n'est supprime : la
    // reservation est simplement retiree de sa liste.
    Route::post('/reservations/vider-historique', [ReservationController::class, 'viderHistorique']);
    Route::post('/reservations/{id}/masquer', [ReservationController::class, 'masquer']);
    Route::post('/reservations/{id}/extension', [ReservationController::class, 'requestExtension']);

    // Paiements
    Route::post('/reservations/{reservationId}/payments/initiate', [PaymentController::class, 'initiate'])
        ->middleware('email.verified');
    Route::get('/payments/{paymentId}/status', [PaymentController::class, 'checkStatus']);

    // Factures
    Route::get('/payments/{paymentId}/invoice', [InvoiceController::class, 'show']);

    // Notifications in-app
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead']);
});

// Webhook pour les paiements. ATTENTION: route publique, aucune signature vérifiée à ce jour.
Route::post('/payments/{paymentId}/webhook', [PaymentController::class, 'webhook']);

// Routes admin (protégées par middleware admin)
Route::middleware(['auth:sanctum', 'admin'])->prefix('admin')->group(function () {
    Route::get('/reservations', [AdminReservationController::class, 'index']);
    Route::post('/reservations/report', [AdminReservationReportController::class, 'download']);
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
