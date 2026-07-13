<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AdminUserController extends Controller
{
    public function index(): JsonResponse
    {
        $users = User::orderByDesc('created_at')->get();

        return response()->json($users);
    }

    public function toggleAdmin(string $id): JsonResponse
    {
        $user = User::findOrFail($id);

        if ($user->id === Auth::id()) {
            return response()->json([
                'message' => 'Vous ne pouvez pas modifier votre propre statut administrateur.',
            ], 422);
        }

        $user->is_admin = ! $user->is_admin;
        $user->save();

        return response()->json([
            'message' => 'Statut utilisateur mis à jour avec succès.',
            'user' => $user,
        ]);
    }

    public function update(string $id, Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|min:2|max:255',
        ]);

        $user = User::findOrFail($id);
        $user->update([
            'name' => trim($data['name']),
        ]);

        return response()->json([
            'message' => 'Nom utilisateur mis a jour avec succes.',
            'user' => $user->fresh(),
        ]);
    }

    public function destroy(string $id): JsonResponse
    {
        $user = User::findOrFail($id);

        if ($user->id === Auth::id()) {
            return response()->json([
                'message' => 'Vous ne pouvez pas supprimer votre propre compte.',
            ], 422);
        }

        $user->delete();

        return response()->json([
            'message' => 'Compte utilisateur supprimé avec succès.',
        ]);
    }
}
