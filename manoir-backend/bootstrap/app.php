<?php

use App\Http\Middleware\AdminMiddleware;
use App\Http\Middleware\EnsureEmailIsVerified;
use App\Http\Middleware\EnsureProfileIsComplete;
use App\Http\Middleware\EnsureTrustedOrigin;
use App\Http\Middleware\RefreshCalendarIfStale;
use App\Http\Middleware\RequireRecentAuthentication;
use App\Http\Middleware\SecurityHeaders;
use App\Http\Middleware\VerifyApiCsrfToken;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Une API ne redirige pas vers une page de connexion : sans cela,
        // Laravel cherche une route nommee `login` qui n'existe pas et renvoie
        // 500 au lieu de 401.
        $middleware->redirectGuestsTo(fn () => null);

        // Derriere le proxy TLS de l'hebergeur : sans cela HTTPS n'est pas
        // detecte (cookies Secure, HSTS, refus du HTTP en clair).
        $middleware->trustProxies(at: env('TRUSTED_PROXIES', '*'));

        $middleware->api(prepend: [SecurityHeaders::class]);

        $middleware->alias([
            'admin' => AdminMiddleware::class,
            'email.verified' => EnsureEmailIsVerified::class,
            'profile.complete' => EnsureProfileIsComplete::class,
            'calendar.fresh' => RefreshCalendarIfStale::class,
            'csrf.api' => VerifyApiCsrfToken::class,
            'trusted.origin' => EnsureTrustedOrigin::class,
            'reauth' => RequireRecentAuthentication::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );

        // Jamais de jeton, mot de passe ou code dans les rapports d'erreur.
        $exceptions->dontFlash([
            'password',
            'password_confirmation',
            'current_password',
            'credential',
            'code',
            'recovery_code',
            'challenge_token',
        ]);
    })->create();
