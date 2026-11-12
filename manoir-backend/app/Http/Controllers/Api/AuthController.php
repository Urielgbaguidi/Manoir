<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\EmailOnlyRequest;
use App\Http\Requests\Auth\GoogleAuthRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Requests\Auth\TwoFactorChallengeRequest;
use App\Http\Requests\Auth\VerifyEmailCodeRequest;
use App\Models\EmailVerificationCode;
use App\Models\User;
use App\Notifications\AccountAlreadyExistsNotification;
use App\Services\Auth\AuthCookies;
use App\Services\Auth\AuthSessionManager;
use App\Services\Auth\GoogleIdTokenVerifier;
use App\Services\Auth\JwtRequestAuthenticator;
use App\Services\Auth\JwtService;
use App\Services\Auth\LoginThrottle;
use App\Services\Auth\RefreshTokenException;
use App\Services\Auth\SecurityLogger;
use App\Services\Auth\TwoFactorAuthenticator;
use Illuminate\Auth\Events\Registered;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

/**
 * Authentification : inscription, verification d'email, connexion (mot de
 * passe, Google, 2FA), renouvellement et deconnexion.
 *
 * Les jetons ne figurent jamais dans le corps des reponses : ils partent dans
 * des cookies HttpOnly. Le corps ne contient que l'utilisateur et le jeton
 * CSRF a renvoyer dans l'en-tete X-CSRF-Token.
 */
class AuthController extends Controller
{
    /** Message unique pour tout echec d'identification (pas d'enumeration). */
    private const INVALID_CREDENTIALS = 'Identifiants de connexion incorrects.';

    public function __construct(
        private readonly AuthSessionManager $sessions,
        private readonly AuthCookies $cookies,
        private readonly SecurityLogger $securityLogger,
        private readonly LoginThrottle $throttle,
    ) {}

    /**
     * Inscription classique. Ne connecte PAS : la session ne s'ouvre qu'une
     * fois l'adresse confirmee par le code recu.
     *
     * La reponse est identique que l'adresse soit libre ou deja utilisee ;
     * dans le second cas, c'est le proprietaire de l'adresse qui est prevenu
     * par mail.
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        $data = $request->validated();
        $existing = User::where('email', $data['email'])->first();

        if ($existing) {
            $this->safely(fn () => $existing->notify(new AccountAlreadyExistsNotification));
            $this->securityLogger->info('auth.register_existing_email', ['email' => $data['email']]);
        } else {
            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'phone' => $data['phone'],
                'country' => $data['country'],
                'password' => Hash::make($data['password']),
            ]);

            // Pas d'evenement Registered ici : son listener Laravel enverrait
            // un second code qui invaliderait le premier.
            $this->safely(fn () => $user->sendEmailVerificationNotification());
            $this->securityLogger->info('auth.registered', ['user_id' => $user->id]);
        }

        return response()->json([
            'message' => 'Si cette adresse peut etre utilisee, un code de confirmation a 6 chiffres vient d\'y etre envoye.',
            'email' => $data['email'],
            'verification_required' => true,
        ], 202);
    }

    /**
     * Confirme l'adresse avec le code recu, puis ouvre la session.
     */
    public function verifyEmail(VerifyEmailCodeRequest $request): JsonResponse
    {
        $user = User::where('email', $request->validated('email'))->first();
        $entry = $user?->emailVerificationCode;
        $generic = 'Code invalide ou expire. Verifiez-le ou demandez-en un nouveau.';

        if (! $user || $user->hasVerifiedEmail() || ! $entry) {
            return response()->json(['message' => $generic], 422);
        }

        if ($entry->estExpire() || $entry->tropDeTentatives()) {
            $entry->delete();

            return response()->json(['message' => $generic], 422);
        }

        if (! $entry->correspond($request->validated('code'))) {
            $entry->increment('attempts');
            $this->securityLogger->warning('auth.email_code_failed', ['user_id' => $user->id]);

            return response()->json([
                'message' => $generic,
                'attempts_left' => max(0, EmailVerificationCode::MAX_TENTATIVES - $entry->attempts),
            ], 422);
        }

        $user->markEmailAsVerified();
        $entry->delete();
        event(new Verified($user));
        $this->securityLogger->info('auth.email_verified', ['user_id' => $user->id]);

        return $this->openSession($user->fresh(), $request, 'Adresse email confirmee. Bienvenue !');
    }

    /**
     * Renvoie un code. Reponse identique dans tous les cas.
     */
    public function resendVerification(EmailOnlyRequest $request): JsonResponse
    {
        $user = User::where('email', $request->validated('email'))->first();

        if ($user && ! $user->hasVerifiedEmail()) {
            $this->safely(fn () => $user->sendEmailVerificationNotification());
        }

        return response()->json([
            'message' => 'Si un compte en attente de confirmation existe pour cette adresse, un nouveau code vient d\'y etre envoye.',
            'expires_in_minutes' => EmailVerificationCode::DUREE_MINUTES,
        ]);
    }

    public function login(LoginRequest $request, TwoFactorAuthenticator $twoFactor): JsonResponse
    {
        $email = $request->validated('email');

        if ($retryAfter = $this->throttle->lockedFor($email, $request)) {
            return $this->tooManyAttempts($retryAfter);
        }

        $user = User::where('email', $email)->first();

        // Un hachage est calcule meme sans compte : le temps de reponse ne
        // trahit pas l'existence de l'adresse.
        $passwordHash = $user?->getAuthPassword() ?: '$2y$12$'.str_repeat('a', 53);
        $passwordMatches = Hash::check($request->validated('password'), $passwordHash);

        if (! $user || ! $user->getAuthPassword() || ! $passwordMatches) {
            $this->throttle->recordFailure($email, $request);
            $this->securityLogger->warning('auth.login_failed', ['email' => $email]);

            return response()->json(['message' => self::INVALID_CREDENTIALS], 401);
        }

        $this->throttle->clear($email);

        // Le mot de passe est juste : on peut dire que l'adresse reste a
        // confirmer sans rien reveler a un tiers.
        if (! $user->hasVerifiedEmail()) {
            $this->safely(fn () => $user->sendEmailVerificationNotification());

            return response()->json([
                'message' => 'Confirmez votre adresse email : un nouveau code vient de vous etre envoye.',
                'reason' => 'email_not_verified',
                'email' => $user->email,
            ], 403);
        }

        if ($user->hasTwoFactorEnabled()) {
            return $twoFactor->challengeResponse($user);
        }

        $this->securityLogger->info('auth.login_succeeded', ['user_id' => $user->id, 'method' => 'password']);

        return $this->openSession($user, $request, 'Connexion reussie.');
    }

    public function twoFactorChallenge(
        TwoFactorChallengeRequest $request,
        JwtService $jwt,
        TwoFactorAuthenticator $twoFactor,
    ): JsonResponse {
        $claims = $jwt->decode($request->validated('challenge_token'), JwtService::TYPE_TWO_FACTOR);
        $user = $claims ? User::find((int) $claims['sub']) : null;

        if (! $user || ! $user->hasTwoFactorEnabled()) {
            return response()->json(['message' => 'Session de connexion expiree. Recommencez.'], 401);
        }

        $throttleKey = '2fa:'.$user->id;

        if ($retryAfter = $this->throttle->lockedFor($throttleKey, $request)) {
            return $this->tooManyAttempts($retryAfter);
        }

        $valid = $request->filled('recovery_code')
            ? $twoFactor->consumeRecoveryCode($user, (string) $request->validated('recovery_code'))
            : $twoFactor->verifyCode($user, (string) $request->validated('code'));

        if (! $valid) {
            $this->throttle->recordFailure($throttleKey, $request);
            $this->securityLogger->warning('auth.two_factor_failed', ['user_id' => $user->id]);

            return response()->json(['message' => 'Code de verification incorrect.'], 422);
        }

        $this->throttle->clear($throttleKey);
        $this->securityLogger->info('auth.login_succeeded', ['user_id' => $user->id, 'method' => 'two_factor']);

        return $this->openSession($user, $request, 'Connexion reussie.');
    }

    /**
     * Connexion ou inscription avec Google.
     *
     * Google a deja verifie l'adresse : pas de code a saisir. En revanche, le
     * telephone n'est pas fourni : tant qu'il manque, l'acces a l'espace
     * client reste bloque (voir EnsureProfileIsComplete).
     */
    public function google(
        GoogleAuthRequest $request,
        GoogleIdTokenVerifier $verifier,
        TwoFactorAuthenticator $twoFactor,
    ): JsonResponse {
        $identity = $verifier->verify($request->validated('credential'));

        if (! $identity) {
            $this->securityLogger->warning('auth.google_token_rejected');

            return response()->json(['message' => 'Connexion Google impossible. Reessayez.'], 401);
        }

        $user = User::where('google_id', $identity['sub'])->first()
            ?? User::where('email', $identity['email'])->first();

        if ($user) {
            $updates = ['google_id' => $identity['sub']];

            // Compte cree par formulaire mais jamais confirme : quelqu'un a pu
            // l'ouvrir avec l'adresse d'autrui. Google prouve que la personne
            // presente possede l'adresse ; le mot de passe pose par un tiers
            // est donc efface (pre-detournement de compte).
            if (! $user->hasVerifiedEmail()) {
                $updates['email_verified_at'] = now();
                $updates['password'] = null;
                $this->securityLogger->warning('auth.google_claimed_unverified_account', ['user_id' => $user->id]);
            }

            $user->forceFill($updates)->save();
        } else {
            $user = User::create([
                'name' => $identity['name'] ?: strstr($identity['email'], '@', true),
                'email' => $identity['email'],
            ]);
            $user->forceFill([
                'google_id' => $identity['sub'],
                'email_verified_at' => now(),
            ])->save();

            event(new Registered($user));
            $this->securityLogger->info('auth.registered', ['user_id' => $user->id, 'method' => 'google']);
        }

        if ($user->hasTwoFactorEnabled()) {
            return $twoFactor->challengeResponse($user);
        }

        $this->securityLogger->info('auth.login_succeeded', ['user_id' => $user->id, 'method' => 'google']);

        return $this->openSession($user->fresh(), $request, 'Connexion reussie.');
    }

    /**
     * Renouvelle le jeton d'acces a partir du refresh token (cookie).
     */
    public function refresh(Request $request): JsonResponse
    {
        $plain = (string) $request->cookie((string) config('jwt.cookies.refresh'), '');

        // Visiteur sans aucune session : rien a renouveler, ce n'est pas une
        // erreur (evite un 401 a chaque visite anonyme).
        if ($plain === '') {
            return response()->json(['user' => null, 'csrf_token' => null]);
        }

        try {
            $tokens = $this->sessions->rotate($plain, $request);
        } catch (RefreshTokenException $exception) {
            if ($exception->reason === RefreshTokenException::CONCURRENT) {
                // Un autre onglet vient de renouveler : ses cookies sont deja
                // en place, il suffit de rejouer la requete.
                return response()->json([
                    'message' => 'Session deja renouvelee.',
                    'reason' => 'refresh_in_progress',
                ], 409);
            }

            if ($exception->reason !== RefreshTokenException::INVALID || $plain !== '') {
                $this->securityLogger->info('auth.refresh_failed', ['reason' => $exception->reason]);
            }

            return $this->cookies->forget(
                response()->json(['message' => $exception->getMessage()], 401)
            );
        }

        $user = $tokens->session->user()->first();

        return $this->cookies->attach(response()->json([
            'user' => $user,
            'csrf_token' => $tokens->csrfToken,
        ]), $tokens);
    }

    /**
     * Deconnexion : revoque la session de cet appareil et efface les cookies.
     * Fonctionne meme si le jeton d'acces a deja expire (via le refresh token).
     */
    public function logout(Request $request): JsonResponse
    {
        // Route hors middleware d'authentification : on resout le guard ici,
        // ce qui renseigne la session courante si le jeton d'acces est valide.
        auth('api')->user();

        $session = JwtRequestAuthenticator::currentSession($request)
            ?? $this->sessions->sessionFromRefreshToken((string) $request->cookie((string) config('jwt.cookies.refresh'), ''));

        if ($session && $session->isActive()) {
            $this->sessions->revoke($session, 'logout');
        }

        return $this->cookies->forget(response()->json(['message' => 'Deconnexion reussie.']));
    }

    /**
     * Etat de la session courante : utilisateur et jeton CSRF. Appele au
     * chargement de l'application.
     */
    public function session(Request $request): JsonResponse
    {
        // Route publique : un visiteur non connecte recoit `user: null`
        // plutot qu'un 401.
        auth('api')->user();
        $session = JwtRequestAuthenticator::currentSession($request);

        return response()->json([
            'user' => $request->user(),
            'csrf_token' => $session ? $this->sessions->csrfTokenFor($session) : null,
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($request->user());
    }

    private function openSession(User $user, Request $request, string $message): JsonResponse
    {
        $tokens = $this->sessions->start($user, $request);

        return $this->cookies->attach(response()->json([
            'message' => $message,
            'user' => $user,
            'csrf_token' => $tokens->csrfToken,
        ]), $tokens);
    }

    private function tooManyAttempts(int $retryAfter): JsonResponse
    {
        $minutes = max(1, (int) ceil($retryAfter / 60));

        return response()->json([
            'message' => "Trop de tentatives. Reessayez dans {$minutes} minute(s).",
            'retry_after' => $retryAfter,
        ], 429, ['Retry-After' => (string) $retryAfter]);
    }

    /**
     * Un mail qui ne part pas ne doit jamais faire echouer l'operation.
     */
    private function safely(callable $send): void
    {
        try {
            $send();
        } catch (\Throwable $exception) {
            Log::warning('Envoi de mail impossible : '.$exception->getMessage());
        }
    }
}
