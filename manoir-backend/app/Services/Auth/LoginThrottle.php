<?php

namespace App\Services\Auth;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Anti brute force sur les secrets saisis (mot de passe, code 2FA).
 *
 * Complete le rate limiting par minute : apres plusieurs echecs sur un meme
 * compte, il est bloque temporairement, quelle que soit l'IP de l'attaquant.
 * Le blocage s'allonge si les echecs continuent (15 min, puis 1 h).
 */
class LoginThrottle
{
    private const MAX_FAILURES_PER_ACCOUNT = 5;

    private const MAX_FAILURES_PER_IP = 20;

    private const LOCK_SECONDS = 15 * 60;

    private const EXTENDED_LOCK_SECONDS = 60 * 60;

    public function __construct(private readonly SecurityLogger $securityLogger) {}

    /**
     * Secondes restantes avant de pouvoir reessayer, ou 0 si autorise.
     */
    public function lockedFor(string $identifier, Request $request): int
    {
        foreach ([$this->accountKey($identifier), $this->ipKey($request), $this->extendedKey($identifier)] as $key) {
            $max = match (true) {
                str_starts_with($key, 'auth-fail-ip') => self::MAX_FAILURES_PER_IP,
                str_starts_with($key, 'auth-fail-long') => self::MAX_FAILURES_PER_ACCOUNT * 3,
                default => self::MAX_FAILURES_PER_ACCOUNT,
            };

            if (RateLimiter::tooManyAttempts($key, $max)) {
                return RateLimiter::availableIn($key);
            }
        }

        return 0;
    }

    public function recordFailure(string $identifier, Request $request): void
    {
        RateLimiter::hit($this->accountKey($identifier), self::LOCK_SECONDS);
        RateLimiter::hit($this->ipKey($request), self::LOCK_SECONDS);
        RateLimiter::hit($this->extendedKey($identifier), self::EXTENDED_LOCK_SECONDS);

        if (RateLimiter::attempts($this->accountKey($identifier)) === self::MAX_FAILURES_PER_ACCOUNT) {
            $this->securityLogger->warning('auth.account_temporarily_locked', ['email' => $identifier]);
        }
    }

    public function clear(string $identifier): void
    {
        RateLimiter::clear($this->accountKey($identifier));
        RateLimiter::clear($this->extendedKey($identifier));
    }

    private function accountKey(string $identifier): string
    {
        return 'auth-fail-account:'.sha1(strtolower(trim($identifier)));
    }

    private function extendedKey(string $identifier): string
    {
        return 'auth-fail-long:'.sha1(strtolower(trim($identifier)));
    }

    private function ipKey(Request $request): string
    {
        return 'auth-fail-ip:'.$request->ip();
    }
}
