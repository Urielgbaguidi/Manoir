<?php

/**
 * Messages de validation en francais.
 *
 * APP_LOCALE=fr ne suffit pas : sans ce fichier, Laravel retombe sur l'anglais
 * et affiche « The email has already been taken. » a des clients francophones.
 *
 * Seules les regles reellement utilisees par l'application sont traduites.
 */
return [
    'accepted' => 'Le champ :attribute doit etre accepte.',
    'after' => 'Le champ :attribute doit etre une date posterieure au :date.',
    'after_or_equal' => 'Le champ :attribute doit etre une date posterieure ou egale au :date.',
    'before' => 'Le champ :attribute doit etre une date anterieure au :date.',
    'between' => [
        'numeric' => 'Le champ :attribute doit etre compris entre :min et :max.',
        'string' => 'Le champ :attribute doit contenir entre :min et :max caracteres.',
    ],
    'confirmed' => 'La confirmation du champ :attribute ne correspond pas.',
    'date' => 'Le champ :attribute doit etre une date valide.',
    'different' => 'Les champs :attribute et :other doivent etre differents.',
    'email' => 'Le champ :attribute doit etre une adresse email valide.',
    'exists' => 'Le champ :attribute selectionne est invalide.',
    'file' => 'Le champ :attribute doit etre un fichier.',
    'image' => 'Le champ :attribute doit etre une image.',
    'in' => 'Le champ :attribute selectionne est invalide.',
    'integer' => 'Le champ :attribute doit etre un nombre entier.',
    'max' => [
        'file' => 'Le fichier :attribute ne peut pas depasser :max kilo-octets.',
        'numeric' => 'Le champ :attribute ne peut pas etre superieur a :max.',
        'string' => 'Le champ :attribute ne peut pas depasser :max caracteres.',
    ],
    'mimes' => 'Le champ :attribute doit etre un fichier de type : :values.',
    'min' => [
        'file' => 'Le fichier :attribute doit faire au moins :min kilo-octets.',
        'numeric' => 'Le champ :attribute doit etre au moins :min.',
        'string' => 'Le champ :attribute doit contenir au moins :min caracteres.',
    ],
    'numeric' => 'Le champ :attribute doit etre un nombre.',
    'regex' => 'Le format du champ :attribute est invalide.',
    'required' => 'Le champ :attribute est obligatoire.',
    'required_if' => 'Le champ :attribute est obligatoire quand :other vaut :value.',
    'string' => 'Le champ :attribute doit etre une chaine de caracteres.',
    'unique' => 'Cette valeur de :attribute est deja utilisee.',
    'url' => 'Le champ :attribute doit etre une URL valide.',

    /*
    |--------------------------------------------------------------------------
    | Messages sur mesure
    |--------------------------------------------------------------------------
    |
    | Un message generique laisse le client sans solution. Ceux-ci lui disent
    | quoi faire.
    |
    */

    'custom' => [
        'email' => [
            'unique' => 'Un compte existe deja avec cette adresse email. Connectez-vous ou utilisez « Mot de passe oublie ».',
            'email' => 'Cette adresse email n\'est pas valide.',
        ],
        'password' => [
            'min' => 'Le mot de passe doit contenir au moins :min caracteres.',
            'confirmed' => 'Les deux mots de passe ne correspondent pas.',
        ],
        'check_in' => [
            'after_or_equal' => 'La date d\'arrivee ne peut pas etre dans le passe.',
        ],
        'check_out' => [
            'after' => 'La date de depart doit etre posterieure a la date d\'arrivee.',
        ],
        'phone' => [
            'required' => 'Le numero de telephone est obligatoire.',
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Noms lisibles des champs
    |--------------------------------------------------------------------------
    */

    'attributes' => [
        'name' => 'nom',
        'email' => 'email',
        'phone' => 'telephone',
        'password' => 'mot de passe',
        'current_password' => 'mot de passe actuel',
        'password_confirmation' => 'confirmation du mot de passe',
        'check_in' => 'date d\'arrivee',
        'check_out' => 'date de depart',
        'guests' => 'nombre de voyageurs',
        'special_requests' => 'demandes speciales',
        'code' => 'code',
        'category_type' => 'categorie',
        'room_id' => 'appartement',
        'payment_method' => 'moyen de paiement',
        'phone_number' => 'numero de telephone',
        'admin_notes' => 'notes',
        'new_check_out' => 'nouvelle date de depart',
    ],
];
