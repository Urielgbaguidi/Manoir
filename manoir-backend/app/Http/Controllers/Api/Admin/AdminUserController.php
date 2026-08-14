<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminUserController extends Controller
{
    public function index(): JsonResponse
    {
        $users = User::orderByDesc('created_at')->get();

        return response()->json($users);
    }

    public function toggleAdmin(string $id, Request $request): JsonResponse
    {
        $user = User::findOrFail($id);

        if (! $request->user()->is_super_admin) {
            return response()->json([
                'message' => 'Seul le super administrateur peut nommer ou déclasser un administrateur.',
            ], 403);
        }

        if ($user->is_super_admin) {
            return response()->json([
                'message' => 'Le super administrateur ne peut pas être déclassé.',
            ], 403);
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

        if ($user->is_admin && ! $request->user()->is_super_admin) {
            return response()->json([
                'message' => 'Un administrateur ne peut pas modifier un autre administrateur.',
            ], 403);
        }

        $user->update([
            'name' => trim($data['name']),
        ]);

        return response()->json([
            'message' => 'Nom utilisateur mis a jour avec succes.',
            'user' => $user->fresh(),
        ]);
    }

    public function destroy(string $id, Request $request): JsonResponse
    {
        $user = User::findOrFail($id);

        if ($user->is_super_admin) {
            return response()->json([
                'message' => 'Le compte du super administrateur ne peut pas être supprimé.',
            ], 403);
        }

        if ($user->id === $request->user()->id) {
            return response()->json([
                'message' => 'Vous ne pouvez pas supprimer votre propre compte.',
            ], 422);
        }

        if ($user->is_admin && ! $request->user()->is_super_admin) {
            return response()->json([
                'message' => 'Un administrateur ne peut pas supprimer un autre administrateur.',
            ], 403);
        }

        $user->delete();

        return response()->json([
            'message' => 'Compte utilisateur supprimé avec succès.',
        ]);
    }
}
