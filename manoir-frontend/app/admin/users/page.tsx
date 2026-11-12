"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Save, Shield, ShieldCheck, ShieldOff, User as UserIcon, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { api, type AdminTableQuery, type Paginated, type User } from "@/lib/api";
import { isAdminUser } from "@/lib/roles";
import { AdminPageHeader } from "@/components/dashboard/admin/AdminShell";
import DataTable, {
  FilterField,
  IconAction,
  filterInputClass,
  type DataTableColumn,
  type SortDirection
} from "@/components/dashboard/admin/DataTable";

type RoleFilter = "all" | "admin" | "client";

const DEFAULT_SORT = "created_at";
const DEFAULT_DIRECTION: SortDirection = "desc";
const DEFAULT_PER_PAGE = 10;

const emptyPage: Paginated<User> = {
  data: [],
  current_page: 1,
  last_page: 1,
  per_page: DEFAULT_PER_PAGE,
  total: 0,
  from: null,
  to: null
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("fr-FR");
};

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();

  // Parametres du tableau (traitement cote serveur).
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState(DEFAULT_SORT);
  const [direction, setDirection] = useState<SortDirection>(DEFAULT_DIRECTION);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const [result, setResult] = useState<Paginated<User>>(emptyPage);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editedName, setEditedName] = useState("");
  const [savingUser, setSavingUser] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const loadUsers = useCallback(async () => {
    const query: AdminTableQuery = {
      page,
      per_page: perPage,
      search: search || undefined,
      sort,
      direction,
      is_admin: roleFilter === "all" ? undefined : roleFilter === "admin"
    };

    // Seule la derniere requete lancee met a jour le tableau.
    const current = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAdminUsers(query);
      if (current !== requestId.current) return;
      // Page devenue vide (ex. apres un filtre) : on revient a la derniere page.
      if (data.data.length === 0 && data.current_page > 1 && data.last_page < data.current_page) {
        setPage(Math.max(1, data.last_page));
        return;
      }
      setResult(data);
    } catch (err) {
      if (current !== requestId.current) return;
      setResult(emptyPage);
      setError(err instanceof Error ? err.message : "Impossible de charger les utilisateurs.");
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, [page, perPage, search, sort, direction, roleFilter]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const isFiltered =
    search !== "" ||
    roleFilter !== "all" ||
    sort !== DEFAULT_SORT ||
    direction !== DEFAULT_DIRECTION ||
    perPage !== DEFAULT_PER_PAGE;

  const resetFilters = () => {
    setSearch("");
    setRoleFilter("all");
    setSort(DEFAULT_SORT);
    setDirection(DEFAULT_DIRECTION);
    setPerPage(DEFAULT_PER_PAGE);
    setPage(1);
  };

  const handleToggleAdmin = async (target: User) => {
    if (!currentUser?.is_super_admin) {
      showToast("Seul le super administrateur peut gérer les rôles administrateur.", "error");
      return;
    }
    if (target.id === currentUser.id) {
      showToast("Vous ne pouvez pas modifier votre propre rôle administrateur.", "error");
      return;
    }

    const actionText = target.is_admin
      ? `Retirer les privilèges administrateur de ${target.name} ?`
      : `Nommer ${target.name} administrateur du Manoir ?`;
    if (!confirm(actionText)) return;

    setTogglingId(target.id);
    try {
      const response = await api.toggleUserAdmin(target.id);
      showToast(response.message, "success");
      loadUsers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Une erreur est survenue.", "error");
    } finally {
      setTogglingId(null);
    }
  };

  const startEditingUser = (target: User) => {
    setEditingUserId(target.id);
    setEditedName(target.name);
  };

  const handleUpdateUserName = async (target: User) => {
    if (editedName.trim().length < 2) {
      showToast("Veuillez saisir un nom valide.", "error");
      return;
    }

    setSavingUser(true);
    try {
      const response = await api.updateAdminUser(target.id, { name: editedName.trim() });
      setResult((current) => ({
        ...current,
        data: current.data.map((row) =>
          row.id === response.user.id ? { ...row, ...response.user } : row
        )
      }));
      setEditingUserId(null);
      setEditedName("");
      showToast(response.message || "Nom mis à jour.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossible de modifier le nom.", "error");
    } finally {
      setSavingUser(false);
    }
  };

  const columns: DataTableColumn<User>[] = [
    {
      key: "name",
      header: "Nom",
      sortKey: "name",
      render: (u) =>
        editingUserId === u.id ? (
          <div className="flex min-w-[240px] items-center gap-2">
            <input
              type="text"
              value={editedName}
              autoFocus
              onChange={(event) => setEditedName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleUpdateUserName(u);
                if (event.key === "Escape") setEditingUserId(null);
              }}
              aria-label="Nouveau nom"
              className="glass-input h-9 w-full rounded-lg px-3 text-sm outline-none"
            />
            <IconAction
              label="Enregistrer"
              icon={Save}
              tone="success"
              disabled={savingUser}
              onClick={() => handleUpdateUserName(u)}
            />
            <IconAction
              label="Annuler"
              icon={X}
              disabled={savingUser}
              onClick={() => setEditingUserId(null)}
            />
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span
              className="grid size-9 shrink-0 place-items-center rounded-full border border-gold/15 bg-white/5"
              title={u.is_super_admin ? "Super admin" : u.is_admin ? "Administrateur" : "Client"}
            >
              {isAdminUser(u) ? (
                <Shield size={15} className="text-gold-light" />
              ) : (
                <UserIcon size={15} className="text-cream/55" />
              )}
            </span>
            <span className="font-medium text-cream">
              {u.name}
              {u.id === currentUser?.id && (
                <span className="ml-1 text-xs font-normal italic text-cream/45">(vous)</span>
              )}
            </span>
          </div>
        )
    },
    {
      key: "email",
      header: "E-mail",
      sortKey: "email",
      render: (u) => u.email
    },
    {
      key: "phone",
      header: "Téléphone",
      render: (u) => u.phone || <span className="text-cream/35">—</span>
    },
    {
      key: "created_at",
      header: "Inscription",
      sortKey: "created_at",
      render: (u) => formatDate(u.created_at)
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (u) => {
        if (u.id === currentUser?.id || editingUserId === u.id) return null;
        const canRename = !isAdminUser(u) || currentUser?.is_super_admin;
        const canToggleAdmin = currentUser?.is_super_admin && !u.is_super_admin;
        return (
          <div className="inline-flex gap-2">
            {canRename && (
              <IconAction
                label="Modifier le nom"
                icon={Pencil}
                onClick={() => startEditingUser(u)}
              />
            )}
            {canToggleAdmin && (
              <IconAction
                label={u.is_admin ? "Retirer le rôle administrateur" : "Nommer administrateur"}
                icon={u.is_admin ? ShieldOff : ShieldCheck}
                tone={u.is_admin ? "danger" : "success"}
                disabled={togglingId === u.id}
                onClick={() => handleToggleAdmin(u)}
              />
            )}
          </div>
        );
      }
    }
  ];

  return (
    <div className="relative text-cream">
      <AdminPageHeader title="Utilisateurs" />

      <DataTable
        columns={columns}
        rows={result.data}
        rowKey={(u) => u.id}
        loading={loading}
        error={error}
        emptyMessage="Aucun utilisateur ne correspond à votre recherche."
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        searchPlaceholder="Nom, e-mail, téléphone…"
        sort={sort}
        direction={direction}
        onSortChange={(nextSort, nextDirection) => {
          setSort(nextSort);
          setDirection(nextDirection);
          setPage(1);
        }}
        page={result.current_page}
        lastPage={result.last_page}
        total={result.total}
        from={result.from}
        to={result.to}
        perPage={perPage}
        onPageChange={setPage}
        onPerPageChange={(value) => {
          setPerPage(value);
          setPage(1);
        }}
        onReset={resetFilters}
        resetLabel="Réinitialiser les filtres"
        canReset={isFiltered}
        filters={
          <FilterField label="Rôle">
            <select
              value={roleFilter}
              onChange={(event) => {
                setRoleFilter(event.target.value as RoleFilter);
                setPage(1);
              }}
              className={filterInputClass}
            >
              <option value="all" className="text-night">
                Tous les rôles
              </option>
              <option value="admin" className="text-night">
                Administrateurs
              </option>
              <option value="client" className="text-night">
                Clients
              </option>
            </select>
          </FilterField>
        }
      />
    </div>
  );
}
