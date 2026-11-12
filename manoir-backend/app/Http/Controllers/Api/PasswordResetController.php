<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\EmailOnlyRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Models\User;
use App\Services\Auth\AuthSessionManager;
use App\Services\Auth\SecurityLogger;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PasswordResetController extends Controller
{
    public function __construct(
        private readonly AuthSessionManager $sessions,
        private readonly SecurityLogger $securityLogger,
    ) {}

    /**
     * Envoie le mail contenant le lien de reinitialisation.
     *
     * Repond toujours le meme message, que l'adresse existe ou non, et meme
     * si un lien vient deja d'etre envoye : sinon l'endpoint permettrait de
     * savoir qui possede un compte (enumeration).
     */
    public function sendResetLink(EmailOnlyRequest $request): JsonResponse
    {
        $status = Password::sendResetLink($request->only('email'));

        if ($status === Password::RESET_LINK_SENT) {
            $this->securityLogger->info('auth.password_reset_requested', ['email' => $request->validated('email')]);
        }

        return response()->json([
            'message' => 'Si un compte existe avec cette adresse, un lien de reinitialisation vient d\'y etre envoye.',
        ]);
    }

    /**
     * Consomme le token et applique le nouveau mot de passe.
     */
    public function reset(ResetPasswordRequest $request): JsonResponse
    {
        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill([
                    'password' => Hash::make($password),
                    'remember_token' => Str::random(60),
                ])->save();

                // Un mot de passe change doit invalider toutes les sessions
                // ouvertes : c'est le scenario "on m'a vole mon compte".
                $this->sessions->revokeAll($user, 'password_reset');
                $this->securityLogger->info('auth.password_reset', ['user_id' => $user->id]);

                event(new PasswordReset($user));
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'email' => ['Ce lien de reinitialisation est invalide ou a expire. Demandez-en un nouveau.'],
            ]);
        }

        return response()->json([
            'message' => 'Mot de passe reinitialise. Vous pouvez maintenant vous connecter.',
        ]);
    }
}
