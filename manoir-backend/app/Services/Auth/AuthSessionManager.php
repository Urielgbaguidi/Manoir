<?php

namespace App\Services\Auth;

use App\Models\AuthSession;
use App\Models\RefreshToken;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Cycle de vie des sessions : ouverture, rotation des refresh tokens,
 * detection de rejeu et revocation.
 */
class AuthSessionManager
{
    public function __construct(
        private readonly JwtService $jwt,
        private readonly SecurityLogger $securityLogger,
    ) {}

    public function start(User $user, Request $request): IssuedTokens
    {
        $session = AuthSession::create([
            'user_id' => $user->id,
            'device_name' => $this->deviceName($request),
            'ip_address' => $request->ip(),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 512),
            'last_used_at' => now(),
            // Une connexion fraiche vaut reauthentification.
            'reauthenticated_at' => now(),
            'expires_at' => now()->addDays((int) config('jwt.refresh_ttl_days')),
        ]);

        return $this->issue($session);
    }

    /**
     * Echange un refresh token contre une nouvelle paire de jetons.
     *
     * L'ancien refresh token est invalide (rotation). S'il est presente a
     * nouveau plus tard, c'est qu'il a ete copie : toute la session est
     * revoquee, l'attaquant comme l'utilisateur legitime doivent se reconnecter.
     *
     * @throws RefreshTokenException
     */
    public function rotate(string $plainRefreshToken, Request $request): IssuedTokens
    {
        if ($plainRefreshToken === '' || strlen($plainRefreshToken) > 200) {
            throw new RefreshTokenException(RefreshTokenException::INVALID);
        }

        $hash = RefreshToken::hash($plainRefreshToken);

        // La transaction renvoie soit les nouveaux jetons, soit la session a
        // revoquer : la revocation doit etre ecrite APRES le commit, sinon
        // l'exception qui suit l'annulerait avec le reste de la transaction.
        $outcome = DB::transaction(function () use ($hash, $request): IssuedTokens|AuthSession {
            $token = RefreshToken::where('token_hash', $hash)->lockForUpdate()->first();

            if (! $token) {
                throw new RefreshTokenException(RefreshTokenException::INVALID);
            }

            $session = AuthSession::whereKey($token->auth_session_id)->lockForUpdate()->first();

            if (! $session || ! $session->isActive()) {
                throw new RefreshTokenException(RefreshTokenException::REVOKED);
            }

            if ($token->used_at !== null) {
                $grace = (int) config('jwt.refresh_reuse_grace_seconds', 10);

                if ($token->used_at->greaterThan(now()->subSeconds($grace))) {
                    throw new RefreshTokenException(RefreshTokenException::CONCURRENT);
                }

                return $session;
            }

            if ($token->expires_at->isPast()) {
                throw new RefreshTokenException(RefreshTokenException::EXPIRED);
            }

            $token->forceFill(['used_at' => now()])->save();

            $session->forceFill([
                'last_used_at' => now(),
                'ip_address' => $request->ip(),
            ])->save();

            return $this->issue($session);
        });

        if ($outcome instanceof AuthSession) {
            $outcome->revoke('refresh_token_replay');
            $this->securityLogger->warning('auth.refresh_token_replay', [
                'user_id' => $outcome->user_id,
                'session_id' => $outcome->id,
            ]);

            throw new RefreshTokenException(RefreshTokenException::REPLAYED);
        }

        return $outcome;
    }

    public function revoke(AuthSession $session, string $reason): void
    {
        $session->revoke($reason);
        $this->securityLogger->info('auth.session_revoked', [
            'user_id' => $session->user_id,
            'session_id' => $session->id,
            'reason' => $reason,
        ]);
    }

    /**
     * Revoque toutes les sessions de l'utilisateur, sauf eventuellement la
     * session courante. Renvoie le nombre de sessions coupees.
     */
    public function revokeAll(User $user, string $reason, ?string $exceptSessionId = null): int
    {
        $count = AuthSession::where('user_id', $user->id)
            ->whereNull('revoked_at')
            ->when($exceptSessionId, fn ($query) => $query->whereKeyNot($exceptSessionId))
            ->update(['revoked_at' => now(), 'revoked_reason' => $reason]);

        if ($count > 0) {
            $this->securityLogger->info('auth.sessions_revoked', [
                'user_id' => $user->id,
                'count' => $count,
                'reason' => $reason,
            ]);
        }

        return $count;
    }

    /**
     * Retrouve la session d'un refresh token sans le consommer (deconnexion
     * alors que le jeton d'acces a deja expire).
     */
    public function sessionFromRefreshToken(string $plainRefreshToken): ?AuthSession
    {
        if ($plainRefreshToken === '') {
            return null;
        }

        return RefreshToken::where('token_hash', RefreshToken::hash($plainRefreshToken))
            ->first()
            ?->authSession;
    }

    /**
     * Jeton anti-CSRF lie a la session : HMAC de son identifiant. Rien a
     * stocker, et il change a chaque nouvelle session.
     */
    public function csrfTokenFor(AuthSession $session): string
    {
        return hash_hmac('sha256', 'csrf|'.$session->id, (string) config('jwt.secret'));
    }

    private function issue(AuthSession $session): IssuedTokens
    {
        $plainRefreshToken = Str::random(80);

        RefreshToken::create([
            'auth_session_id' => $session->id,
            'token_hash' => RefreshToken::hash($plainRefreshToken),
            // Le refresh token ne survit jamais a sa session.
            'expires_at' => $session->expires_at,
        ]);

        return new IssuedTokens(
            session: $session,
            accessToken: $this->jwt->issueAccessToken($session->user_id, $session->id),
            refreshToken: $plainRefreshToken,
            csrfToken: $this->csrfTokenFor($session),
        );
    }

    /**
     * Nom lisible de l'appareil, pour que l'utilisateur reconnaisse puis
     * revoque une session precise depuis son profil.
     */
    private function deviceName(Request $request): string
    {
        $agent = (string) $request->userAgent();

        $system = match (true) {
            str_contains($agent, 'Android') => 'Android',
            (bool) preg_match('/iPhone|iPad|iPod/', $agent) => 'iOS',
            str_contains($agent, 'Windows') => 'Windows',
            str_contains($agent, 'Macintosh') => 'macOS',
            str_contains($agent, 'Linux') => 'Linux',
            default => 'Appareil inconnu',
        };

        $browser = match (true) {
            str_contains($agent, 'Edg/') => 'Edge',
            str_contains($agent, 'OPR/') => 'Opera',
            str_contains($agent, 'Firefox/') => 'Firefox',
            str_contains($agent, 'Chrome/') => 'Chrome',
            str_contains($agent, 'Safari/') => 'Safari',
            default => null,
        };

        return $browser ? "{$browser} sur {$system}" : $system;
    }
}
