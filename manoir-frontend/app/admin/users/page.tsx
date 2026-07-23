"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { api, User } from "@/lib/api";
import { Edit3, Save, Sparkles, Shield, User as UserIcon, Trash2, X } from "lucide-react";
import Link from "next/link";

export default function AdminUsersPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editedName, setEditedName] = useState("");
  const [savingUser, setSavingUser] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!currentUser) {
        router.push("/auth/login");
      } else if (!currentUser.is_admin) {
        router.push("/");
      }
    }
  }, [currentUser, authLoading, router]);

  useEffect(() => {
    if (currentUser && currentUser.is_admin) {
      loadUsers();
    }
  }, [currentUser]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getAdminUsers();
      setUsers(data);
    } catch (error) {
      console.error("Erreur lors du chargement des utilisateurs:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAdmin = async (user: User) => {
    if (user.id === currentUser?.id) {
      alert("Vous ne pouvez pas modifier votre propre rôle administrateur.");
      return;
    }

    const actionText = user.is_admin
      ? `Retirer les privilèges administrateur de ${user.name} ?`
      : `Nommer ${user.name} administrateur du Manoir ?`;

    if (!confirm(actionText)) return;

    try {
      await api.toggleUserAdmin(user.id);
      loadUsers();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Une erreur est survenue.");
    }
  };

  const startEditingUser = (user: User) => {
    setEditingUserId(user.id);
    setEditedName(user.name);
  };

  const handleUpdateUserName = async (user: User) => {
    if (editedName.trim().length < 2) {
      alert("Veuillez saisir un nom valide.");
      return;
    }

    setSavingUser(true);
    try {
      const response = await api.updateAdminUser(user.id, { name: editedName.trim() });
      setUsers((currentUsers) =>
        currentUsers.map((currentUser) =>
          currentUser.id === response.user.id ? response.user : currentUser
        )
      );
      setEditingUserId(null);
      setEditedName("");
    } catch (error) {
      alert(error instanceof Error ? error.message : "Impossible de modifier le nom.");
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (user.id === currentUser?.id) {
      alert("Vous ne pouvez pas supprimer votre propre compte.");
      return;
    }

    if (
      !confirm(
        `Supprimer définitivement le compte de ${user.name} ? Cette action est irréversible.`
      )
    )
      return;

    try {
      await api.deleteUser(user.id);
      loadUsers();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Une erreur est survenue.");
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-night">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gold border-t-transparent"></div>
      </div>
    );
  }

  return (
    <main className="relative min-h-screen px-6 py-32 text-cream md:px-10">
      <div className="mx-auto max-w-7xl">
        {/* Menu Administration */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12 border-b border-gold/15 pb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-md rounded-full border border-gold/25 mb-4">
              <Sparkles className="w-4 h-4 text-gold-light" />
              <span className="text-cream/85 font-semibold uppercase tracking-widest text-[10px]">
                Portail Administrateur
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold font-display uppercase tracking-tight text-cream">
              Comptes <span className="text-gradient-gold">Utilisateurs</span>
            </h1>
          </div>

          <div className="flex flex-wrap gap-4 text-xs font-black uppercase tracking-wider">
            <Link
              href="/admin"
              className="border border-gold/20 text-gold/80 px-5 py-3 hover:border-gold hover:text-gold-light transition"
            >
              Réservations
            </Link>
            <Link
              href="/admin/rooms"
              className="border border-gold/20 text-gold/80 px-5 py-3 hover:border-gold hover:text-gold-light transition"
            >
              Suites
            </Link>
            <Link
              href="/admin/users"
              className="border border-gold bg-gradient-to-br from-gold-light to-gold text-night px-5 py-3 transition"
            >
              Utilisateurs
            </Link>
          </div>
        </div>

        {/* Tableau des utilisateurs */}
        <div className="glass-dark glass-edge rounded-3xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-gold/10 text-gold/70 text-[11px] font-semibold uppercase tracking-wider">
                  <th className="p-6">Utilisateur</th>
                  <th className="p-6">Email</th>
                  <th className="p-6">Rôle</th>
                  <th className="p-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-gold/10 hover:bg-white/5 transition">
                    <td className="p-6 font-semibold flex items-center gap-3 text-cream">
                      <div className="size-8 rounded-full border border-gold/15 flex items-center justify-center bg-white/5">
                        {u.is_admin ? (
                          <Shield size={14} className="text-gold-light" />
                        ) : (
                          <UserIcon size={14} className="text-cream/55" />
                        )}
                      </div>
                      {editingUserId === u.id ? (
                        <div className="flex min-w-[240px] flex-col gap-2 sm:flex-row">
                          <input
                            type="text"
                            value={editedName}
                            onChange={(event) => setEditedName(event.target.value)}
                            className="glass-input w-full rounded-xl px-3 py-2 text-xs outline-none"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={savingUser}
                              onClick={() => handleUpdateUserName(u)}
                              className="rounded-xl bg-gradient-to-br from-gold-light to-gold p-2 text-night transition hover:brightness-105 disabled:opacity-50"
                              title="Enregistrer"
                            >
                              <Save size={13} />
                            </button>
                            <button
                              type="button"
                              disabled={savingUser}
                              onClick={() => setEditingUserId(null)}
                              className="rounded-xl border border-gold/15 p-2 text-cream/55 transition hover:text-gold-light disabled:opacity-50"
                              title="Annuler"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span>
                          {u.name}{" "}
                          {u.id === currentUser?.id && (
                            <span className="text-[10px] text-cream/45 font-normal italic">
                              (Vous)
                            </span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="p-6 text-cream/70">{u.email}</td>
                    <td className="p-6">
                      <span
                        className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded border ${
                          u.is_admin
                            ? "bg-gold/15 text-gold-light border-gold/30"
                            : "bg-transparent text-cream/60 border-gold/15"
                        }`}
                      >
                        {u.is_admin ? "Admin" : "Client"}
                      </span>
                    </td>
                    <td className="p-6 text-right">
                      {u.id !== currentUser?.id ? (
                        <div className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEditingUser(u)}
                            className="flex items-center gap-1.5 px-3 py-2 border border-gold/15 hover:border-gold text-gold/80 hover:text-gold-light text-[10px] font-black uppercase tracking-wider rounded-xl transition"
                            title="Modifier le nom"
                          >
                            <Edit3 size={12} /> Modifier
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleAdmin(u)}
                            className="flex items-center gap-1.5 px-3 py-2 border border-gold/15 hover:border-gold text-gold/80 hover:text-gold-light text-[10px] font-black uppercase tracking-wider rounded-xl transition"
                            title={u.is_admin ? "Rendre client" : "Rendre admin"}
                          >
                            <Shield size={12} /> {u.is_admin ? "Déclasser" : "Nommer Admin"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u)}
                            className="p-2 border border-terracotta/40 hover:border-terracotta text-terracotta-light hover:bg-terracotta/15 rounded-xl transition"
                            title="Supprimer"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-cream/35 italic">Actif</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
