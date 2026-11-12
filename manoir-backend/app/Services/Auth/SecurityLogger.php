<?php

namespace App\Services\Auth;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Journal des evenements de securite (canal `security`).
 *
 * Ne journalise JAMAIS de jeton, de mot de passe, de code ni de secret : seuls
 * des identifiants et du contexte reseau. Les cles sensibles eventuellement
 * passees dans le contexte sont filtrees par precaution.
 */
class SecurityLogger
{
    /** @var array<int, string> */
    private const FORBIDDEN_KEYS = [
        'password', 'password_confirmation', 'current_password', 'token', 'access_token',
        'refresh_token', 'credential', 'code', 'secret', 'recovery_code', 'authorization',
    ];

    public function __construct(private readonly Request $request) {}

    /**
     * @param  array<string, mixed>  $context
     */
    public function info(string $event, array $context = []): void
    {
        Log::channel('security')->info($event, $this->context($context));
    }

    /**
     * @param  array<string, mixed>  $context
     */
    public function warning(string $event, array $context = []): void
    {
        Log::channel('security')->warning($event, $this->context($context));
    }

    /**
     * @param  array<string, mixed>  $context
     * @return array<string, mixed>
     */
    private function context(array $context): array
    {
        $safe = array_filter(
            $context,
            fn (string $key) => ! in_array(strtolower($key), self::FORBIDDEN_KEYS, true),
            ARRAY_FILTER_USE_KEY
        );

        if (isset($safe['email']) && is_string($safe['email'])) {
            $safe['email'] = $this->maskEmail($safe['email']);
        }

        return array_merge($safe, [
            'ip' => $this->request->ip(),
            'user_agent' => mb_substr((string) $this->request->userAgent(), 0, 200),
            'path' => $this->request->path(),
        ]);
    }

    /**
     * Une adresse tentee n'appartient pas forcement a un client : on n'en
     * garde que de quoi recouper une attaque, sans constituer de fichier.
     */
    private function maskEmail(string $email): string
    {
        [$local, $domain] = array_pad(explode('@', strtolower($email), 2), 2, '');

        return mb_substr($local, 0, 2).'***@'.$domain;
    }
}
