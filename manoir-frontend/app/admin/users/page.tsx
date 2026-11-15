"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Eye, Shield, User as UserIcon, UserRound } from "lucide-react";
import Modal, { ModalActions, ModalButton } from "@/components/ui/Modal";
import { useAuth } from "@/context/AuthContext";
import { api, type AdminTableQuery, type Paginated, type User } from "@/lib/api";
import { getCountry } from "@/lib/countries";
import { formatDateTime } from "@/lib/reservationDisplay";
import { isAdminUser } from "@/lib/roles";
import { cn } from "@/lib/utils";
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

const roleLabel = (user: User) =>
  user.is_super_admin ? "Super administrateur" : user.is_admin ? "Administrateur" : "Client";

const countryLabel = (code?: string | null) => (code ? getCountry(code)?.name || code : "—");

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();

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

  const [selected, setSelected] = useState<User | null>(null);

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

  const columns: DataTableColumn<User>[] = [
    {
      key: "name",
      header: "Nom",
      sortKey: "name",
      render: (u) => (
        <div className="flex items-center gap-3">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-full border border-gold/15 bg-white/5"
            title={roleLabel(u)}
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
      key: "reservations_count",
      header: "Réservations",
      sortKey: "reservations_count",
      align: "center",
      render: (u) => u.reservations_count ?? "—"
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
      render: (u) => (
        <IconAction label="Voir les détails" icon={Eye} onClick={() => setSelected(u)} />
      )
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

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        icon={UserRound}
        title="Détails de l'utilisateur"
        description={selected ? roleLabel(selected) : undefined}
        maxWidth="max-w-xl"
      >
        {selected && (
          <>
            <dl className="grid gap-3 sm:grid-cols-2">
              <UserDetail label="Nom" wide>
                {selected.name}
              </UserDetail>
              <UserDetail label="E-mail" wide>
                {selected.email}
              </UserDetail>
              <UserDetail label="Téléphone">{selected.phone || "—"}</UserDetail>
              <UserDetail label="Pays">{countryLabel(selected.country)}</UserDetail>
              <UserDetail label="Inscription">
                {formatDateTime(selected.created_at, "—")}
              </UserDetail>
              <UserDetail label="Rôle">{roleLabel(selected)}</UserDetail>
              <UserDetail label="E-mail vérifié">
                <YesNo value={!!selected.email_verified_at} />
                {selected.email_verified_at && (
                  <span className="block text-xs font-normal text-[#6B5A4E]">
                    le {formatDateTime(selected.email_verified_at, "—")}
                  </span>
                )}
              </UserDetail>
              {selected.two_factor_enabled !== undefined && (
                <UserDetail label="Double authentification">
                  <YesNo value={selected.two_factor_enabled} yes="Activée" no="Désactivée" />
                </UserDetail>
              )}
              {selected.reservations_count !== undefined && (
                <UserDetail label="Réservations">{selected.reservations_count}</UserDetail>
              )}
            </dl>
            <ModalActions>
              <ModalButton variant="secondary" onClick={() => setSelected(null)}>
                Fermer
              </ModalButton>
            </ModalActions>
          </>
        )}
      </Modal>
    </div>
  );
}

/** Ligne libellé / valeur de la fiche utilisateur. */
function UserDetail({
  label,
  wide = false,
  children
}: {
  label: string;
  /** Occupe toute la largeur de la grille (valeurs longues). */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-xl border border-[#EADBCD] bg-[#FBF6F1] px-4 py-3",
        wide && "sm:col-span-2"
      )}
    >
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-[#9A8B7E]">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-[#2C2416]">{children}</dd>
    </div>
  );
}

function YesNo({ value, yes = "Oui", no = "Non" }: { value: boolean; yes?: string; no?: string }) {
  return <span className={value ? "text-[#566523]" : "text-[#B5432A]"}>{value ? yes : no}</span>;
}
