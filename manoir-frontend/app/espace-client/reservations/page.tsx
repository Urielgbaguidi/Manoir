"use client";

import { AnimatePresence } from "framer-motion";
import { Eye, Plus, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import DataTable, {
  IconAction,
  TableBadge,
  useLocalTable,
  type BadgeTone,
  type DataTableColumn
} from "@/components/dashboard/admin/DataTable";
import { ClientPageHeader } from "@/components/dashboard/client/ClientShell";
import CancelReservationModal from "@/components/reservations/CancelReservationModal";
import ReservationDetail from "@/components/reservations/ReservationDetail";
import { errorMessage } from "@/components/reservations/useIdempotentIntent";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { ApiError, api, type Reservation, type ReservationStatus } from "@/lib/api";
import {
  effectiveStatus,
  formatShortDay,
  formatStayPeriod,
  reservationHref,
  reservationRef,
  reservationTitle,
  statusLabels,
  todayIso
} from "@/lib/reservationDisplay";

/** Le client peut annuler tant que sa demande n'est ni validée ni payée. */
const CANCELLABLE: ReservationStatus[] = ["EN_ATTENTE", "VALIDEE_PAIEMENT_REQUIS"];

const statusBadge: Record<ReservationStatus, BadgeTone> = {
  EN_ATTENTE: "warning",
  VALIDEE_PAIEMENT_REQUIS: "info",
  CONFIRMEE: "success",
  SEJOUR_PAYE: "success",
  LIBEREE: "neutral",
  REFUSEE: "error",
  EXPIREE: "neutral",
  ANNULEE: "error",
  REMBOURSEE: "neutral"
};

export default function ReservationsPage() {
  // useSearchParams impose une frontière Suspense avec l'export statique.
  return (
    <Suspense fallback={<PageLoader />}>
      <ReservationsContent />
    </Suspense>
  );
}

function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-gold border-t-transparent" />
    </div>
  );
}

function ReservationsContent() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  // `payer` : anciens liens (« Réserver » ouvrait directement le paiement).
  const selectedId = searchParams.get("reservation") ?? searchParams.get("payer");

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [cancellingReservation, setCancellingReservation] = useState<Reservation | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const missingFetched = useRef<string | null>(null);
  const [missingFailed, setMissingFailed] = useState(false);

  const upsert = useCallback((reservation: Reservation) => {
    setReservations((list) =>
      list.some((item) => item.id === reservation.id)
        ? list.map((item) => (item.id === reservation.id ? reservation : item))
        : [reservation, ...list]
    );
  }, []);

  const loadReservations = useCallback(async () => {
    try {
      setReservations(await api.getMyReservations());
    } catch (error) {
      showToast(errorMessage(error, "Impossible de charger vos réservations."), "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const refreshOne = useCallback(
    async (id: number | string): Promise<boolean> => {
      try {
        upsert(await api.getReservation(String(id)));
        return true;
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          showToast("Cette réservation est introuvable.", "error");
          router.replace("/espace-client/reservations");
          return false;
        }
        showToast(errorMessage(error, "Impossible d'actualiser la réservation."), "error");
        return false;
      }
    },
    [upsert, showToast, router]
  );

  useEffect(() => {
    if (user) loadReservations();
  }, [user, loadReservations]);

  // Rafraîchit le classement « en cours / historique » (délais qui expirent).
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const selected = selectedId
    ? reservations.find((item) => String(item.id) === selectedId)
    : undefined;

  // Lien direct vers une réservation absente de la liste (masquée, ou tout juste créée).
  useEffect(() => {
    if (loading || !selectedId || selected || missingFetched.current === selectedId) return;
    missingFetched.current = selectedId;
    setMissingFailed(false);
    refreshOne(selectedId).then((found) => setMissingFailed(!found));
  }, [loading, selectedId, selected, refreshOne]);

  const handleConfirmCancellation = async () => {
    if (!cancellingReservation || cancelling) return;
    setCancelling(true);
    try {
      const response = await api.cancelReservation(cancellingReservation.id.toString());
      upsert({ ...cancellingReservation, ...response.reservation });
      showToast("Votre réservation a été annulée.", "success");
      setCancellingReservation(null);
    } catch (error) {
      showToast(errorMessage(error, "L'annulation a échoué."), "error");
    } finally {
      setCancelling(false);
    }
  };

  // Retirer de l'historique ne supprime rien : la réservation et ses documents
  // restent en base et consultables par l'administration.
  const canCancel = (reservation: Reservation) =>
    CANCELLABLE.includes(effectiveStatus(reservation, nowMs)) &&
    todayIso(nowMs) <= reservation.check_in.slice(0, 10);

  const table = useLocalTable(reservations, {
    initialSort: "created",
    initialDirection: "desc",
    searchText: (reservation) =>
      [
        reservationRef(reservation),
        reservationTitle(reservation),
        statusLabels[effectiveStatus(reservation, nowMs)],
        formatStayPeriod(reservation),
        formatShortDay(reservation.created_at)
      ].join(" "),
    sortValue: (reservation, key) => {
      if (key === "created") return new Date(reservation.created_at).getTime();
      if (key === "check_in") return reservation.check_in;
      if (key === "status") return statusLabels[effectiveStatus(reservation, nowMs)];
      return null;
    }
  });

  const columns: DataTableColumn<Reservation>[] = [
    {
      key: "ref",
      header: "Réf.",
      sortKey: "created",
      render: (reservation) => (
        <span className="font-medium text-cream">{reservationRef(reservation)}</span>
      )
    },
    {
      key: "room",
      header: "Appartement",
      render: (reservation) => (
        <span className="font-medium text-cream">{reservationTitle(reservation)}</span>
      )
    },
    {
      key: "check_in",
      header: "Séjour",
      sortKey: "check_in",
      render: (reservation) => formatStayPeriod(reservation)
    },
    {
      key: "status",
      header: "Statut",
      sortKey: "status",
      render: (reservation) => {
        const status = effectiveStatus(reservation, nowMs);
        return <TableBadge tone={statusBadge[status]}>{statusLabels[status]}</TableBadge>;
      }
    },
    {
      key: "created",
      header: "Demandée le",
      sortKey: "created",
      render: (reservation) => formatShortDay(reservation.created_at)
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (reservation) => (
        <div className="flex items-center justify-end gap-2">
          <IconAction
            label="Voir la réservation"
            icon={Eye}
            href={reservationHref(reservation.id)}
          />
          {canCancel(reservation) && (
            <IconAction
              label="Annuler la réservation"
              icon={X}
              tone="danger"
              onClick={() => setCancellingReservation(reservation)}
            />
          )}
        </div>
      )
    }
  ];

  if (loading) {
    return <PageLoader />;
  }

  const cancelModal = (
    <AnimatePresence>
      {cancellingReservation && (
        <CancelReservationModal
          reservation={cancellingReservation}
          cancelling={cancelling}
          onClose={() => setCancellingReservation(null)}
          onConfirm={handleConfirmCancellation}
        />
      )}
    </AnimatePresence>
  );

  /* --------------------------------- Détail --------------------------------- */

  if (selectedId) {
    if (!selected) {
      if (!missingFailed) return <PageLoader />;
      return (
        <div className="glass-warm glass-edge rounded-3xl px-6 py-16 text-center">
          <p className="font-semibold text-cream">Impossible d&apos;afficher cette réservation.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setMissingFailed(false);
                refreshOne(selectedId).then((found) => setMissingFailed(!found));
              }}
              className="rounded-full bg-gradient-to-br from-gold-light to-gold px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-night"
            >
              Réessayer
            </button>
            <Link
              href="/espace-client/reservations"
              className="rounded-xl border border-gold/20 px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-cream"
            >
              Mes réservations
            </Link>
          </div>
        </div>
      );
    }

    return (
      <div className="relative text-cream">
        <ReservationDetail
          reservation={selected}
          status={effectiveStatus(selected, nowMs)}
          canCancel={canCancel(selected)}
          onRefresh={() => refreshOne(selected.id)}
          onCancel={() => setCancellingReservation(selected)}
          onPaid={() => {
            showToast("Paiement confirmé. Votre Bon de Séjour est disponible.", "success");
            refreshOne(selected.id);
          }}
        />
        {cancelModal}
      </div>
    );
  }

  /* ---------------------------------- Liste --------------------------------- */

  return (
    <div className="relative text-cream">
      <ClientPageHeader
        title="Mes réservations"
        description="Toutes vos demandes de réservation et leur suivi."
        action={
          <Link
            href="/rooms"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-gradient-to-br from-gold-light to-gold px-5 py-3 text-sm font-bold text-night transition hover:brightness-105"
          >
            <Plus size={16} />
            Nouvelle réservation
          </Link>
        }
      />

      <DataTable
        {...table}
        title="Historique des réservations"
        columns={columns}
        rowKey={(reservation) => reservation.id}
        searchPlaceholder="Rechercher une réservation…"
        emptyTitle={reservations.length ? "Aucun résultat" : "Aucune réservation"}
        emptyMessage={
          reservations.length
            ? "Modifiez votre recherche pour trouver ce que vous cherchez."
            : "Choisissez un appartement et vos dates : votre demande apparaîtra ici."
        }
      />

      {cancelModal}
    </div>
  );
}
