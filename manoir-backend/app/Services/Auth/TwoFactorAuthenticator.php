<?php

namespace App\Services\Auth;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

/**
 * Double authentification TOTP : activation, verification, codes de secours.
 */
class TwoFactorAuthenticator
{
    public function __construct(
        private readonly TotpService $totp,
        private readonly JwtService $jwt,
    ) {}

    /**
     * Reponse a une connexion par mot de passe (ou Google) reussie quand la
     * 2FA est active : aucun cookie de session, seulement un jeton
     * intermediaire de 5 minutes pour saisir le code.
     */
    public function challengeResponse(User $user): JsonResponse
    {
        return response()->json([
            'message' => 'Saisissez le code de votre application d\'authentification.',
            'two_factor_required' => true,
            'challenge_token' => $this->jwt->issueTwoFactorChallenge($user->id),
        ]);
    }

    /**
     * Prepare l'activation : genere un secret, non actif tant qu'un premier
     * code n'a pas ete confirme.
     *
     * @return array{secret: string, otpauth_url: string}
     */
    public function beginSetup(User $user): array
    {
        $secret = $this->totp->generateSecret();

        $user->forceFill([
            'two_factor_secret' => $secret,
            'two_factor_confirmed_at' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_last_used_step' => null,
        ])->save();

        return [
            'secret' => $secret,
            'otpauth_url' => $this->totp->provisioningUri($secret, $user->email),
        ];
    }

    /**
     * Active la 2FA si le code correspond. Renvoie les codes de secours (a
     * n'afficher qu'une fois), ou null si le code est faux.
     *
     * @return array<int, string>|null
     */
    public function confirmSetup(User $user, string $code): ?array
    {
        if (empty($user->two_factor_secret) || $user->two_factor_confirmed_at !== null) {
            return null;
        }

        $step = $this->totp->verify($user->two_factor_secret, $code);

        if ($step === null) {
            return null;
        }

        $codes = $this->totp->generateRecoveryCodes();

        $user->forceFill([
            'two_factor_confirmed_at' => now(),
            'two_factor_last_used_step' => $step,
            'two_factor_recovery_codes' => array_map(fn (string $c) => hash('sha256', $c), $codes),
        ])->save();

        return $codes;
    }

    public function disable(User $user): void
    {
        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_confirmed_at' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_last_used_step' => null,
        ])->save();
    }

    /**
     * @return array<int, string>
     */
    public function regenerateRecoveryCodes(User $user): array
    {
        $codes = $this->totp->generateRecoveryCodes();

        $user->forceFill([
            'two_factor_recovery_codes' => array_map(fn (string $c) => hash('sha256', $c), $codes),
        ])->save();

        return $codes;
    }

    /**
     * Verifie un code TOTP et le marque comme consomme (anti-rejeu).
     */
    public function verifyCode(User $user, string $code): bool
    {
        return DB::transaction(function () use ($user, $code) {
            $locked = User::whereKey($user->id)->lockForUpdate()->first();

            if (! $locked || ! $locked->hasTwoFactorEnabled()) {
                return false;
            }

            $step = $this->totp->verify($locked->two_factor_secret, $code, $locked->two_factor_last_used_step);

            if ($step === null) {
                return false;
            }

            $locked->forceFill(['two_factor_last_used_step' => $step])->save();

            return true;
        });
    }

    /**
     * Code de secours : utilisable une seule fois. Seules leurs empreintes
     * sont stockees (et chiffrees au repos).
     */
    public function consumeRecoveryCode(User $user, string $code): bool
    {
        return DB::transaction(function () use ($user, $code) {
            $locked = User::whereKey($user->id)->lockForUpdate()->first();
            $hashes = $locked?->two_factor_recovery_codes ?? [];
            $candidate = hash('sha256', strtoupper(trim($code)));

            foreach ($hashes as $index => $hash) {
                if (hash_equals($hash, $candidate)) {
                    unset($hashes[$index]);
                    $locked->forceFill(['two_factor_recovery_codes' => array_values($hashes)])->save();

                    return true;
                }
            }

            return false;
        });
    }
}
