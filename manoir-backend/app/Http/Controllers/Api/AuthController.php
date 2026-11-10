<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'phone' => 'required|string|max:30',
            'country' => 'required|string|size:2|alpha:ascii',
            'password' => 'required|string|min:8',
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'phone' => $request->phone,
            'country' => strtoupper($request->country),
            'password' => Hash::make($request->password),
            'is_admin' => false,
        ]);

        $token = $user->createToken(
            $this->deviceName($request),
            ['*'],
            now()->addDays(30)
        )->plainTextToken;

        // Un mail qui ne part pas ne doit jamais faire echouer l'inscription :
        // le compte est cree, l'utilisateur pourra redemander le lien.
        try {
            $user->sendEmailVerificationNotification();
        } catch (\Throwable $exception) {
            Log::warning('Envoi du mail de verification impossible : '.$exception->getMessage());
        }

        return response()->json([
            'message' => 'Inscription réussie.',
            'token' => $token,
            'user' => $user,
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|string|email',
            'password' => 'required|string',
        ]);

        if (! Auth::attempt($request->only('email', 'password'))) {
            return response()->json([
                'message' => 'Identifiants de connexion incorrects.',
            ], 401);
        }

        $user = User::where('email', $request->email)->firstOrFail();

        // Un token par appareil : se connecter ailleurs ne déconnecte plus les autres sessions.
        $token = $user->createToken(
            $this->deviceName($request),
            ['*'],
            now()->addDays(30)
        )->plainTextToken;

        return response()->json([
            'message' => 'Connexion réussie.',
            'token' => $token,
            'user' => $user,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        // Ne révoque que le token de l'appareil courant, pas les autres sessions.
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Déconnexion réussie.',
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($request->user());
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|min:2|max:255',
        ]);

        $user = $request->user();
        $user->update([
            'name' => trim($data['name']),
        ]);

        return response()->json([
            'message' => 'Profil mis a jour avec succes.',
            'user' => $user->fresh(),
        ]);
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'current_password' => 'required|string',
            'password' => 'required|string|min:8|confirmed|different:current_password',
        ], [
            'password.confirmed' => 'Les deux nouveaux mots de passe ne correspondent pas.',
            'password.different' => 'Le nouveau mot de passe doit etre different de l ancien.',
        ]);

        $user = $request->user();

        if (! Hash::check($data['current_password'], $user->password)) {
            return response()->json([
                'message' => 'L ancien mot de passe est incorrect.',
                'errors' => [
                    'current_password' => ['L ancien mot de passe est incorrect.'],
                ],
            ], 422);
        }

        $user->update([
            'password' => Hash::make($data['password']),
        ]);

        return response()->json([
            'message' => 'Mot de passe modifie avec succes.',
        ]);
    }

    /**
     * Nomme le token d'après l'appareil, pour que l'utilisateur puisse
     * identifier puis révoquer une session précise depuis son profil.
     */
    private function deviceName(Request $request): string
    {
        $agent = (string) $request->userAgent();

        return match (true) {
            str_contains($agent, 'Android') => 'Android',
            (bool) preg_match('/iPhone|iPad|iPod/', $agent) => 'iOS',
            str_contains($agent, 'Windows') => 'Windows',
            str_contains($agent, 'Macintosh') => 'macOS',
            str_contains($agent, 'Linux') => 'Linux',
            default => 'Appareil inconnu',
        };
    }
}
