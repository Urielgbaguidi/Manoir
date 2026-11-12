<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Signature des jetons d'acces
    |--------------------------------------------------------------------------
    |
    | HS256 avec un secret dedie d'au moins 32 octets, distinct de APP_KEY.
    | Generer avec : php -r "echo base64_encode(random_bytes(64));"
    | L'algorithme est fige : un jeton annoncant un autre algorithme (dont
    | `none`) est rejete.
    |
    */

    'secret' => env('JWT_SECRET'),

    'algorithm' => 'HS256',

    'issuer' => env('JWT_ISSUER', env('APP_URL', 'http://localhost:8000')),

    'audience' => env('JWT_AUDIENCE', env('FRONTEND_URL', 'http://localhost:3000')),

    /*
    |--------------------------------------------------------------------------
    | Durees de vie
    |--------------------------------------------------------------------------
    |
    | Jeton d'acces court (5 a 10 minutes) ; refresh token borne (7 a 30 jours).
    | Les valeurs hors de ces bornes sont ramenees dans l'intervalle.
    |
    */

    'access_ttl_minutes' => max(5, min(10, (int) env('JWT_ACCESS_TTL_MINUTES', 10))),

    'refresh_ttl_days' => max(7, min(30, (int) env('JWT_REFRESH_TTL_DAYS', 14))),

    /*
    | Tolerance (secondes) pour un refresh token qui vient d'etre renouvele :
    | deux onglets qui rafraichissent au meme instant ne doivent pas etre pris
    | pour un vol. Au-dela de ce delai, toute reutilisation revoque la session.
    */
    'refresh_reuse_grace_seconds' => (int) env('JWT_REFRESH_REUSE_GRACE_SECONDS', 10),

    /*
    | Fenetre pendant laquelle une reauthentification reste valable pour les
    | actions sensibles (mot de passe, email, 2FA, revocation de sessions).
    */
    'reauth_ttl_minutes' => (int) env('JWT_REAUTH_TTL_MINUTES', 10),

    /*
    | Duree de validite du jeton intermediaire entre le mot de passe et le
    | code de double authentification.
    */
    'two_factor_challenge_ttl_minutes' => 5,

    /*
    |--------------------------------------------------------------------------
    | Cookies
    |--------------------------------------------------------------------------
    |
    | Les jetons ne transitent que par des cookies HttpOnly : le JavaScript du
    | frontend n'y a jamais acces (protection contre le vol par XSS).
    |
    | Production (lemanoir.bj + api.lemanoir.bj, meme site) :
    |   JWT_COOKIE_DOMAIN=.lemanoir.bj  JWT_COOKIE_SECURE=true  JWT_COOKIE_SAMESITE=lax
    |
    */

    'cookies' => [
        'access' => env('JWT_ACCESS_COOKIE', 'manoir_at'),
        'refresh' => env('JWT_REFRESH_COOKIE', 'manoir_rt'),
        'domain' => env('JWT_COOKIE_DOMAIN'),
        'secure' => (bool) env('JWT_COOKIE_SECURE', env('APP_ENV') === 'production'),
        'same_site' => env('JWT_COOKIE_SAMESITE', 'lax'),
        // Le refresh token n'est envoye qu'aux routes qui en ont besoin.
        'refresh_path' => '/api/auth',
    ],

];
