<?php

$isProduction = env('APP_ENV') === 'production';

return [
    'paths' => ['api/*'],

    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    /*
    | Origines approuvees UNIQUEMENT : FRONTEND_URL, plus d'eventuelles
    | origines supplementaires separees par des virgules dans
    | CORS_EXTRA_ORIGINS (ex : https://www.lemanoir.bj).
    | Le developpement local n'est autorise qu'en dehors de la production.
    | Aucun joker : avec des cookies d'authentification, autoriser par exemple
    | tout *.vercel.app laisserait n'importe quel projet Vercel agir au nom
    | des utilisateurs connectes.
    */
    'allowed_origins' => array_values(array_filter(array_merge(
        [rtrim((string) env('FRONTEND_URL', ''), '/')],
        array_map(fn (string $origin) => rtrim(trim($origin), '/'), explode(',', (string) env('CORS_EXTRA_ORIGINS', ''))),
        $isProduction ? [] : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    ))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => [
        'Accept',
        'Content-Type',
        'Authorization',
        'X-CSRF-Token',
        'Idempotency-Key',
        'X-Requested-With',
    ],

    'exposed_headers' => ['Content-Disposition', 'Idempotency-Replayed', 'Retry-After'],

    'max_age' => 3600,

    // Les jetons voyagent dans des cookies HttpOnly : le navigateur ne les
    // envoie a l'API que si les credentials sont autorises.
    'supports_credentials' => true,
];
