<?php

namespace App\Services\Payments;

/**
 * Moyen de paiement reellement utilise (operateur Mobile Money ou carte),
 * ramene a un code court et stable stocke dans `payments.channel`.
 *
 * FeexPay designe les reseaux par des libelles du type `mtn`, `moov tg`,
 * `celtiis bj`, `orange ci`... : seul l'operateur est conserve. Toute valeur
 * inconnue est ignoree (aucun texte libre n'est stocke).
 */
final class PaymentChannel
{
    /** @var array<string, string> prefixe FeexPay => code stocke */
    private const OPERATORS = [
        'mtn' => 'mtn',
        'moov' => 'moov',
        'celtiis' => 'celtiis',
        'orange' => 'orange',
        'wave' => 'wave',
        'togocom' => 'togocom',
        'yas' => 'togocom',
        'mixx' => 'togocom',
        'free' => 'free',
        'bmo' => 'bmo',
        'coris' => 'coris',
        'card' => 'card',
        'carte' => 'card',
        'visa' => 'card',
        'mastercard' => 'card',
    ];

    public static function normalize(mixed $raw): ?string
    {
        if (! is_string($raw)) {
            return null;
        }

        $value = strtolower(trim($raw));

        foreach (self::OPERATORS as $prefix => $code) {
            if (str_starts_with($value, $prefix)) {
                return $code;
            }
        }

        return null;
    }
}
