<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Agendas Google, un par appartement
    |--------------------------------------------------------------------------
    |
    | Le numero d'appartement vient de l'AGENDA, jamais du titre de l'evenement.
    | Les titres sont saisis a la main par plusieurs personnes et sont trop
    | irreguliers pour etre analyses de facon fiable.
    |
    | Les adresses sont des secrets : elles donnent acces en lecture a tout
    | l'agenda. Elles vivent dans .env, jamais dans le depot.
    |
    */

    'apartments' => array_filter([
        1 => env('GOOGLE_CALENDAR_ICAL_1'),
        2 => env('GOOGLE_CALENDAR_ICAL_2'),
        3 => env('GOOGLE_CALENDAR_ICAL_3'),
        4 => env('GOOGLE_CALENDAR_ICAL_4'),
        5 => env('GOOGLE_CALENDAR_ICAL_5'),
        6 => env('GOOGLE_CALENDAR_ICAL_6'),
        7 => env('GOOGLE_CALENDAR_ICAL_7'),
        8 => env('GOOGLE_CALENDAR_ICAL_8'),
    ]),

    /*
    |--------------------------------------------------------------------------
    | Agenda general « LE MANOIR »
    |--------------------------------------------------------------------------
    |
    | Il ne double PAS les agendas par appartement. Il melange :
    |   - des reservations portant sur plusieurs appartements a la fois
    |     (« Batiment Complet », « tous les appartements », « tout sauf le 2 »),
    |   - des elements qui ne sont pas des reservations (« Demo kkiapay »,
    |     « SMS Reminder Setup »), et des evenements sans titre.
    |
    | On ne bloque JAMAIS automatiquement a partir de cet agenda : deduire
    | « tout sauf le 2 » d'une phrase libre reviendrait a rendre indisponibles
    | sept appartements sur une supposition. Il sert uniquement a produire un
    | rapport de controle pour l'administration.
    |
    */

    'general' => env('GOOGLE_CALENDAR_ICAL_GENERAL'),

    /*
    |--------------------------------------------------------------------------
    | Convention de dates
    |--------------------------------------------------------------------------
    |
    | Dans l'agenda, un evenement « du 7 au 9, 2 nuitees » est saisi
    | DTSTART=07 et DTEND=10. Le DTEND iCal etant exclusif, le dernier jour
    | affiche est le 9 : c'est le jour du DEPART, marque comme occupe.
    |
    | Le site, lui, libere la nuit du depart. La date de fin d'un blocage vaut
    | donc DTEND - 1 jour. Verifie sur 48 evenements : 46 concordent avec le
    | nombre de nuitees ecrit dans le titre, 2 ecarts imputables a des fautes
    | de frappe dans les titres.
    |
    */

    'checkout_day_is_marked_occupied' => true,

    /*
    |--------------------------------------------------------------------------
    | Fenetre de synchronisation
    |--------------------------------------------------------------------------
    |
    | Inutile d'importer l'historique : seules les dates futures influencent la
    | disponibilite. La marge en arriere couvre les sejours deja commences.
    |
    */

    'past_days' => 7,

    'timeout' => 30,

    /*
    |--------------------------------------------------------------------------
    | Fraicheur des donnees
    |--------------------------------------------------------------------------
    |
    | Au-dela de ce delai, la prochaine consultation de disponibilite declenche
    | une resynchronisation. Elle est lancee APRES l'envoi de la reponse, pour
    | que le visiteur n'attende jamais le telechargement des agendas.
    |
    | C'est ce mecanisme qui rend le site autonome : l'hebergement gratuit de
    | Render ne propose pas de taches planifiees, et le service s'endort apres
    | quinze minutes d'inactivite.
    |
    */

    'stale_after_minutes' => (int) env('CALENDAR_SYNC_STALE_MINUTES', 15),

    /*
    |--------------------------------------------------------------------------
    | Declencheur externe
    |--------------------------------------------------------------------------
    |
    | Jeton attendu dans l'en-tete X-Calendar-Sync-Token pour appeler
    | POST /api/calendar/sync depuis un service de cron gratuit. Laisser vide
    | desactive completement cette route.
    |
    */

    'trigger_token' => env('CALENDAR_SYNC_TOKEN'),

    /*
    |--------------------------------------------------------------------------
    | Ecriture dans l'agenda (site -> Google)
    |--------------------------------------------------------------------------
    |
    | Quand un client paie son acompte, la reservation devient une occupation
    | reelle : elle doit apparaitre dans l'agenda de l'appartement, sans quoi
    | l'equipe pourrait relouer la meme periode au telephone.
    |
    | Les Calendar ID (GOOGLE_CALENDAR_ID_*) suffisent a designer l'agenda,
    | mais pas a y ecrire : il faut un compte de service, dont la cle privee
    | est un secret et ne doit jamais entrer dans le depot. Sans fichier de
    | cle, l'ecriture est simplement inactive et le site fonctionne comme
    | avant.
    |
    */

    'write' => [
        'enabled' => (bool) env('GOOGLE_CALENDAR_WRITE', true),

        'credentials' => env('GOOGLE_CALENDAR_CREDENTIALS', storage_path('google-calendar.json')),

        // Agendas ou ecrire, un par appartement. Ce sont les memes identifiants
        // que ceux utilises en lecture.
        'calendars' => array_filter([
            1 => env('GOOGLE_CALENDAR_ID_1'),
            2 => env('GOOGLE_CALENDAR_ID_2'),
            3 => env('GOOGLE_CALENDAR_ID_3'),
            4 => env('GOOGLE_CALENDAR_ID_4'),
            5 => env('GOOGLE_CALENDAR_ID_5'),
            6 => env('GOOGLE_CALENDAR_ID_6'),
            7 => env('GOOGLE_CALENDAR_ID_7'),
            8 => env('GOOGLE_CALENDAR_ID_8'),
        ]),

        // Prefixe du titre : permet de distinguer d'un coup d'oeil, dans
        // l'agenda, ce qui vient du site de ce qui a ete saisi a la main.
        'prefix' => env('GOOGLE_CALENDAR_WRITE_PREFIX', 'Site'),

        // Meme patience qu'en lecture. A 10 s, l'ecriture expirait avant que
        // Google ne reponde et la reservation payee restait absente de
        // l'agenda.
        'timeout' => (int) env('GOOGLE_CALENDAR_WRITE_TIMEOUT', 30),
    ],
];
