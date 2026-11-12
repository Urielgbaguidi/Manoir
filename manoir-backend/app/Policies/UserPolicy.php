<?php

namespace App\Policies;

use App\Models\User;

/**
 * Droits sur les comptes utilisateurs.
 *
 * Personne, pas meme le super administrateur, ne peut supprimer un compte :
 * reservations, paiements et Bons de Sejour y sont rattaches et doivent rester
 * consultables (comptabilite, litiges).
 */
class UserPolicy
{
    public function viewAny(User $actor): bool
    {
        return $actor->isAdmin();
    }

    public function update(User $actor, User $target): bool
    {
        if (! $actor->isAdmin()) {
            return false;
        }

        return ! $target->isAdmin() || (bool) $actor->is_super_admin;
    }

    public function toggleAdmin(User $actor, User $target): bool
    {
        return (bool) $actor->is_super_admin && ! $target->is_super_admin;
    }

    public function delete(User $actor, User $target): bool
    {
        return false;
    }

    public function forceDelete(User $actor, User $target): bool
    {
        return false;
    }
}
