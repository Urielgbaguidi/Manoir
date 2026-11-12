<?php

namespace App\Services\Auth;

use Symfony\Component\HttpFoundation\Cookie;
use Symfony\Component\HttpFoundation\Response;

/**
 * Pose et efface les cookies d'authentification.
 *
 * HttpOnly : inaccessibles au JavaScript. Secure : HTTPS uniquement en
 * production. SameSite=Lax : non envoyes par les requetes intersites qui
 * modifient des donnees.
 */
class AuthCookies
{
    public function attach(Response $response, IssuedTokens $tokens): Response
    {
        $response->headers->setCookie($this->make(
            (string) config('jwt.cookies.access'),
            $tokens->accessToken,
            (int) config('jwt.access_ttl_minutes'),
            '/',
        ));

        $response->headers->setCookie($this->make(
            (string) config('jwt.cookies.refresh'),
            $tokens->refreshToken,
            (int) config('jwt.refresh_ttl_days') * 24 * 60,
            (string) config('jwt.cookies.refresh_path'),
        ));

        return $response;
    }

    public function forget(Response $response): Response
    {
        $response->headers->setCookie($this->make((string) config('jwt.cookies.access'), '', -2628000, '/'));
        $response->headers->setCookie($this->make(
            (string) config('jwt.cookies.refresh'),
            '',
            -2628000,
            (string) config('jwt.cookies.refresh_path'),
        ));

        return $response;
    }

    private function make(string $name, string $value, int $minutes, string $path): Cookie
    {
        return Cookie::create(
            name: $name,
            value: $value,
            expire: time() + $minutes * 60,
            path: $path,
            domain: config('jwt.cookies.domain') ?: null,
            secure: (bool) config('jwt.cookies.secure'),
            httpOnly: true,
            raw: true,
            sameSite: (string) config('jwt.cookies.same_site', Cookie::SAMESITE_LAX),
        );
    }
}
