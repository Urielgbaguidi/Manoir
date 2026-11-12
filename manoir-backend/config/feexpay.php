<?php

/*
|--------------------------------------------------------------------------
| FeexPay
|--------------------------------------------------------------------------
|
| Documentation : https://docs.feexpay.me/?version=v2
|
| Le SDK JavaScript officiel exige la cle dans le navigateur (fonctionnement
| documente par FeexPay). Le backend ne la renvoie qu'au client authentifie
| qui paie une reservation validee. Les appels de verification, eux, partent
| toujours du serveur.
|
| Mode SANDBOX : aucun webhook n'est implemente. Le statut d'un paiement est
| confirme en interrogeant la route de statut FeexPay depuis le serveur.
|
*/

$mode = strtoupper((string) env('FEEXPAY_MODE', 'SANDBOX'));

return [

    // SANDBOX ou LIVE.
    'mode' => in_array($mode, ['SANDBOX', 'LIVE'], true) ? $mode : 'SANDBOX',

    /*
    | En SANDBOX uniquement : le SDK JavaScript FeexPay simule le paiement
    | (aucune transaction reelle n'est creee). Pour que le parcours de test
    | aille jusqu'au Bon de Sejour, le serveur peut accepter la confirmation
    | renvoyee par ce SDK. Ne jamais activer en production.
    */
    'sandbox_trust_sdk' => (bool) env('FEEXPAY_SANDBOX_TRUST_SDK', false),

    'base_url' => $mode === 'LIVE'
        ? env('FEEXPAY_LIVE_URL', 'https://api-v2.feexpay.me')
        : env('FEEXPAY_SANDBOX_URL', 'https://sandbox-api.feexpay.me'),

    // Cle privee (prefixe `test_key_` en sandbox).
    'api_key' => env('FEEXPAY_API_KEY'),

    // Identifiant public de la boutique (champ `shop` de chaque requete).
    'shop_id' => env('FEEXPAY_SHOP_ID'),

    /*
    | Script du checkout officiel FeexPay (SDK JavaScript).
    |
    | Le SDK officiel code en dur l'URL de production api-v2, qui ne connait
    | pas les boutiques du sandbox. En SANDBOX, on sert donc une copie locale
    | corrigee (public/feexpay-sdk/sandbox.js cote frontend) : seule l'URL de
    | l'API est remplacee par https://sandbox-api.feexpay.me.
    |
    | En LIVE, le script officiel est charge tel quel.
    */
    'sdk_url' => $mode === 'LIVE'
        ? env('FEEXPAY_SDK_URL', 'https://api-v2.feexpay.me/feexpay-javascript-sdk/index.js')
        : env('FEEXPAY_SANDBOX_SDK_URL', '/feexpay-sdk/sandbox.js'),

    'currency' => env('FEEXPAY_CURRENCY', 'XOF'),

    // Delai maximal d'un appel HTTP a FeexPay, en secondes.
    'timeout' => (int) env('FEEXPAY_TIMEOUT', 20),

    // Nouvelles tentatives apres une coupure reseau.
    'retries' => (int) env('FEEXPAY_RETRIES', 2),
];
