<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PasswordResetController extends Controller
{
    /**
     * Envoie le mail contenant le lien de reinitialisation.
     *
     * Repond toujours le meme message, que l'adresse existe ou non : sinon
     * l'endpoint permettrait de savoir qui possede un compte (enumeration).
     */
    public function sendResetLink(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|string|email',
        ]);

        $status = Password::sendResetLink($request->only('email'));

        if ($status === Password::RESET_THROTTLED) {
            return response()->json([
                'message' => 'Un lien vient deja de vous etre envoye. Patientez quelques minutes avant de reessayer.',
            ], 429);
        }

        return response()->json([
            'message' => 'Si un compte existe avec cette adresse, un lien de reinitialisation vient d\'y etre envoye.',
        ]);
    }

    /**
     * Consomme le token et applique le nouveau mot de passe.
     */
    public function reset(Request $request): JsonResponse
    {
        $request->validate([
            'token' => 'required|string',
            'email' => 'required|string|email',
            'password' => 'required|string|min:8|confirmed',
        ], [
            'password.confirmed' => 'Les deux mots de passe ne correspondent pas.',
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill([
                    'password' => Hash::make($password),
                    'remember_token' => Str::random(60),
                ])->save();

                // Un mot de passe change doit invalider toutes les sessions
                // ouvertes : c'est le scenario "on m'a vole mon compte".
                $user->tokens()->delete();

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
