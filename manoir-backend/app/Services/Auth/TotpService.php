<?php

namespace App\Services\Auth;

/**
 * Codes a usage unique bases sur le temps (TOTP, RFC 6238), compatibles avec
 * Google Authenticator, Microsoft Authenticator, 1Password, etc.
 *
 * SHA-1, 6 chiffres, pas de 30 secondes : ce sont les parametres que toutes
 * les applications d'authentification acceptent par defaut.
 */
class TotpService
{
    private const PERIOD = 30;

    private const DIGITS = 6;

    /** Pas de temps acceptes de part et d'autre (derive d'horloge du telephone). */
    private const WINDOW = 1;

    private const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    public function generateSecret(): string
    {
        return $this->base32Encode(random_bytes(20));
    }

    public function provisioningUri(string $secret, string $accountName): string
    {
        $issuer = (string) config('app.name', 'Le Manoir');

        return 'otpauth://totp/'.rawurlencode($issuer.':'.$accountName)
            .'?secret='.$secret
            .'&issuer='.rawurlencode($issuer)
            .'&algorithm=SHA1&digits='.self::DIGITS.'&period='.self::PERIOD;
    }

    /**
     * Verifie un code et renvoie le pas de temps qui correspond, ou null.
     *
     * Le pas doit etre strictement superieur au dernier pas accepte : un code
     * intercepte ne peut pas etre rejoue dans sa fenetre de validite.
     */
    public function verify(string $secret, string $code, ?int $lastUsedStep = null, ?int $timestamp = null): ?int
    {
        if (! preg_match('/^\d{'.self::DIGITS.'}$/', $code)) {
            return null;
        }

        $key = $this->base32Decode($secret);
        $currentStep = intdiv($timestamp ?? time(), self::PERIOD);

        for ($offset = -self::WINDOW; $offset <= self::WINDOW; $offset++) {
            $step = $currentStep + $offset;

            if ($lastUsedStep !== null && $step <= $lastUsedStep) {
                continue;
            }

            if (hash_equals($this->codeAt($key, $step), $code)) {
                return $step;
            }
        }

        return null;
    }

    public function codeAt(string $binaryKey, int $step): string
    {
        $counter = pack('N*', 0, $step);
        $hash = hash_hmac('sha1', $counter, $binaryKey, true);
        $offset = ord($hash[19]) & 0x0F;

        $value = ((ord($hash[$offset]) & 0x7F) << 24)
            | ((ord($hash[$offset + 1]) & 0xFF) << 16)
            | ((ord($hash[$offset + 2]) & 0xFF) << 8)
            | (ord($hash[$offset + 3]) & 0xFF);

        return str_pad((string) ($value % (10 ** self::DIGITS)), self::DIGITS, '0', STR_PAD_LEFT);
    }

    /**
     * Codes de secours a usage unique, pour un telephone perdu.
     *
     * @return array<int, string>
     */
    public function generateRecoveryCodes(int $count = 8): array
    {
        return array_map(
            fn () => strtoupper(bin2hex(random_bytes(4)).'-'.bin2hex(random_bytes(4))),
            range(1, $count)
        );
    }

    public function base32Encode(string $binary): string
    {
        $bits = '';
        foreach (str_split($binary) as $char) {
            $bits .= str_pad(decbin(ord($char)), 8, '0', STR_PAD_LEFT);
        }

        $encoded = '';
        foreach (str_split($bits, 5) as $chunk) {
            $encoded .= self::BASE32_ALPHABET[bindec(str_pad($chunk, 5, '0'))];
        }

        return $encoded;
    }

    public function base32Decode(string $encoded): string
    {
        $encoded = strtoupper(rtrim($encoded, '='));
        $bits = '';

        foreach (str_split($encoded) as $char) {
            $position = strpos(self::BASE32_ALPHABET, $char);
            if ($position === false) {
                return '';
            }
            $bits .= str_pad(decbin($position), 5, '0', STR_PAD_LEFT);
        }

        $binary = '';
        foreach (str_split($bits, 8) as $byte) {
            if (strlen($byte) === 8) {
                $binary .= chr((int) bindec($byte));
            }
        }

        return $binary;
    }
}
