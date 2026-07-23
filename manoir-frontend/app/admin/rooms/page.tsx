"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { api, Room, RoomCategory } from "@/lib/api";
import { motion } from "framer-motion";
import { Ban, Check, Image as ImageIcon, Plus, Save, Sparkles, Trash2, Video } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useToast } from "@/context/ToastContext";

type RoomDraft = Omit<Room, "images" | "videos" | "equipments"> & {
  images: string[];
  videos: string[];
  equipments: string[];
};

type Draft = Omit<RoomCategory, "units"> & {
  units?: RoomDraft[];
  newImage: string;
  newVideo: string;
};

const toRoomDraft = (room: Room): RoomDraft => ({
  ...room,
  images: room.images ?? [],
  videos: room.videos ?? [],
  equipments: room.equipments ?? []
});

const toDraft = (category: RoomCategory): Draft => ({
  ...category,
  images: category.images ?? [],
  videos: category.videos ?? [],
  units: category.units?.map(toRoomDraft) ?? [],
  newImage: "",
  newVideo: ""
});

const formatCurrency = (value: number) => `${value.toLocaleString("fr-FR")} F`;
const roomLabel = (room: RoomDraft) => {
  if (room.type === "vip" && room.apartment_number) {
    return `Appartement VIP ${room.apartment_number}`;
  }

  return room.name.toLowerCase().startsWith("appartement") ? room.name : `Appartement ${room.name}`;
};

export default function AdminRoomsPage() {
  const { user, loading: authLoading } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();

  const [categories, setCategories] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingType, setSavingType] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/auth/login");
      } else if (!user.is_admin) {
        router.push("/");
      }
    }
  }, [user, authLoading, router]);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAdminRoomCategories();
      setCategories(data.map(toDraft));
    } catch (error) {
      console.error("Erreur lors du chargement des categories:", error);
      showToast("Impossible de charger les categories.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (user && user.is_admin) {
      loadCategories();
    }
  }, [user, loadCategories]);

  const updateDraft = (type: string, changes: Partial<Draft>) => {
    setCategories((current) =>
      current.map((category) => (category.type === type ? { ...category, ...changes } : category))
    );
  };

  const removeMedia = (type: string, kind: "images" | "videos", index: number) => {
    const category = categories.find((item) => item.type === type);
    if (!category) return;

    updateDraft(type, {
      [kind]: category[kind].filter((_, itemIndex) => itemIndex !== index)
    } as Partial<Draft>);
  };

  const updateRoomDraft = (roomId: number, changes: Partial<RoomDraft>) => {
    setCategories((current) =>
      current.map((category) => ({
        ...category,
        units: category.units?.map((room) => (room.id === roomId ? { ...room, ...changes } : room))
      }))
    );
  };

  const replaceRoomDraft = (updatedRoom: Room) => {
    setCategories((current) =>
      current.map((category) => ({
        ...category,
        units: category.units?.map((room) =>
          room.id === updatedRoom.id ? toRoomDraft(updatedRoom) : room
        )
      }))
    );
  };

  const removeRoomMedia = (roomId: number, kind: "images" | "videos", index: number) => {
    const room = categories
      .flatMap((category) => category.units ?? [])
      .find((item) => item.id === roomId);
    if (!room) return;

    updateRoomDraft(roomId, {
      [kind]: room[kind].filter((_, itemIndex) => itemIndex !== index)
    } as Partial<RoomDraft>);
  };

  const handleMediaFileSelected = async (
    type: string,
    kind: "images" | "videos",
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    const uploadKey = `${type}-${kind}`;
    setUploadingMedia(uploadKey);

    try {
      const response = await api.uploadAdminRoomCategoryMedia(type, kind, file);
      setCategories((current) =>
        current.map((category) =>
          category.type === type
            ? { ...category, [kind]: response.category[kind] ?? category[kind] }
            : category
        )
      );
      showToast(response.message, "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Impossible d'ajouter le fichier.",
        "error"
      );
    } finally {
      setUploadingMedia(null);
    }
  };

  const handleRoomMediaFileSelected = async (
    roomId: number,
    kind: "images" | "videos",
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    const uploadKey = `room-${roomId}-${kind}`;
    setUploadingMedia(uploadKey);

    try {
      const response = await api.uploadAdminRoomMedia(roomId, kind, file);
      replaceRoomDraft(response.room);
      showToast(response.message, "success");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Impossible d'ajouter le fichier.",
        "error"
      );
    } finally {
      setUploadingMedia(null);
    }
  };

  const saveCategory = async (category: Draft) => {
    setSavingType(category.type);
    try {
      await api.updateAdminRoomCategory(category.type, {
        label: category.label,
        rank_label: category.rank_label,
        short_description: category.short_description,
        full_description: category.full_description,
        price_per_night: Number(category.price_per_night),
        deposit_per_day: Number(category.deposit_per_day),
        is_blocked: category.is_blocked,
        images: category.images,
        videos: category.videos
      });
      showToast("Categorie mise a jour avec succes.", "success");
      loadCategories();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Impossible de mettre a jour la categorie.",
        "error"
      );
    } finally {
      setSavingType(null);
    }
  };

  const saveRoom = async (room: RoomDraft) => {
    setSavingType(`room-${room.id}`);
    try {
      const response = await api.updateAdminRoom(room.id, {
        name: room.name,
        description: room.description,
        max_occupants: room.max_occupants,
        apartment_number: room.apartment_number,
        base_price: Number(room.base_price),
        deposit: Number(room.deposit ?? 0),
        type: room.type,
        equipments: room.equipments,
        images: room.images,
        videos: room.videos,
        status: room.status
      });

      replaceRoomDraft(response.room);
      showToast(`${roomLabel(room)} mis a jour avec succes.`, "success");
      loadCategories();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Impossible de mettre a jour l'appartement.",
        "error"
      );
    } finally {
      setSavingType(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-night">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gold border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="relative min-h-screen px-6 py-32 text-cream md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 flex flex-col items-start justify-between gap-6 border-b border-gold/15 pb-8 md:flex-row md:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/25 bg-white/5 px-4 py-2 backdrop-blur-md">
              <Sparkles className="h-4 w-4 text-gold-light" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-cream/85">
                Portail Administrateur
              </span>
            </div>
            <h1 className="font-display text-4xl font-semibold uppercase tracking-tight text-cream md:text-5xl">
              Catalogue <span className="text-gradient-gold">Appartements</span>
            </h1>
          </div>

          <div className="flex flex-wrap gap-4 text-xs font-black uppercase tracking-wider">
            <Link
              href="/admin"
              className="border border-gold/20 px-5 py-3 text-gold/80 transition hover:border-gold hover:text-gold-light"
            >
              Reservations
            </Link>
            <Link
              href="/admin/rooms"
              className="border border-gold bg-gradient-to-br from-gold-light to-gold px-5 py-3 text-night transition"
            >
              Appartements
            </Link>
            <Link
              href="/admin/users"
              className="border border-gold/20 px-5 py-3 text-gold/80 transition hover:border-gold hover:text-gold-light"
            >
              Utilisateurs
            </Link>
          </div>
        </div>

        <div className="grid gap-8">
          {categories.map((category, index) => (
            <motion.section
              key={category.type}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06, duration: 0.45 }}
              className="glass-dark glass-edge rounded-3xl p-6 md:p-8"
            >
              <div className="mb-8 flex flex-col justify-between gap-5 border-b border-gold/15 pb-6 lg:flex-row lg:items-start">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="font-display text-3xl font-bold uppercase tracking-tight text-cream">
                      {category.label}
                    </h2>
                    <span
                      className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                        category.is_blocked
                          ? "border-terracotta/40 bg-terracotta/15 text-terracotta-light"
                          : "border-olive/40 bg-olive/15 text-olive-light"
                      }`}
                    >
                      {category.is_blocked ? "Indisponible pour le moment" : "Disponible"}
                    </span>
                  </div>
                  <p className="max-w-3xl text-sm leading-6 text-cream/70">
                    {category.short_description}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => updateDraft(category.type, { is_blocked: !category.is_blocked })}
                    className={`inline-flex items-center gap-2 rounded-xl border px-4 py-3 text-[10px] font-black uppercase tracking-wider transition ${
                      category.is_blocked
                        ? "border-olive/40 text-olive-light hover:bg-olive/10"
                        : "border-terracotta/40 text-terracotta-light hover:bg-terracotta/10"
                    }`}
                  >
                    {category.is_blocked ? <Check size={14} /> : <Ban size={14} />}
                    {category.is_blocked ? "Debloquer" : "Bloquer"}
                  </button>
                  <button
                    type="button"
                    disabled={savingType === category.type}
                    onClick={() => saveCategory(category)}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-gold-light to-gold px-5 py-3 text-[10px] font-black uppercase tracking-wider text-night transition hover:brightness-105 disabled:opacity-50"
                  >
                    <Save size={14} />
                    {savingType === category.type ? "Enregistrement..." : "Enregistrer"}
                  </button>
                </div>
              </div>

              <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className="block text-[10px] font-bold uppercase tracking-widest text-gold/80">
                        Prix par nuit
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={category.price_per_night}
                        onChange={(event) =>
                          updateDraft(category.type, {
                            price_per_night: Number(event.target.value)
                          })
                        }
                        className="glass-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                      />
                      <span className="block text-xs text-cream/45">
                        {formatCurrency(Number(category.price_per_night || 0))}
                      </span>
                    </label>

                    <label className="space-y-2">
                      <span className="block text-[10px] font-bold uppercase tracking-widest text-gold/80">
                        Caution par jour (N)
                      </span>
                      <input
                        type="number"
                        min={0}
                        value={category.deposit_per_day}
                        onChange={(event) =>
                          updateDraft(category.type, {
                            deposit_per_day: Number(event.target.value)
                          })
                        }
                        className="glass-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                      />
                      <span className="block text-xs text-cream/45">
                        {formatCurrency(Number(category.deposit_per_day || 0))} / jour
                      </span>
                    </label>
                  </div>

                  <label className="space-y-2 block">
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-gold/80">
                      Description courte
                    </span>
                    <textarea
                      rows={3}
                      value={category.short_description}
                      onChange={(event) =>
                        updateDraft(category.type, { short_description: event.target.value })
                      }
                      className="glass-input w-full resize-none rounded-xl px-4 py-3 text-sm leading-6 outline-none"
                    />
                  </label>

                  <label className="space-y-2 block">
                    <span className="block text-[10px] font-bold uppercase tracking-widest text-gold/80">
                      Description complete
                    </span>
                    <textarea
                      rows={6}
                      value={category.full_description}
                      onChange={(event) =>
                        updateDraft(category.type, { full_description: event.target.value })
                      }
                      className="glass-input w-full resize-none rounded-xl px-4 py-3 text-sm leading-6 outline-none"
                    />
                  </label>
                </div>

                <div className="space-y-8">
                  <section className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-cream">
                      <ImageIcon size={18} />
                      Photos
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {category.images.map((image, imageIndex) => (
                        <div
                          key={`${image}-${imageIndex}`}
                          className="group relative aspect-video overflow-hidden rounded-2xl border border-gold/15 bg-white/5"
                        >
                          <Image
                            src={image}
                            alt={`${category.label} ${imageIndex + 1}`}
                            fill
                            sizes="360px"
                            className="object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeMedia(category.type, "images", imageIndex)}
                            className="absolute right-3 top-3 rounded-lg bg-terracotta p-2 text-cream opacity-0 transition hover:brightness-110 group-hover:opacity-100"
                            aria-label="Supprimer la photo"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end">
                      <input
                        id={`photo-upload-${category.type}`}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/avif"
                        className="hidden"
                        disabled={uploadingMedia === `${category.type}-images`}
                        onChange={(event) =>
                          handleMediaFileSelected(category.type, "images", event)
                        }
                      />
                      <label
                        htmlFor={`photo-upload-${category.type}`}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gold/25 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-cream transition hover:border-gold/50 hover:text-gold-light"
                      >
                        <Plus size={14} />
                        {uploadingMedia === `${category.type}-images` ? "Import..." : "Photo"}
                      </label>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-cream">
                      <Video size={18} />
                      Videos
                    </div>
                    <div className="space-y-2">
                      {category.videos.length === 0 ? (
                        <p className="rounded-2xl border border-dashed border-gold/20 bg-white/5 p-5 text-xs text-cream/45">
                          Aucune video ajoutee pour cette categorie.
                        </p>
                      ) : (
                        category.videos.map((video, videoIndex) => (
                          <div
                            key={`${video}-${videoIndex}`}
                            className="flex items-center justify-between gap-3 rounded-xl border border-gold/15 bg-white/5 px-4 py-3 text-xs text-cream/70"
                          >
                            <span className="min-w-0 truncate">{video}</span>
                            <button
                              type="button"
                              onClick={() => removeMedia(category.type, "videos", videoIndex)}
                              className="text-terracotta-light transition hover:text-terracotta"
                              aria-label="Supprimer la video"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                    <div className="flex justify-end">
                      <input
                        id={`video-upload-${category.type}`}
                        type="file"
                        accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
                        className="hidden"
                        disabled={uploadingMedia === `${category.type}-videos`}
                        onChange={(event) =>
                          handleMediaFileSelected(category.type, "videos", event)
                        }
                      />
                      <label
                        htmlFor={`video-upload-${category.type}`}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gold/25 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-cream transition hover:border-gold/50 hover:text-gold-light"
                      >
                        <Plus size={14} />
                        {uploadingMedia === `${category.type}-videos` ? "Import..." : "Video"}
                      </label>
                    </div>
                  </section>
                </div>
              </div>

              {category.type === "vip" && (category.units?.length ?? 0) > 0 && (
                <div className="mt-8 border-t border-gold/15 pt-8">
                  <div className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-[0.24em] text-gold/70">
                        Types VIP
                      </span>
                      <h3 className="mt-1 font-display text-2xl font-bold uppercase tracking-tight text-cream">
                        Appartements VIP separes
                      </h3>
                    </div>
                    <p className="max-w-2xl text-sm leading-6 text-cream/60">
                      Les photos, videos, descriptions et prix modifies ici sont ceux que le client
                      voit apres avoir choisi VIP 3 ou VIP 7.
                    </p>
                  </div>

                  <div className="grid gap-6 xl:grid-cols-2">
                    {category.units?.map((room) => (
                      <section key={room.id} className="glass-warm glass-edge rounded-2xl p-5">
                        <div className="mb-5 flex flex-col justify-between gap-4 border-b border-gold/15 pb-5 md:flex-row md:items-start">
                          <div>
                            <h4 className="font-display text-2xl font-bold uppercase tracking-tight text-cream">
                              {roomLabel(room)}
                            </h4>
                            <span
                              className={`mt-2 inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                                room.status === "available"
                                  ? "border-olive/40 bg-olive/15 text-olive-light"
                                  : "border-terracotta/40 bg-terracotta/15 text-terracotta-light"
                              }`}
                            >
                              {room.status === "available"
                                ? "Disponible"
                                : "Indisponible pour le moment"}
                            </span>
                            <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-cream/45">
                              Appartement N°{room.apartment_number ?? "-"}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                updateRoomDraft(room.id, {
                                  status: room.status === "available" ? "unavailable" : "available"
                                })
                              }
                              className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-[10px] font-black uppercase tracking-wider transition ${
                                room.status === "available"
                                  ? "border-terracotta/40 text-terracotta-light hover:bg-terracotta/10"
                                  : "border-olive/40 text-olive-light hover:bg-olive/10"
                              }`}
                            >
                              {room.status === "available" ? (
                                <Ban size={14} />
                              ) : (
                                <Check size={14} />
                              )}
                              {room.status === "available" ? "Bloquer" : "Debloquer"}
                            </button>
                            <button
                              type="button"
                              disabled={savingType === `room-${room.id}`}
                              onClick={() => saveRoom(room)}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-gold-light to-gold px-5 py-3 text-[10px] font-black uppercase tracking-wider text-night transition hover:brightness-105 disabled:opacity-50"
                            >
                              <Save size={14} />
                              {savingType === `room-${room.id}`
                                ? "Enregistrement..."
                                : "Enregistrer"}
                            </button>
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <label className="space-y-2">
                            <span className="block text-[10px] font-bold uppercase tracking-widest text-gold/80">
                              Prix par nuit
                            </span>
                            <input
                              type="number"
                              min={0}
                              value={room.base_price}
                              onChange={(event) =>
                                updateRoomDraft(room.id, { base_price: Number(event.target.value) })
                              }
                              className="glass-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                            />
                            <span className="block text-xs text-cream/45">
                              {formatCurrency(Number(room.base_price || 0))}
                            </span>
                          </label>

                          <label className="space-y-2">
                            <span className="block text-[10px] font-bold uppercase tracking-widest text-gold/80">
                              Caution par jour
                            </span>
                            <input
                              type="number"
                              min={0}
                              value={room.deposit ?? 0}
                              onChange={(event) =>
                                updateRoomDraft(room.id, { deposit: Number(event.target.value) })
                              }
                              className="glass-input w-full rounded-xl px-4 py-3 text-sm outline-none"
                            />
                            <span className="block text-xs text-cream/45">
                              {formatCurrency(Number(room.deposit || 0))} / jour
                            </span>
                          </label>
                        </div>

                        <label className="mt-5 block space-y-2">
                          <span className="block text-[10px] font-bold uppercase tracking-widest text-gold/80">
                            Description de cet appartement
                          </span>
                          <textarea
                            rows={5}
                            value={room.description}
                            onChange={(event) =>
                              updateRoomDraft(room.id, { description: event.target.value })
                            }
                            className="glass-input w-full resize-none rounded-xl px-4 py-3 text-sm leading-6 outline-none"
                          />
                        </label>

                        <div className="mt-6 space-y-6">
                          <section className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-cream">
                              <ImageIcon size={18} />
                              Photos {roomLabel(room)}
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              {room.images.map((image, imageIndex) => (
                                <div
                                  key={`${room.id}-${image}-${imageIndex}`}
                                  className="group relative aspect-video overflow-hidden rounded-2xl border border-gold/15 bg-white/5"
                                >
                                  <Image
                                    src={image}
                                    alt={`${roomLabel(room)} ${imageIndex + 1}`}
                                    fill
                                    sizes="360px"
                                    className="object-cover"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeRoomMedia(room.id, "images", imageIndex)}
                                    className="absolute right-3 top-3 rounded-lg bg-terracotta p-2 text-cream opacity-0 transition hover:brightness-110 group-hover:opacity-100"
                                    aria-label="Supprimer la photo"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-end">
                              <input
                                id={`photo-upload-room-${room.id}`}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/avif"
                                className="hidden"
                                disabled={uploadingMedia === `room-${room.id}-images`}
                                onChange={(event) =>
                                  handleRoomMediaFileSelected(room.id, "images", event)
                                }
                              />
                              <label
                                htmlFor={`photo-upload-room-${room.id}`}
                                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gold/25 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-cream transition hover:border-gold/50 hover:text-gold-light"
                              >
                                <Plus size={14} />
                                {uploadingMedia === `room-${room.id}-images`
                                  ? "Import..."
                                  : "Photo"}
                              </label>
                            </div>
                          </section>

                          <section className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-cream">
                              <Video size={18} />
                              Videos {roomLabel(room)}
                            </div>
                            <div className="space-y-2">
                              {room.videos.length === 0 ? (
                                <p className="rounded-2xl border border-dashed border-gold/20 bg-white/5 p-5 text-xs text-cream/45">
                                  Aucune video ajoutee pour cet appartement.
                                </p>
                              ) : (
                                room.videos.map((video, videoIndex) => (
                                  <div
                                    key={`${room.id}-${video}-${videoIndex}`}
                                    className="flex items-center justify-between gap-3 rounded-xl border border-gold/15 bg-white/5 px-4 py-3 text-xs text-cream/70"
                                  >
                                    <span className="min-w-0 truncate">{video}</span>
                                    <button
                                      type="button"
                                      onClick={() => removeRoomMedia(room.id, "videos", videoIndex)}
                                      className="text-terracotta-light transition hover:text-terracotta"
                                      aria-label="Supprimer la video"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                            <div className="flex justify-end">
                              <input
                                id={`video-upload-room-${room.id}`}
                                type="file"
                                accept="video/mp4,video/webm,video/quicktime,video/x-msvideo"
                                className="hidden"
                                disabled={uploadingMedia === `room-${room.id}-videos`}
                                onChange={(event) =>
                                  handleRoomMediaFileSelected(room.id, "videos", event)
                                }
                              />
                              <label
                                htmlFor={`video-upload-room-${room.id}`}
                                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-gold/25 px-4 py-3 text-[10px] font-black uppercase tracking-wider text-cream transition hover:border-gold/50 hover:text-gold-light"
                              >
                                <Plus size={14} />
                                {uploadingMedia === `room-${room.id}-videos`
                                  ? "Import..."
                                  : "Video"}
                              </label>
                            </div>
                          </section>
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
              )}
            </motion.section>
          ))}
        </div>
      </div>
    </main>
  );
}
