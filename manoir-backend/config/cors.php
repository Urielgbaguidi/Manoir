<?php

return [
    // Le middleware CORS de Laravel s'applique aux routes API.
    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    // Origines autorisées : le frontend Vercel (via FRONTEND_URL) + le dev local.
    'allowed_origins' => array_values(array_filter([
        env('FRONTEND_URL'),
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ])),

    // Couvre automatiquement tous les domaines *.vercel.app (previews inclus).
    'allowed_origins_patterns' => [
        '#^https://.*\.vercel\.app$#',
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 3600,

    // Auth par token dans l'en-tête Authorization (pas de cookies) → pas de credentials.
    'supports_credentials' => false,
];
