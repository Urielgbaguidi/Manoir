<?php

namespace App\Providers;

use App\Models\User;
use App\Policies\UserPolicy;
use App\Services\Auth\JwtRequestAuthenticator;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Gate;
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
        $this->configureAuthentication();
        $this->configureRateLimiting();

        Gate::policy(User::class, UserPolicy::class);
    }

    /**
     * Guard `jwt` : chaque requete protegee revalide le jeton ET la session.
     */
    private function configureAuthentication(): void
    {
        Auth::viaRequest('jwt', fn (Request $request) => app(JwtRequestAuthenticator::class)($request));
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
        // Le blocage apres echecs repetes est gere par LoginThrottle.
        RateLimiter::for('login', fn (Request $request) => [
            Limit::perMinute(6)->by($request->ip().'|'.strtolower((string) $request->input('email'))),
            Limit::perMinute(30)->by($request->ip()),
        ]);

        RateLimiter::for('register', fn (Request $request) => [
            Limit::perMinute(5)->by($request->ip()),
            Limit::perHour(20)->by($request->ip()),
        ]);

        RateLimiter::for('google-auth', fn (Request $request) => Limit::perMinute(10)->by($request->ip()));

        // Un navigateur rafraichit au plus toutes les quelques minutes par
        // onglet : au-dela, c'est un script.
        RateLimiter::for('auth-refresh', fn (Request $request) => Limit::perMinute(30)->by($request->ip()));

        RateLimiter::for('password-reset', fn (Request $request) => [
            Limit::perMinute(5)->by($request->ip()),
            Limit::perHour(10)->by(strtolower((string) $request->input('email')).'|'.$request->ip()),
        ]);

        RateLimiter::for('two-factor', fn (Request $request) => Limit::perMinute(6)->by(
            $request->user()?->id ?: $request->ip()
        ));

        RateLimiter::for('reauthenticate', fn (Request $request) => Limit::perMinute(6)->by(
            $request->user()?->id ?: $request->ip()
        ));

        RateLimiter::for('phone-submit', fn (Request $request) => Limit::perMinute(5)->by(
            $request->user()?->id ?: $request->ip()
        ));

        // Saisie du code a 6 chiffres. Le nombre d'essais par code est deja
        // plafonne dans EmailVerificationCode ; cette limite-ci protege en plus
        // contre un attaquant qui essaierait des adresses en boucle.
        RateLimiter::for('email-verify', fn (Request $request) => [
            Limit::perMinute(10)->by($request->ip()),
            Limit::perMinute(5)->by(strtolower((string) $request->input('email'))),
        ]);

        // Declencheur de synchronisation appele de l'exterieur : quelques appels
        // par heure suffisent, et cela borne la charge sur l'API Google.
        RateLimiter::for('calendar-sync', fn (Request $request) => Limit::perMinute(6)->by($request->ip()));

        // Chaque renvoi consomme le quota d'envoi : on serre volontairement.
        RateLimiter::for('email-resend', fn (Request $request) => [
            Limit::perHour(3)->by(strtolower((string) $request->input('email'))),
            Limit::perHour(10)->by($request->ip()),
        ]);

        RateLimiter::for('payments', fn (Request $request) => Limit::perMinute(10)->by(
            $request->user()?->id ?: $request->ip()
        ));
    }
}
