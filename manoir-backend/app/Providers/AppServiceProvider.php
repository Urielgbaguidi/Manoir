<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureRateLimiting();
    }

    /**
     * Limiteurs nommes.
     *
     * Attention : un `throttle:6,1` anonyme est keye sur (domaine, IP) et
     * ignore l'URL. Toutes les routes qui l'utilisent partagent donc le meme
     * compteur, et se connecter epuise le quota de la confirmation d'email.
     * Chaque limiteur nomme dispose au contraire de son propre compteur.
     */
    private function configureRateLimiting(): void
    {
        // Connexion : keye sur l'IP ET l'email vise, pour qu'une attaque sur
        // un compte ne bloque pas les autres utilisateurs derriere la meme IP.
        RateLimiter::for('login', fn (Request $request) => [
            Limit::perMinute(6)->by($request->ip().'|'.strtolower((string) $request->input('email'))),
            Limit::perMinute(30)->by($request->ip()),
        ]);

        RateLimiter::for('register', fn (Request $request) => Limit::perMinute(6)->by($request->ip()));

        RateLimiter::for('password-reset', fn (Request $request) => Limit::perMinute(6)->by($request->ip()));

        // Saisie du code a 6 chiffres. Le nombre d'essais par code est deja
        // plafonne dans EmailVerificationCode ; cette limite-ci protege en plus
        // contre un attaquant qui creerait des comptes en boucle.
        RateLimiter::for('email-verify', fn (Request $request) => Limit::perMinute(10)->by(
            $request->user()?->id ?: $request->ip()
        ));

        // Declencheur de synchronisation appele de l'exterieur : quelques appels
        // par heure suffisent, et cela borne la charge sur l'API Google.
        RateLimiter::for('calendar-sync', fn (Request $request) => Limit::perMinute(6)->by($request->ip()));

        // Chaque renvoi consomme le quota Brevo : on serre volontairement.
        RateLimiter::for('email-resend', fn (Request $request) => Limit::perHour(3)->by(
            $request->user()?->id ?: $request->ip()
        ));
    }
}
