<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\AdminTableRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * Comptes utilisateurs vus par l'administration.
 *
 * Volontairement AUCUNE methode de suppression : UserPolicy::delete renvoie
 * toujours false et le modele User refuse lui-meme d'etre supprime.
 */
class AdminUserController extends Controller
{
    /**
     * Liste paginee, triable et filtrable cote serveur (DataTables).
     */
    public function index(AdminTableRequest $request): JsonResponse
    {
        Gate::authorize('viewAny', User::class);

        $query = User::query()
            ->withCount('reservations')
            ->when($request->has('is_admin'), function ($query) use ($request) {
                return $request->boolean('is_admin')
                    ? $query->where(fn ($q) => $q->where('is_admin', true)->orWhere('is_super_admin', true))
                    : $query->where('is_admin', false)->where('is_super_admin', false);
            })
            ->when($request->has('verified'), fn ($q) => $request->boolean('verified')
                ? $q->whereNotNull('email_verified_at')
                : $q->whereNull('email_verified_at'));

        if ($search = $request->validated('search')) {
            $term = $request->likeTerm($search);
            $query->where(fn ($q) => $q
                ->where('name', 'like', $term)
                ->orWhere('email', 'like', $term)
                ->orWhere('phone', 'like', $term)
                ->orWhere('country', 'like', $term));
        }

        $sort = $request->sortColumn([
            'id' => 'id',
            'name' => 'name',
            'email' => 'email',
            'created_at' => 'created_at',
            'reservations_count' => 'reservations_count',
        ], 'created_at');

        return response()->json(
            $query->orderBy($sort, $request->direction())->orderByDesc('id')->paginate($request->perPage())
        );
    }

    public function toggleAdmin(string $id, Request $request): JsonResponse
    {
        $user = User::findOrFail($id);

        if (! Gate::allows('toggleAdmin', $user)) {
            return response()->json([
                'message' => $user->is_super_admin
                    ? 'Le super administrateur ne peut pas être déclassé.'
                    : 'Seul le super administrateur peut nommer ou déclasser un administrateur.',
            ], 403);
        }

        $user->forceFill(['is_admin' => ! $user->is_admin])->save();

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

        if (! Gate::allows('update', $user)) {
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
}
