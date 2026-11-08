<?php

use App\Http\Middleware\AdminMiddleware;
use App\Http\Middleware\EnsureEmailIsVerified;
use App\Http\Middleware\RefreshCalendarIfStale;
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
        // 500 au lieu de 401. Le frontend ne peut alors pas detecter la session
        // expiree et affiche une erreur incomprehensible.
        $middleware->redirectGuestsTo(fn () => null);

        $middleware->alias([
            'admin' => AdminMiddleware::class,
            'email.verified' => EnsureEmailIsVerified::class,
            'calendar.fresh' => RefreshCalendarIfStale::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );
    })->create();
