<?php

use App\Http\Controllers\Api\AccountSecurityController;
use App\Http\Controllers\Api\Admin\AdminReservationController;
use App\Http\Controllers\Api\Admin\AdminReservationReportController;
use App\Http\Controllers\Api\Admin\AdminRoomCategoryController;
use App\Http\Controllers\Api\Admin\AdminRoomController;
use App\Http\Controllers\Api\Admin\AdminStatsController;
use App\Http\Controllers\Api\Admin\AdminStayExtensionController;
use App\Http\Controllers\Api\Admin\AdminUserController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CalendarSyncController;
use App\Http\Controllers\Api\InvoiceController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\ReservationController;
use App\Http\Controllers\Api\ReservationInvoicePdfController;
use App\Http\Controllers\Api\RoomCategoryController;
use App\Http\Controllers\Api\RoomController;
use App\Http\Controllers\Api\StayExtensionController;
use App\Http\Controllers\Api\StayVoucherController;
use Illuminate\Support\Facades\Route;
use WendellAdriel\Idempotency\Http\Middleware\Idempotent;

/*
|--------------------------------------------------------------------------
| Principe : tout est PRIVE par defaut.
|--------------------------------------------------------------------------
|
| Seules les routes de la section « Routes publiques » ci-dessous sont
| accessibles sans session. Toute nouvelle route doit etre ajoutee dans un
| groupe protege, sauf decision explicite.
|
| Idempotence (wendelladriel/laravel-idempotency) : les routes qui creent une
| demande ou un paiement exigent l'en-tete Idempotency-Key. Les reponses en
| erreur ne sont pas memorisees, pour qu'un nouvel essai avec la meme cle
| soit reexecute.
|
*/

$idempotent = Idempotent::using(
    required: true,
    cacheStatuses: ['client_error' => false, 'server_error' => false],
);

/*
|--------------------------------------------------------------------------
| Routes publiques
|--------------------------------------------------------------------------
*/

Route::prefix('auth')->group(function () {
    Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:register');
    Route::post('/email/verify', [AuthController::class, 'verifyEmail'])->middleware('throttle:email-verify');
    Route::post('/email/resend', [AuthController::class, 'resendVerification'])->middleware('throttle:email-resend');
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');
    Route::post('/two-factor/challenge', [AuthController::class, 'twoFactorChallenge'])->middleware('throttle:two-factor');
    Route::post('/google', [AuthController::class, 'google'])->middleware('throttle:google-auth');

    // S'appuient sur le seul cookie de refresh : l'origine est controlee.
    Route::post('/refresh', [AuthController::class, 'refresh'])->middleware(['throttle:auth-refresh', 'trusted.origin']);
    Route::post('/logout', [AuthController::class, 'logout'])->middleware('trusted.origin');

    // Etat de session : user: null pour un visiteur (pas de 401).
    Route::get('/session', [AuthController::class, 'session']);

    Route::middleware('throttle:password-reset')->group(function () {
        Route::post('/forgot-password', [PasswordResetController::class, 'sendResetLink']);
        Route::post('/reset-password', [PasswordResetController::class, 'reset']);
    });
});

// Catalogue. `calendar.fresh` resynchronise les agendas Google quand ils ont
// vieilli, apres l'envoi de la reponse.
Route::middleware('calendar.fresh')->group(function () {
    Route::get('/rooms', [RoomController::class, 'index']);
    Route::get('/rooms/{slug}', [RoomController::class, 'show']);
    Route::post('/rooms/{slug}/check-availability', [RoomController::class, 'checkAvailability']);
    Route::get('/room-categories', [RoomCategoryController::class, 'index']);
    Route::get('/room-categories/{category}', [RoomCategoryController::class, 'show']);
    Route::post('/room-categories/{category}/check-availability', [RoomCategoryController::class, 'checkAvailability']);
});

// Declencheur pour un cron externe. Protege par un jeton secret ; sans jeton
// configure, la route repond 404.
Route::post('/calendar/sync', [CalendarSyncController::class, 'trigger'])
    ->middleware('throttle:calendar-sync');

/*
|--------------------------------------------------------------------------
| Session connectee, avant finalisation du profil
|--------------------------------------------------------------------------
|
| Accessible a un compte Google qui n'a pas encore saisi son telephone : il
| doit pouvoir lire sa session et completer son numero.
|
*/

Route::middleware(['auth:api', 'csrf.api'])->group(function () {
    Route::get('/user', [AuthController::class, 'me']);
    Route::post('/user/phone', [AccountSecurityController::class, 'completePhone'])
        ->middleware(['email.verified', 'throttle:phone-submit']);
});

/*
|--------------------------------------------------------------------------
| Compte : profil et securite (email confirme requis)
|--------------------------------------------------------------------------
*/

Route::middleware(['auth:api', 'csrf.api', 'email.verified'])->group(function () {
    Route::post('/auth/reauthenticate', [AccountSecurityController::class, 'reauthenticate'])
        ->middleware('throttle:reauthenticate');

    Route::get('/auth/sessions', [AccountSecurityController::class, 'listSessions']);
    Route::delete('/auth/sessions/{sessionId}', [AccountSecurityController::class, 'revokeSession']);

    Route::put('/user/profile', [AccountSecurityController::class, 'updateProfile']);

    Route::post('/auth/two-factor/confirm', [AccountSecurityController::class, 'confirmTwoFactorSetup'])
        ->middleware('throttle:two-factor');

    // Actions sensibles : reauthentification recente obligatoire.
    Route::middleware('reauth')->group(function () {
        Route::put('/user/password', [AccountSecurityController::class, 'updatePassword']);
        Route::post('/user/email', [AccountSecurityController::class, 'requestEmailChange'])->middleware('throttle:email-resend');
        Route::post('/user/email/confirm', [AccountSecurityController::class, 'confirmEmailChange'])->middleware('throttle:two-factor');
        Route::post('/auth/sessions/revoke-others', [AccountSecurityController::class, 'revokeOtherSessions']);
        Route::post('/auth/two-factor/setup', [AccountSecurityController::class, 'beginTwoFactorSetup']);
        Route::delete('/auth/two-factor', [AccountSecurityController::class, 'disableTwoFactor']);
        Route::post('/auth/two-factor/recovery-codes', [AccountSecurityController::class, 'regenerateRecoveryCodes']);
    });
});

/*
|--------------------------------------------------------------------------
| Espace client (email confirme + telephone renseigne)
|--------------------------------------------------------------------------
*/

Route::middleware(['auth:api', 'csrf.api', 'email.verified', 'profile.complete'])->group(function () use ($idempotent) {
    // Demandes de reservation : gratuites, soumises a validation.
    Route::post('/reservations', [ReservationController::class, 'store'])->middleware($idempotent);
    Route::get('/reservations', [ReservationController::class, 'myReservations']);
    Route::post('/reservations/vider-historique', [ReservationController::class, 'viderHistorique']);
    Route::get('/reservations/{id}', [ReservationController::class, 'show']);
    Route::get('/reservations/{id}/invoice-pdf', [ReservationInvoicePdfController::class, 'download']);
    Route::get('/reservations/{id}/payments', [ReservationController::class, 'payments']);
    Route::post('/reservations/{id}/invoice-download', [ReservationController::class, 'markInvoiceDownloaded']);
    Route::post('/reservations/{id}/cancel', [ReservationController::class, 'cancel']);
    Route::post('/reservations/{id}/masquer', [ReservationController::class, 'masquer']);

    // Prolongations de sejour.
    Route::get('/reservations/{id}/extensions', [StayExtensionController::class, 'index']);
    Route::post('/reservations/{id}/extensions', [StayExtensionController::class, 'store'])->middleware($idempotent);

    // Paiements FeexPay : ouverts uniquement apres validation par l'admin.
    Route::middleware('throttle:payments')->group(function () use ($idempotent) {
        Route::post('/reservations/{id}/payments', [PaymentController::class, 'initiateForReservation'])->middleware($idempotent);
        Route::post('/extensions/{id}/payments', [PaymentController::class, 'initiateForExtension'])->middleware($idempotent);
        Route::post('/payments/{paymentId}/verify', [PaymentController::class, 'verify']);
        Route::post('/payments/{paymentId}/sandbox-confirm', [PaymentController::class, 'confirmSandbox']);
        Route::post('/payments/verify-reference', [PaymentController::class, 'verifyByReference']);
    });
    Route::get('/payments/channels', [PaymentController::class, 'channels']);
    Route::get('/payments/{paymentId}/status', [PaymentController::class, 'status']);

    // Bons de Sejour (emis apres paiement) et factures.
    Route::get('/reservations/{id}/vouchers', [StayVoucherController::class, 'index']);
    Route::get('/vouchers/{voucherId}/pdf', [StayVoucherController::class, 'download']);
    Route::get('/payments/{paymentId}/invoice', [InvoiceController::class, 'show']);

    // Notifications in-app.
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead']);
});

/*
|--------------------------------------------------------------------------
| Administration
|--------------------------------------------------------------------------
|
| Le role est relu en base a chaque requete (middleware `admin`) : rien de ce
| que le frontend affirme n'est pris en compte.
|
*/

Route::middleware(['auth:api', 'csrf.api', 'email.verified', 'profile.complete', 'admin'])->prefix('admin')->group(function () {
    // Demandes de reservation.
    Route::get('/reservations', [AdminReservationController::class, 'index']);
    Route::post('/reservations/report', [AdminReservationReportController::class, 'download']);
    Route::get('/occupied-rooms', [AdminReservationController::class, 'occupiedRooms']);
    Route::post('/reservations/check-conflicts', [AdminReservationController::class, 'checkConflicts']);
    Route::post('/reservations/{id}/approve', [AdminReservationController::class, 'approve']);
    Route::post('/reservations/{id}/reject', [AdminReservationController::class, 'reject']);
    Route::post('/reservations/{id}/release-room', [AdminReservationController::class, 'releaseRoom']);
    Route::post('/reservations/{id}/mark-refunded', [AdminReservationController::class, 'markRefunded']);

    // Demandes de prolongation.
    Route::get('/extensions', [AdminStayExtensionController::class, 'index']);
    Route::post('/extensions/{id}/approve', [AdminStayExtensionController::class, 'approve']);
    Route::post('/extensions/{id}/reject', [AdminStayExtensionController::class, 'reject']);

    // Appartements et categories.
    Route::post('/rooms/{room}/media', [AdminRoomController::class, 'uploadMedia']);
    Route::apiResource('/rooms', AdminRoomController::class);
    Route::get('/room-categories', [AdminRoomCategoryController::class, 'index']);
    Route::put('/room-categories/{category}', [AdminRoomCategoryController::class, 'update']);
    Route::post('/room-categories/{category}/media', [AdminRoomCategoryController::class, 'uploadMedia']);

    Route::get('/stats', [AdminStatsController::class, 'dashboard']);

    // Utilisateurs : consultation et modification uniquement. AUCUNE route
    // de suppression (voir UserPolicy).
    Route::get('/users', [AdminUserController::class, 'index']);
    Route::put('/users/{id}', [AdminUserController::class, 'update']);
    Route::put('/users/{id}/toggle-admin', [AdminUserController::class, 'toggleAdmin']);
});
