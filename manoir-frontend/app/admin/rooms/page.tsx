"use client";

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { DoorOpen, Image as ImageIcon, Pencil, Plus, Save, Trash2, Video, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { api, type Reservation, type Room, type RoomCategory } from "@/lib/api";
import { isAdminUser } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { categoryLabels, formatCurrency, formatDay } from "@/lib/reservationDisplay";
import { AdminPageHeader } from "@/components/dashboard/admin/AdminShell";
import DataTable, {
  IconAction,
  TableBadge,
  useLocalTable,
  type DataTableColumn
} from "@/components/dashboard/admin/DataTable";

type MediaKind = "images" | "videos";

/** Formulaire d'appartement (création ou modification). */
interface RoomForm {
  id?: number;
  name: string;
  apartment_number: number | null;
  type: string;
  base_price: number;
  max_occupants: number;
  description: string;
  status: string;
  equipments: string;
  images: string[];
  videos: string[];
}

const emptyRoomForm = (type: string): RoomForm => ({
  name: "",
  apartment_number: null,
  type,
  base_price: 0,
  max_occupants: 2,
  description: "",
  status: "available",
  equipments: "",
  images: [],
  videos: []
});

const toRoomForm = (room: Room): RoomForm => ({
  id: room.id,
  name: room.name,
  apartment_number: room.apartment_number ?? null,
  type: room.type,
  base_price: room.base_price,
  max_occupants: room.max_occupants,
  description: room.description ?? "",
  status: room.status,
  equipments: (room.equipments ?? []).join(", "),
  images: room.images ?? [],
  videos: room.videos ?? []
});

const roomLabel = (room: Pick<Room, "name" | "type" | "apartment_number">) => {
  if (room.type === "vip" && room.apartment_number) {
    return `Appartement VIP ${room.apartment_number}`;
  }
  return room.name.toLowerCase().startsWith("appartement") ? room.name : `Appartement ${room.name}`;
};

const fieldLabel = "mb-1.5 block text-xs font-medium text-cream/50";
const fieldInput = "glass-input w-full rounded-lg px-3 py-2.5 text-sm outline-none";
const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-gold-light to-gold px-4 py-2.5 text-sm font-semibold text-night transition hover:brightness-105 disabled:opacity-50";
const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-gold/20 px-4 py-2.5 text-sm font-medium text-cream/70 transition hover:border-gold/50 hover:text-gold-light disabled:opacity-50";

export default function AdminRoomsPage() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const isAdmin = isAdminUser(user);

  const [rooms, setRooms] = useState<Room[]>([]);
  const [categories, setCategories] = useState<RoomCategory[]>([]);
  const [occupied, setOccupied] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [roomForm, setRoomForm] = useState<RoomForm | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<Reservation | null>(null);
  const [releaseNotes, setReleaseNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState<MediaKind | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.push("/auth/login");
    else if (!isAdmin) router.push("/");
  }, [user, authLoading, isAdmin, router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [roomList, categoryList, occupiedList] = await Promise.all([
        api.getAdminRooms(),
        api.getAdminRoomCategories(),
        api.getOccupiedRooms()
      ]);
      setRooms(roomList);
      setCategories(categoryList);
      setOccupied(occupiedList.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les appartements.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user && isAdmin) loadData();
  }, [user, isAdmin, loadData]);

  /** Séjour payé en cours, par appartement. */
  const occupancyByRoom = useMemo(() => {
    const map = new Map<number, Reservation>();
    occupied.forEach((reservation) => map.set(reservation.room_id, reservation));
    return map;
  }, [occupied]);

  const categoryByType = useMemo(
    () => new Map(categories.map((category) => [category.type as string, category])),
    [categories]
  );

  const categoryName = (type: string) =>
    categoryByType.get(type)?.label ?? categoryLabels[type] ?? type;
  const priceOf = (room: Room) =>
    Number(room.base_price || categoryByType.get(room.type)?.price_per_night || 0);

  const roomTable = useLocalTable(rooms, {
    searchText: (room) =>
      [roomLabel(room), room.name, room.apartment_number, categoryName(room.type)].join(" "),
    sortValue: (room, key) => {
      switch (key) {
        case "name":
          return roomLabel(room);
        case "type":
          return categoryName(room.type);
        case "price":
          return priceOf(room);
        case "capacity":
          return room.max_occupants;
        case "occupancy":
          return occupancyByRoom.has(room.id) ? 1 : 0;
        default:
          return null;
      }
    },
    initialSort: "name",
    initialDirection: "asc"
  });

  /* ----------------------------- Appartements ----------------------------- */

  const saveRoom = async () => {
    if (!roomForm) return;
    const payload = {
      name: roomForm.name.trim(),
      description: roomForm.description.trim(),
      max_occupants: Number(roomForm.max_occupants),
      apartment_number: roomForm.apartment_number,
      base_price: Number(roomForm.base_price),
      type: roomForm.type,
      equipments: roomForm.equipments
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      images: roomForm.images,
      videos: roomForm.videos,
      status: roomForm.status
    };

    setSubmitting(true);
    try {
      const response = roomForm.id
        ? await api.updateAdminRoom(roomForm.id, payload)
        : await api.createAdminRoom(payload);
      showToast(response.message, "success");
      setRoomForm(null);
      loadData();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Impossible d'enregistrer l'appartement.",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const deleteRoom = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      const response = await api.deleteAdminRoom(deleteTarget.id);
      showToast(response.message, "success");
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Impossible de supprimer l'appartement.",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const releaseRoom = async () => {
    if (!releaseTarget) return;
    setSubmitting(true);
    try {
      const response = await api.releaseOccupiedRoom(releaseTarget.id, {
        release_notes: releaseNotes.trim() || undefined
      });
      showToast(response.message, "success");
      setReleaseTarget(null);
      loadData();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Impossible de libérer l'appartement.",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  /** Import immédiat d'une photo ou vidéo (appartement existant). */
  const uploadMedia = async (kind: MediaKind, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadingMedia(kind);
    try {
      if (roomForm?.id) {
        const response = await api.uploadAdminRoomMedia(roomForm.id, kind, file);
        setRoomForm((current) =>
          current ? { ...current, [kind]: response.room[kind] ?? current[kind] } : current
        );
        setRooms((current) =>
          current.map((room) =>
            room.id === response.room.id ? { ...room, [kind]: response.room[kind] } : room
          )
        );
        showToast(response.message, "success");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossible d'ajouter le fichier.", "error");
    } finally {
      setUploadingMedia(null);
    }
  };

  /* -------------------------------- Colonnes ------------------------------- */

  const roomColumns: DataTableColumn<Room>[] = [
    {
      key: "name",
      header: "Appartement",
      sortKey: "name",
      render: (room) => (
        <div className="flex items-center gap-3">
          <div className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-gold/15 bg-white/5">
            {room.images?.[0] ? (
              <Image src={room.images[0]} alt="" fill sizes="40px" className="object-cover" />
            ) : (
              <ImageIcon size={16} className="absolute inset-0 m-auto text-cream/30" />
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-cream">{roomLabel(room)}</p>
            <p className="text-xs text-cream/45">
              {room.apartment_number ? `N° ${room.apartment_number}` : room.name}
            </p>
          </div>
        </div>
      )
    },
    {
      key: "type",
      header: "Catégorie",
      sortKey: "type",
      render: (room) => categoryName(room.type)
    },
    {
      key: "price",
      header: "Prix / nuit",
      sortKey: "price",
      align: "right",
      className: "font-medium text-cream",
      render: (room) => formatCurrency(priceOf(room))
    },
    {
      key: "capacity",
      header: "Capacité",
      sortKey: "capacity",
      align: "center",
      render: (room) => `${room.max_occupants} pers.`
    },
    {
      key: "occupancy",
      header: "Statut",
      sortKey: "occupancy",
      render: (room) => {
        const stay = occupancyByRoom.get(room.id);
        if (!stay) return <TableBadge tone="success">Libre</TableBadge>;
        return (
          <div className="flex flex-col gap-1">
            <TableBadge tone="error">Occupé</TableBadge>
            <span className="text-xs text-cream/45">
              {stay.user?.name ? `${stay.user.name} · ` : ""}jusqu&apos;au{" "}
              {formatDay(stay.check_out)}
            </span>
          </div>
        );
      }
    },
    {
      key: "status",
      header: "Réservation en ligne",
      render: (room) =>
        room.status === "available" ? (
          <TableBadge tone="info">Ouverte</TableBadge>
        ) : (
          <TableBadge tone="neutral">Bloquée</TableBadge>
        )
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (room) => {
        const stay = occupancyByRoom.get(room.id);
        return (
          <div className="inline-flex gap-2">
            {stay && (
              <IconAction
                label="Libérer l'appartement"
                icon={DoorOpen}
                tone="success"
                onClick={() => {
                  setReleaseNotes("");
                  setReleaseTarget(stay);
                }}
              />
            )}
            <IconAction
              label="Modifier"
              icon={Pencil}
              onClick={() => setRoomForm(toRoomForm(room))}
            />
            <IconAction
              label="Supprimer"
              icon={Trash2}
              tone="danger"
              onClick={() => setDeleteTarget(room)}
            />
          </div>
        );
      }
    }
  ];

  const typeOptions = useMemo(() => {
    const options = categories.map((category) => ({ value: category.type, label: category.label }));
    if (roomForm && !options.some((option) => option.value === roomForm.type)) {
      options.push({ value: roomForm.type as RoomCategory["type"], label: roomForm.type });
    }
    return options;
  }, [categories, roomForm]);

  const patchRoomForm = (changes: Partial<RoomForm>) =>
    setRoomForm((current) => (current ? { ...current, ...changes } : current));

  return (
    <div className="relative space-y-8 text-cream">
      <AdminPageHeader
        title="Appartements"
        action={
          <button
            type="button"
            onClick={() => setRoomForm(emptyRoomForm(categories[0]?.type ?? "vip"))}
            className={primaryButton}
          >
            <Plus size={16} />
            Ajouter un appartement
          </button>
        }
      />

      <DataTable
        {...roomTable}
        columns={roomColumns}
        rowKey={(room) => room.id}
        loading={loading || authLoading}
        error={error}
        title="Appartements"
        description={`${occupied.length} occupé${occupied.length > 1 ? "s" : ""} actuellement`}
        emptyTitle="Aucun appartement"
        emptyMessage="Ajoutez un appartement ou modifiez votre recherche."
        searchPlaceholder="Nom, numéro, catégorie…"
        minWidth="980px"
      />

      {/* Création / modification d'un appartement */}
      <Modal
        open={!!roomForm}
        onClose={() => !submitting && setRoomForm(null)}
        title={roomForm?.id ? `Modifier ${roomLabel(roomForm)}` : "Nouvel appartement"}
      >
        {roomForm && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom">
                <input
                  type="text"
                  value={roomForm.name}
                  onChange={(event) => patchRoomForm({ name: event.target.value })}
                  className={fieldInput}
                />
              </Field>
              <Field label="Numéro d'appartement">
                <input
                  type="number"
                  min={0}
                  value={roomForm.apartment_number ?? ""}
                  onChange={(event) =>
                    patchRoomForm({
                      apartment_number:
                        event.target.value === "" ? null : Number(event.target.value)
                    })
                  }
                  className={fieldInput}
                />
              </Field>
              <Field label="Catégorie">
                <select
                  value={roomForm.type}
                  onChange={(event) => patchRoomForm({ type: event.target.value })}
                  className={fieldInput}
                >
                  {typeOptions.map((option) => (
                    <option key={option.value} value={option.value} className="text-night">
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Réservation en ligne">
                <select
                  value={roomForm.status}
                  onChange={(event) => patchRoomForm({ status: event.target.value })}
                  className={fieldInput}
                >
                  <option value="available" className="text-night">
                    Ouverte
                  </option>
                  <option value="unavailable" className="text-night">
                    Bloquée
                  </option>
                </select>
              </Field>
              <Field label="Prix par nuit (FCFA)">
                <input
                  type="number"
                  min={0}
                  value={roomForm.base_price}
                  onChange={(event) => patchRoomForm({ base_price: Number(event.target.value) })}
                  className={fieldInput}
                />
              </Field>
              <Field label="Capacité (personnes)">
                <input
                  type="number"
                  min={1}
                  value={roomForm.max_occupants}
                  onChange={(event) => patchRoomForm({ max_occupants: Number(event.target.value) })}
                  className={fieldInput}
                />
              </Field>
            </div>

            <Field label="Description">
              <textarea
                rows={4}
                value={roomForm.description}
                onChange={(event) => patchRoomForm({ description: event.target.value })}
                className={cn(fieldInput, "resize-none leading-6")}
              />
            </Field>

            <Field label="Équipements (séparés par des virgules)">
              <input
                type="text"
                value={roomForm.equipments}
                onChange={(event) => patchRoomForm({ equipments: event.target.value })}
                placeholder="Wi-Fi, Climatisation, Cuisine équipée…"
                className={fieldInput}
              />
            </Field>

            {roomForm.id ? (
              <MediaEditor
                images={roomForm.images}
                videos={roomForm.videos}
                uploading={uploadingMedia}
                onRemove={(kind, index) =>
                  patchRoomForm({ [kind]: roomForm[kind].filter((_, i) => i !== index) })
                }
                onUpload={uploadMedia}
              />
            ) : (
              <p className="rounded-lg border border-dashed border-gold/20 bg-white/5 p-4 text-xs text-cream/50">
                Les photos et vidéos pourront être ajoutées une fois l&apos;appartement créé.
              </p>
            )}

            <ModalFooter
              submitting={submitting}
              onCancel={() => setRoomForm(null)}
              onSubmit={saveRoom}
              submitLabel={roomForm.id ? "Enregistrer" : "Créer l'appartement"}
            />
          </div>
        )}
      </Modal>

      {/* Suppression */}
      <Modal
        open={!!deleteTarget}
        onClose={() => !submitting && setDeleteTarget(null)}
        title="Supprimer l'appartement"
        maxWidth="max-w-md"
      >
        {deleteTarget && (
          <div className="space-y-5">
            <p className="text-sm leading-6 text-cream/70">
              Supprimer définitivement{" "}
              <strong className="text-cream">{roomLabel(deleteTarget)}</strong> ? Cette action est
              irréversible. Un appartement qui a déjà des réservations ne peut pas être supprimé :
              bloquez plutôt sa réservation en ligne.
            </p>
            <ModalFooter
              submitting={submitting}
              onCancel={() => setDeleteTarget(null)}
              onSubmit={deleteRoom}
              submitLabel="Supprimer"
              danger
            />
          </div>
        )}
      </Modal>

      {/* Libération manuelle */}
      <Modal
        open={!!releaseTarget}
        onClose={() => !submitting && setReleaseTarget(null)}
        title="Libérer l'appartement"
        maxWidth="max-w-lg"
      >
        {releaseTarget && (
          <div className="space-y-5">
            <p className="text-sm leading-6 text-cream/60">
              L&apos;occupation est marquée comme terminée et l&apos;appartement redevient
              disponible. L&apos;historique de la réservation est conservé.
            </p>
            <div className="space-y-1.5 rounded-lg border border-gold/15 bg-white/5 p-4 text-sm text-cream/70">
              <p>
                <strong className="text-cream">Appartement :</strong>{" "}
                {releaseTarget.room ? roomLabel(releaseTarget.room) : `#${releaseTarget.room_id}`}
              </p>
              <p>
                <strong className="text-cream">Client :</strong>{" "}
                {releaseTarget.user?.name || "Client non renseigné"}
              </p>
              <p>
                <strong className="text-cream">Séjour :</strong> du{" "}
                {formatDay(releaseTarget.check_in)} au {formatDay(releaseTarget.check_out)}
              </p>
            </div>
            <Field label="Note interne (facultative)">
              <textarea
                rows={3}
                value={releaseNotes}
                onChange={(event) => setReleaseNotes(event.target.value)}
                placeholder="Ex : départ anticipé, appartement remis à disposition…"
                className={cn(fieldInput, "resize-none")}
              />
            </Field>
            <ModalFooter
              submitting={submitting}
              onCancel={() => setReleaseTarget(null)}
              onSubmit={releaseRoom}
              submitLabel="Libérer l'appartement"
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/*  Sous-composants                                                          */
/* ------------------------------------------------------------------------ */

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className={fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

function ModalFooter({
  submitting,
  onCancel,
  onSubmit,
  submitLabel,
  danger = false
}: {
  submitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  danger?: boolean;
}) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-gold/10 pt-4 sm:flex-row sm:justify-end">
      <button type="button" disabled={submitting} onClick={onCancel} className={secondaryButton}>
        Annuler
      </button>
      <button
        type="button"
        disabled={submitting}
        onClick={onSubmit}
        className={
          danger
            ? "inline-flex items-center justify-center gap-2 rounded-lg bg-terracotta px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-terracotta/90 disabled:opacity-50"
            : primaryButton
        }
      >
        {danger ? <Trash2 size={16} /> : <Save size={16} />}
        {submitting ? "Patientez…" : submitLabel}
      </button>
    </div>
  );
}

function MediaEditor({
  images,
  videos,
  uploading,
  onRemove,
  onUpload
}: {
  images: string[];
  videos: string[];
  uploading: MediaKind | null;
  onRemove: (kind: MediaKind, index: number) => void;
  onUpload: (kind: MediaKind, event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-medium text-cream">
            <ImageIcon size={16} /> Photos
          </span>
          <UploadButton
            kind="images"
            label="Photo"
            accept="image/jpeg,image/png,image/webp,image/avif"
            uploading={uploading}
            onUpload={onUpload}
          />
        </div>
        {images.length === 0 ? (
          <p className="text-xs text-cream/45">Aucune photo.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((image, index) => (
              <div
                key={`${image}-${index}`}
                className="group relative aspect-video overflow-hidden rounded-lg border border-gold/15 bg-white/5"
              >
                <Image src={image} alt="" fill sizes="200px" className="object-cover" />
                <button
                  type="button"
                  onClick={() => onRemove("images", index)}
                  className="absolute right-2 top-2 rounded-md bg-terracotta p-1.5 text-white opacity-0 transition hover:brightness-110 focus:opacity-100 group-hover:opacity-100"
                  aria-label="Retirer la photo"
                  title="Retirer la photo"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-medium text-cream">
            <Video size={16} /> Vidéos
          </span>
          <UploadButton
            kind="videos"
            label="Vidéo"
            accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
            uploading={uploading}
            onUpload={onUpload}
          />
        </div>
        {videos.length === 0 ? (
          <p className="text-xs text-cream/45">Aucune vidéo.</p>
        ) : (
          <div className="space-y-2">
            {videos.map((video, index) => (
              <div
                key={`${video}-${index}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-gold/15 bg-white/5 px-3 py-2 text-xs text-cream/70"
              >
                <span className="min-w-0 truncate">{video}</span>
                <IconAction
                  label="Retirer la vidéo"
                  icon={Trash2}
                  tone="danger"
                  onClick={() => onRemove("videos", index)}
                />
              </div>
            ))}
          </div>
        )}
      </section>
      <p className="text-xs text-cream/40">
        Les fichiers importés sont ajoutés aussitôt ; les retraits sont pris en compte à
        l&apos;enregistrement.
      </p>
    </div>
  );
}

function UploadButton({
  kind,
  label,
  accept,
  uploading,
  onUpload
}: {
  kind: MediaKind;
  label: string;
  accept: string;
  uploading: MediaKind | null;
  onUpload: (kind: MediaKind, event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const busy = uploading === kind;
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gold/20 px-3 py-1.5 text-xs font-medium text-cream/70 transition hover:border-gold/50 hover:text-gold-light",
        uploading && "pointer-events-none opacity-50"
      )}
    >
      <input
        type="file"
        accept={accept}
        className="hidden"
        disabled={!!uploading}
        onChange={(event) => onUpload(kind, event)}
      />
      <Plus size={14} />
      {busy ? "Import…" : label}
    </label>
  );
}

function Modal({
  open,
  onClose,
  title,
  maxWidth = "max-w-2xl",
  children
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  maxWidth?: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-night/80 backdrop-blur-md"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 16 }}
            className={cn(
              "admin-panel relative max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-gold/15 p-5 text-cream shadow-2xl sm:p-6",
              maxWidth
            )}
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <h2 className="text-lg font-semibold text-cream">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="grid size-9 shrink-0 place-items-center rounded-lg border border-gold/15 text-cream/60 transition hover:border-gold/40 hover:text-gold-light"
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
