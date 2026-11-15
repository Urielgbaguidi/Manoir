<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\CompletePhoneRequest;
use App\Http\Requests\Auth\ReauthenticateRequest;
use App\Http\Requests\Auth\UpdatePasswordRequest;
use App\Models\AuthSession;
use App\Services\Auth\AuthSessionManager;
use App\Services\Auth\GoogleIdTokenVerifier;
use App\Services\Auth\JwtRequestAuthenticator;
use App\Services\Auth\LoginThrottle;
use App\Services\Auth\SecurityLogger;
use App\Services\Auth\TwoFactorAuthenticator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * Profil et securite du compte connecte.
 */
class AccountSecurityController extends Controller
{
    public function __construct(
        private readonly AuthSessionManager $sessions,
        private readonly SecurityLogger $securityLogger,
    ) {}

    /**
     * Numero de telephone obligatoire (comptes Google) : finalise l'inscription.
     */
    public function completePhone(CompletePhoneRequest $request): JsonResponse
    {
        $user = $request->user();

        $user->forceFill([
            'phone' => $request->validated('phone'),
            'country' => $request->validated('country'),
        ])->save();

        $this->securityLogger->info('account.phone_updated', ['user_id' => $user->id]);

        return response()->json([
            'message' => 'Numero enregistre. Votre inscription est finalisee.',
            'user' => $user->fresh(),
        ]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'min:2', 'max:255'],
        ]);

        $user = $request->user();
        $user->update(['name' => preg_replace('/\s+/', ' ', trim($data['name']))]);

        return response()->json([
            'message' => 'Profil mis a jour avec succes.',
            'user' => $user->fresh(),
        ]);
    }

    /**
     * Confirme l'identite avant une action sensible (fenetre de 10 minutes).
     */
    public function reauthenticate(
        ReauthenticateRequest $request,
        LoginThrottle $throttle,
        GoogleIdTokenVerifier $google,
        TwoFactorAuthenticator $twoFactor,
    ): JsonResponse {
        $user = $request->user();
        $session = JwtRequestAuthenticator::currentSession($request);
        $throttleKey = 'reauth:'.$user->id;

        if (! $session) {
            return response()->json(['message' => 'Session introuvable.'], 401);
        }

        if ($retryAfter = $throttle->lockedFor($throttleKey, $request)) {
            return response()->json(['message' => 'Trop de tentatives. Reessayez plus tard.'], 429, ['Retry-After' => (string) $retryAfter]);
        }

        $confirmed = match (true) {
            $request->filled('password') => filled($user->getAuthPassword())
                && Hash::check((string) $request->validated('password'), $user->getAuthPassword()),
            $request->filled('code') => $twoFactor->verifyCode($user, (string) $request->validated('code')),
            $request->filled('credential') => ($identity = $google->verify((string) $request->validated('credential')))
                && $identity['sub'] === $user->google_id,
            default => false,
        };

        if (! $confirmed) {
            $throttle->recordFailure($throttleKey, $request);
            $this->securityLogger->warning('auth.reauthentication_failed', ['user_id' => $user->id]);

            return response()->json(['message' => 'Verification echouee.'], 422);
        }

        $throttle->clear($throttleKey);
        $session->forceFill(['reauthenticated_at' => now()])->save();
        $this->securityLogger->info('auth.reauthenticated', ['user_id' => $user->id]);

        return response()->json([
            'message' => 'Identite confirmee.',
            'valid_for_minutes' => (int) config('jwt.reauth_ttl_minutes'),
        ]);
    }

    /**
     * Changement de mot de passe : toutes les autres sessions sont coupees.
     */
    public function updatePassword(UpdatePasswordRequest $request): JsonResponse
    {
        $user = $request->user();

        if (filled($user->getAuthPassword())
            && ! Hash::check((string) $request->validated('current_password'), $user->getAuthPassword())) {
            return response()->json([
                'message' => 'L ancien mot de passe est incorrect.',
                'errors' => ['current_password' => ['L ancien mot de passe est incorrect.']],
            ], 422);
        }

        $user->forceFill(['password' => Hash::make($request->validated('password'))])->save();

        $current = JwtRequestAuthenticator::currentSession($request);
        $this->sessions->revokeAll($user, 'password_changed', $current?->id);
        $this->securityLogger->info('account.password_changed', ['user_id' => $user->id]);

        return response()->json([
            'message' => 'Mot de passe modifie. Vos autres appareils ont ete deconnectes.',
            'user' => $user->fresh(),
        ]);
    }

    /**
     * Sessions actives de l'utilisateur, par appareil.
     */
    public function listSessions(Request $request): JsonResponse
    {
        $currentId = JwtRequestAuthenticator::currentSession($request)?->id;

        $sessions = AuthSession::active()
            ->where('user_id', $request->user()->id)
            ->orderByDesc('last_used_at')
            ->get()
            ->map(fn (AuthSession $session) => [
                'id' => $session->id,
                'device_name' => $session->device_name,
                'ip_address' => $session->ip_address,
                'last_used_at' => $session->last_used_at?->toIso8601String(),
                'created_at' => $session->created_at?->toIso8601String(),
                'current' => $session->id === $currentId,
            ]);

        return response()->json(['sessions' => $sessions]);
    }

    public function revokeSession(Request $request, string $sessionId): JsonResponse
    {
        $session = AuthSession::where('user_id', $request->user()->id)->findOrFail($sessionId);

        $this->sessions->revoke($session, 'revoked_by_user');

        return response()->json(['message' => 'Appareil deconnecte.']);
    }

    public function revokeOtherSessions(Request $request): JsonResponse
    {
        $count = $this->sessions->revokeAll(
            $request->user(),
            'revoked_by_user',
            JwtRequestAuthenticator::currentSession($request)?->id
        );

        return response()->json([
            'message' => $count > 0 ? "{$count} appareil(s) deconnecte(s)." : 'Aucun autre appareil connecte.',
            'revoked' => $count,
        ]);
    }

    public function beginTwoFactorSetup(Request $request, TwoFactorAuthenticator $twoFactor): JsonResponse
    {
        $user = $request->user();

        if ($user->hasTwoFactorEnabled()) {
            return response()->json(['message' => 'La double authentification est deja active.'], 422);
        }

        return response()->json($twoFactor->beginSetup($user));
    }

    public function confirmTwoFactorSetup(Request $request, TwoFactorAuthenticator $twoFactor): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'string', 'regex:/^\d{6}$/']]);
        $user = $request->user();

        $recoveryCodes = $twoFactor->confirmSetup($user, $data['code']);

        if ($recoveryCodes === null) {
            return response()->json(['message' => 'Code incorrect. Verifiez l\'heure de votre telephone et reessayez.'], 422);
        }

        $this->securityLogger->info('account.two_factor_enabled', ['user_id' => $user->id]);

        return response()->json([
            'message' => 'Double authentification activee. Conservez ces codes de secours en lieu sur.',
            'recovery_codes' => $recoveryCodes,
            'user' => $user->fresh(),
        ]);
    }

    public function disableTwoFactor(Request $request, TwoFactorAuthenticator $twoFactor): JsonResponse
    {
        $user = $request->user();
        $twoFactor->disable($user);
        $this->securityLogger->warning('account.two_factor_disabled', ['user_id' => $user->id]);

        return response()->json([
            'message' => 'Double authentification desactivee.',
            'user' => $user->fresh(),
        ]);
    }

    public function regenerateRecoveryCodes(Request $request, TwoFactorAuthenticator $twoFactor): JsonResponse
    {
        $user = $request->user();

        if (! $user->hasTwoFactorEnabled()) {
            return response()->json(['message' => 'La double authentification n\'est pas active.'], 422);
        }

        $this->securityLogger->info('account.recovery_codes_regenerated', ['user_id' => $user->id]);

        return response()->json(['recovery_codes' => $twoFactor->regenerateRecoveryCodes($user)]);
    }
}
