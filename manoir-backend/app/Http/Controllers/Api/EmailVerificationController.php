<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmailVerificationCode;
use Illuminate\Auth\Events\Verified;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class EmailVerificationController extends Controller
{
    /**
     * Verifie le code a 6 chiffres saisi par l'utilisateur connecte.
     */
    public function verifyCode(Request $request): JsonResponse
    {
        $request->validate([
            'code' => ['required', 'string', 'regex:/^\d{6}$/'],
        ], [
            'code.regex' => 'Le code doit contenir exactement 6 chiffres.',
        ]);

        $user = $request->user();

        if ($user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Votre adresse email est deja confirmee.',
                'verified' => true,
            ]);
        }

        $entree = $user->emailVerificationCode;

        if (! $entree) {
            return response()->json([
                'message' => 'Aucun code en cours. Demandez-en un nouveau.',
            ], 422);
        }

        if ($entree->estExpire()) {
            $entree->delete();

            return response()->json([
                'message' => 'Ce code a expire. Demandez-en un nouveau.',
            ], 422);
        }

        // Sans ce garde-fou, un code a 6 chiffres se devine par force brute.
        if ($entree->tropDeTentatives()) {
            $entree->delete();

            return response()->json([
                'message' => 'Trop de tentatives. Demandez un nouveau code.',
            ], 429);
        }

        if (! $entree->correspond($request->string('code')->toString())) {
            $entree->increment('attempts');
            $restantes = max(0, EmailVerificationCode::MAX_TENTATIVES - $entree->attempts);

            return response()->json([
                'message' => $restantes > 0
                    ? "Code incorrect. Il vous reste {$restantes} tentative(s)."
                    : 'Code incorrect. Demandez un nouveau code.',
                'attempts_left' => $restantes,
            ], 422);
        }

        $user->markEmailAsVerified();
        $entree->delete();
        event(new Verified($user));

        return response()->json([
            'message' => 'Adresse email confirmee.',
            'verified' => true,
        ]);
    }

    /**
     * Renvoie un nouveau code, ce qui invalide le precedent.
     */
    public function resend(Request $request): JsonResponse
    {
        $user = $request->user();

        if ($user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Votre adresse email est deja confirmee.',
            ], 422);
        }

        try {
            $user->sendEmailVerificationNotification();
        } catch (\Throwable $exception) {
            Log::warning('Envoi du code de verification impossible : '.$exception->getMessage());

            return response()->json([
                'message' => "L'envoi du mail a echoue. Reessayez dans quelques instants.",
            ], 503);
        }

        return response()->json([
            'message' => 'Un nouveau code vient de vous etre envoye.',
            'expires_in_minutes' => EmailVerificationCode::DUREE_MINUTES,
        ]);
    }

    /**
     * Etat de verification, pour que le frontend sache quoi afficher.
     */
    public function status(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'verified' => $user->hasVerifiedEmail(),
            'email' => $user->email,
            'code_pending' => (bool) $user->emailVerificationCode,
        ]);
    }
}
