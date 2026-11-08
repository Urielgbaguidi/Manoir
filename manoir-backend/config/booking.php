<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Acompte de reservation
    |--------------------------------------------------------------------------
    |
    | Part du sejour versee a l'avance pour bloquer la reservation. Elle se
    | DEDUIT du prix du sejour : le client verse l'acompte, puis le solde.
    | acompte + solde = prix total du sejour.
    |
    | Remplace l'ancienne « caution » calculee sur le nombre de jours separant
    | la demande de l'arrivee, qui produisait des montants sans rapport avec le
    | sejour (11,5 millions de caution pour 60 000 F de sejour).
    |
    */

    'deposit_rate' => (float) env('BOOKING_DEPOSIT_RATE', 0.30),

    /*
    |--------------------------------------------------------------------------
    | Duree maximale d'un sejour
    |--------------------------------------------------------------------------
    */

    'max_nights' => (int) env('BOOKING_MAX_NIGHTS', 90),

    /*
    |--------------------------------------------------------------------------
    | Duree de blocage apres reservation
    |--------------------------------------------------------------------------
    |
    | Reserver retient l'appartement pendant ce delai, le temps que le client
    | regle son acompte. Passe l'echeance sans paiement, la reservation expire
    | et le logement repart a la location.
    |
    | Ce blocage remplace la validation par l'administration : le client n'a
    | plus a attendre une reponse, il paie et sa reservation est ferme.
    |
    */

    'hold_hours' => (int) env('BOOKING_HOLD_HOURS', 12),
];
