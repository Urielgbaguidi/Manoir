"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  AlertCircle,
  ArrowLeft,
  Images,
  Maximize2,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
  Video,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import { api, Room, RoomCategory } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import ImageLightbox from "@/components/ui/ImageLightbox";
import WhatsAppButton from "@/components/ui/WhatsAppButton";

const fallbackCategories: Record<string, RoomCategory> = {
  "appartement-vip": {
    id: 1,
    type: "vip",
    slug: "appartement-vip",
    label: "Appartement VIP",
    rank_label: "Categorie 1",
    short_description: "",
    full_description:
      "Les Appartements VIP reunissent les finitions les plus soignees du Manoir: volumes genereux, atmosphere feutree, terrasse ou vue privilegiee, salle de bain premium et services concus pour un sejour exclusif.",
    price_per_night: 30000,
    deposit_per_day: 500000,
    is_blocked: false,
    images: ["/assets/rooms/room1.jpg", "/assets/rooms/room2.jpg", "/assets/rooms/room3.jpg"],
    videos: [],
    units: [
      {
        id: 1,
        name: "VIP 3",
        slug: "appartement-vip-1",
        description:
          "Appartement VIP 3 du Manoir, pense pour un sejour intime avec finitions premium, salon elegant et galerie propre a cet appartement.",
        max_occupants: 2,
        apartment_number: 3,
        base_price: 30000,
        deposit: 500000,
        type: "vip",
        images: ["/assets/rooms/room1.jpg", "/assets/rooms/room2.jpg", "/assets/rooms/room3.jpg"],
        videos: [],
        equipments: [],
        status: "available",
        created_at: "",
        updated_at: ""
      },
      {
        id: 2,
        name: "VIP 7",
        slug: "appartement-vip-2",
        description:
          "Appartement VIP 7 du Manoir, plus exclusif, avec ambiance feutree, confort renforce et galerie dediee.",
        max_occupants: 2,
        apartment_number: 7,
        base_price: 40000,
        deposit: 500000,
        type: "vip",
        images: ["/assets/rooms/room2.jpg", "/assets/rooms/room1.jpg", "/assets/rooms/room4.jpg"],
        videos: [],
        equipments: [],
        status: "available",
        created_at: "",
        updated_at: ""
      }
    ],
    created_at: "",
    updated_at: ""
  },
  "appartement-2-chambres": {
    id: 2,
    type: "deux_chambres",
    slug: "appartement-2-chambres",
    label: "Appartement 2 Chambres",
    rank_label: "Categorie 2",
    short_description: "",
    full_description:
      "Les Appartements 2 Chambres offrent un bel equilibre entre espace, confort et fonctionnalite. Chaque unite propose deux chambres separees, un salon convivial, une cuisine equipee et des espaces pratiques.",
    price_per_night: 118000,
    deposit_per_day: 300000,
    is_blocked: false,
    images: ["/assets/rooms/room4.jpg", "/assets/rooms/room3.jpg", "/assets/rooms/room1.jpg"],
    videos: [],
    created_at: "",
    updated_at: ""
  },
  "appartement-1-chambre": {
    id: 3,
    type: "une_chambre",
    slug: "appartement-1-chambre",
    label: "Appartement 1 Chambre",
    rank_label: "Categorie 3",
    short_description: "",
    full_description:
      "Les Appartements 1 Chambre privilegient l'intimite et la fluidite du quotidien. Ils combinent une chambre confortable, un salon agreable et une kitchenette moderne.",
    price_per_night: 85000,
    deposit_per_day: 200000,
    is_blocked: false,
    images: ["/assets/rooms/room3.jpg", "/assets/rooms/room1.jpg", "/assets/rooms/room2.jpg"],
    videos: [],
    created_at: "",
    updated_at: ""
  }
};

const fallbackByType: Record<string, string> = {
  vip: "appartement-vip",
  deux_chambres: "appartement-2-chambres",
  une_chambre: "appartement-1-chambre"
};

const formatCurrency = (value: number) => `${value.toLocaleString("fr-FR")} F`;
const todayString = () => {
  // Date LOCALE (et non UTC) pour rester alignée avec le fuseau du serveur (Africa/Porto-Novo).
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const dayDiff = (from: string, to: string) => {
  if (!from || !to) return 0;
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
};

const roomDisplayName = (room: Room) => {
  if (room.type === "vip" && room.apartment_number) {
    return `Appartement VIP ${room.apartment_number}`;
  }

  return room.name.toLowerCase().startsWith("appartement") ? room.name : `Appartement ${room.name}`;
};

const videoPreviewSrc = (video: string) => (video.includes("#") ? video : `${video}#t=0.1`);

export default function RoomCategoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const { user } = useAuth();
  const { showToast } = useToast();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoFrameRef = useRef<HTMLDivElement | null>(null);

  const [category, setCategory] = useState<RoomCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [specialRequests, setSpecialRequests] = useState("");
  const [guests, setGuests] = useState(2);
  const [assignedRoom, setAssignedRoom] = useState<Room | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  const units = useMemo(() => {
    const rawUnits = category?.units ?? [];

    if (category?.type !== "vip") {
      return rawUnits;
    }

    const fallbackVipUnits = fallbackCategories["appartement-vip"].units ?? [];

    return fallbackVipUnits.map((fallbackUnit) => {
      const apiUnit = rawUnits.find(
        (unit) =>
          unit.slug === fallbackUnit.slug ||
          unit.name.toLowerCase() === fallbackUnit.name.toLowerCase()
      );

      if (!apiUnit) {
        return fallbackUnit;
      }

      return {
        ...fallbackUnit,
        ...apiUnit,
        description: apiUnit.description || fallbackUnit.description,
        base_price: apiUnit.base_price ?? fallbackUnit.base_price,
        deposit: apiUnit.deposit ?? fallbackUnit.deposit,
        apartment_number: apiUnit.apartment_number ?? fallbackUnit.apartment_number,
        images: apiUnit.images?.length ? apiUnit.images : fallbackUnit.images,
        videos: apiUnit.videos?.length ? apiUnit.videos : fallbackUnit.videos,
        equipments: apiUnit.equipments?.length ? apiUnit.equipments : fallbackUnit.equipments
      };
    });
  }, [category]);
  const selectedUnitSlug = searchParams.get("unit");
  const selectedUnit = useMemo(
    () =>
      units.find(
        (unit) => unit.slug === selectedUnitSlug || String(unit.id) === selectedUnitSlug
      ) ?? null,
    [units, selectedUnitSlug]
  );
  const activeRoom = category?.type === "vip" ? selectedUnit : null;
  const detailTitle = activeRoom ? roomDisplayName(activeRoom) : (category?.label ?? "Appartement");
  const detailDescription = activeRoom?.description || category?.full_description || "";
  const pricePerNight = activeRoom?.base_price ?? category?.price_per_night ?? 0;
  const depositPerDay = activeRoom?.deposit ?? category?.deposit_per_day ?? 0;
  const maxGuests = activeRoom?.max_occupants ?? (category?.type === "deux_chambres" ? 4 : 2);
  const activeRoomBlocked = Boolean(
    category?.type === "vip" && activeRoom && activeRoom.status !== "available"
  );
  const reservationBlocked = Boolean(category?.is_blocked || activeRoomBlocked);

  useEffect(() => {
    const loadCategory = async () => {
      setLoading(true);
      setActiveImageIndex(0);
      setAvailable(null);
      setAssignedRoom(null);
      setShowForm(false);
      setSelectedVideo(null);

      try {
        const data = await api.getRoomCategory(slug);
        setCategory(data);
      } catch (error) {
        console.error("Erreur lors du chargement de la categorie:", error);
        const fallbackKey = fallbackCategories[slug] ? slug : fallbackByType[slug];
        setCategory(fallbackKey ? fallbackCategories[fallbackKey] : null);
      } finally {
        setLoading(false);
      }
    };

    if (slug) loadCategory();
  }, [slug]);

  useEffect(() => {
    if (!selectedVideo) return;

    setVideoPlaying(false);
    setVideoCurrentTime(0);
    setVideoDuration(0);
    setVideoMuted(false);

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedVideo(null);
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedVideo]);

  const formatVideoTime = (seconds: number) => {
    const safeSeconds = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = Math.floor(safeSeconds % 60);

    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  };

  const toggleVideoPlayback = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  };

  const toggleVideoMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setVideoMuted(video.muted);
  };

  const handleVideoSeek = (event: ChangeEvent<HTMLInputElement>) => {
    const nextTime = Number(event.target.value);

    if (videoRef.current) {
      videoRef.current.currentTime = nextTime;
    }

    setVideoCurrentTime(nextTime);
  };

  const handleVideoFullscreen = async () => {
    const frame = videoFrameRef.current;
    if (!frame) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await frame.requestFullscreen();
      }
    } catch {
      showToast("Le plein ecran n'est pas disponible pour cette video.", "error");
    }
  };

  useEffect(() => {
    const verify = async () => {
      if (!category || !checkIn || !checkOut) {
        setAvailable(null);
        setAssignedRoom(null);
        return;
      }

      if (new Date(checkOut) <= new Date(checkIn)) {
        setAvailable(false);
        setAssignedRoom(null);
        return;
      }

      setChecking(true);
      try {
        const result = await api.checkCategoryAvailability(
          category.slug,
          checkIn,
          checkOut,
          activeRoom?.id
        );
        setAvailable(result.available);
        setAssignedRoom(result.available_room ?? activeRoom ?? null);
      } catch (error) {
        console.error("Erreur lors de la verification:", error);
        setAvailable(null);
        setAssignedRoom(null);
        showToast("Impossible de verifier la disponibilite pour le moment.", "error");
      } finally {
        setChecking(false);
      }
    };

    verify();
  }, [category, activeRoom, checkIn, checkOut, showToast]);

  useEffect(() => {
    if (
      searchParams.get("reserve") === "1" &&
      user &&
      category &&
      !category.is_blocked &&
      !activeRoomBlocked &&
      (category.type !== "vip" || activeRoom)
    ) {
      setShowForm(true);
      setTimeout(
        () =>
          document
            .getElementById("reservation")
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        50
      );
    }
  }, [searchParams, user, category, activeRoom, activeRoomBlocked]);

  const images = activeRoom?.images?.length
    ? activeRoom.images
    : category?.images?.length
      ? category.images
      : ["/assets/rooms/room1.jpg"];
  const videos = activeRoom?.videos?.length ? activeRoom.videos : (category?.videos ?? []);
  const activeImage = images[activeImageIndex] ?? images[0];

  const nights = useMemo(() => dayDiff(checkIn, checkOut), [checkIn, checkOut]);
  // Caution basée sur la durée du séjour (nuits) — alignée avec le backend.
  const depositAmount = nights * depositPerDay;
  const stayAmount = nights * pricePerNight;

  const beginReservation = () => {
    if (!category) return;

    if (category.is_blocked) {
      showToast("Cette categorie est indisponible pour le moment.", "info");
      return;
    }

    if (activeRoomBlocked) {
      showToast("Cet appartement VIP est indisponible pour le moment.", "info");
      return;
    }

    if (!user) {
      showToast("Creez votre compte pour continuer la demande de reservation.", "info");
      const unitQuery = activeRoom ? `unit=${activeRoom.slug}&` : "";
      router.push(
        `/auth/register?redirect=${encodeURIComponent(`/rooms/${category.slug}?${unitQuery}reserve=1`)}`
      );
      return;
    }

    setShowForm(true);
    setTimeout(
      () =>
        document
          .getElementById("reservation")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50
    );
  };

  const handleReservation = async () => {
    if (!category) return;

    if (!checkIn || !checkOut) {
      showToast("Choisissez vos dates avant de lancer la demande.", "info");
      return;
    }

    if (new Date(checkOut) <= new Date(checkIn)) {
      showToast("La date de depart doit etre posterieure a la date d'arrivee.", "error");
      return;
    }

    if (activeRoomBlocked) {
      showToast("Cet appartement VIP est indisponible pour le moment.", "info");
      return;
    }

    if (available !== true) {
      showToast("Cette categorie n'est pas disponible sur ces dates.", "info");
      return;
    }

    setReserving(true);

    try {
      const response = await api.createReservation({
        category_type: category.type,
        room_id: activeRoom?.id,
        check_in: checkIn,
        check_out: checkOut,
        guests,
        special_requests: specialRequests
      });
      showToast(response.message || "Votre demande est en cours d'examen.", "success");
      // On reste connecté : redirection vers l'espace client (plus de déconnexion forcée).
      router.push("/espace-client?message=reservation-sent");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Une erreur est survenue.", "error");
    } finally {
      setReserving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-night">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-gold border-t-transparent" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-night px-6">
        <div className="max-w-md space-y-4 text-center">
          <AlertCircle className="mx-auto h-16 w-16 text-cream/35" />
          <h1 className="font-display text-4xl font-bold uppercase text-cream">
            Categorie introuvable
          </h1>
          <p className="text-cream/60">
            Cette categorie n'existe pas ou a ete retiree du catalogue.
          </p>
          <button
            type="button"
            onClick={() => router.push("/rooms")}
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-br from-gold-light to-gold px-7 py-3.5 text-xs font-bold uppercase tracking-[0.22em] text-night transition hover:brightness-105"
          >
            Retour aux appartements
          </button>
        </div>
      </div>
    );
  }

  if (category.type === "vip" && !selectedUnit) {
    const vipUnits = units;

    return (
      <main className="relative min-h-screen px-6 py-32 text-cream md:px-10">
        <div className="mx-auto max-w-7xl">
          <nav className="mb-10 flex items-center gap-2 text-xs text-cream/60">
            <Link
              href="/rooms"
              className="inline-flex items-center gap-2 transition hover:text-gold-light"
            >
              <ArrowLeft size={14} />
              Appartements
            </Link>
            <span>/</span>
            <span className="text-cream/70">Appartement VIP</span>
          </nav>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="mb-12 max-w-3xl"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/15 bg-white/5 px-4 py-2 backdrop-blur-md">
              <Sparkles className="h-4 w-4 text-cream" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-cream">
                Selection VIP
              </span>
            </div>
            <h1 className="mb-5 font-display text-4xl font-bold uppercase tracking-tight text-cream md:text-6xl">
              Choisir un Appartement VIP
            </h1>
            <p className="text-lg leading-8 text-cream/70">
              Les deux appartements VIP ont chacun leurs photos, leurs videos, leur description et
              leur prix par nuit.
            </p>
          </motion.div>

          <div className="grid gap-7 lg:grid-cols-2">
            {vipUnits.map((unit, index) => {
              const isUnitBlocked = category.is_blocked || unit.status !== "available";
              const card = (
                <article
                  className={`glass-warm glass-edge flex h-full flex-col overflow-hidden rounded-[1.6rem] transition duration-500 ${
                    isUnitBlocked ? "opacity-65" : "glass-hover"
                  }`}
                >
                  <div className="relative aspect-[16/10] overflow-hidden bg-night">
                    <Image
                      src={unit.images?.[0] || category.images?.[0] || "/assets/rooms/room1.jpg"}
                      alt={roomDisplayName(unit)}
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className={`object-cover transition duration-700 ${isUnitBlocked ? "grayscale" : "group-hover:scale-105"}`}
                      priority={index === 0}
                    />
                    <div className="absolute inset-0 bg-night/30 transition group-hover:bg-night/10" />
                    {isUnitBlocked && (
                      <span className="absolute left-5 top-5 rounded-full border border-terracotta/25 bg-terracotta px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-cream">
                        Indisponible pour le moment
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-6">
                    <h2 className="mb-3 font-display text-3xl font-bold uppercase tracking-tight text-cream">
                      {roomDisplayName(unit)}
                    </h2>
                    <p className="min-h-[4rem] text-[15px] leading-6 text-cream/70">
                      {unit.description}
                    </p>

                    <div className="mt-6 flex items-end justify-between gap-4 border-t border-gold/15 pt-5">
                      <div>
                        <span className="block text-[10px] font-bold uppercase tracking-widest text-gold/80">
                          Prix par nuit
                        </span>
                        <span className="font-display text-2xl font-bold text-cream">
                          {formatCurrency(unit.base_price)}
                        </span>
                        <span className="ml-1 text-xs font-medium text-cream/60">/ nuit</span>
                      </div>
                      <span
                        className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-wider transition ${
                          isUnitBlocked
                            ? "bg-white/10 text-cream/50"
                            : "bg-gradient-to-br from-gold-light to-gold text-night group-hover:brightness-105"
                        }`}
                      >
                        <Images size={14} />
                        {isUnitBlocked ? "Indisponible" : "Voir les photos"}
                      </span>
                    </div>
                  </div>
                </article>
              );

              return (
                <motion.div
                  key={unit.slug}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.08, duration: 0.5 }}
                >
                  {isUnitBlocked ? (
                    <div className="block h-full cursor-not-allowed">{card}</div>
                  ) : (
                    <Link
                      href={`/rooms/${category.slug}?unit=${unit.slug}`}
                      className="group block h-full"
                    >
                      {card}
                    </Link>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen px-6 py-32 text-cream md:px-10">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mb-10">
            <nav className="mb-6 flex items-center gap-2 text-xs text-cream/60">
              <Link
                href="/rooms"
                className="inline-flex items-center gap-2 transition hover:text-gold-light"
              >
                <ArrowLeft size={14} />
                Appartements
              </Link>
              <span>/</span>
              <span className="text-cream/70">{detailTitle}</span>
            </nav>

            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/15 bg-white/5 px-4 py-2 backdrop-blur-md">
              <Sparkles className="h-4 w-4 text-cream" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-cream">
                {category.rank_label}
              </span>
            </div>

            <div className="grid gap-8 lg:grid-cols-[1fr_0.42fr] lg:items-end">
              <div>
                <h1 className="mb-5 font-display text-4xl font-bold uppercase tracking-tight text-cream md:text-6xl">
                  {detailTitle}
                </h1>
                <p className="max-w-3xl text-lg leading-8 text-cream/70">{detailDescription}</p>
              </div>

              <div className="glass-warm glass-edge grid grid-cols-2 gap-3 rounded-2xl p-5">
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-gold/80">
                    Prix par nuit
                  </span>
                  <span className="mt-1 block font-display text-2xl font-bold text-cream">
                    {formatCurrency(pricePerNight)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-gold/80">
                    Caution par jour
                  </span>
                  <span className="mt-1 block font-display text-2xl font-bold text-cream">
                    {formatCurrency(depositPerDay)}
                  </span>
                </div>
                <div className="col-span-2 flex items-center justify-between border-t border-gold/15 pt-4 text-sm text-cream/70">
                  {reservationBlocked ? (
                    <span className="rounded-full border border-terracotta/20 bg-terracotta/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-terracotta">
                      {activeRoomBlocked
                        ? "Appartement indisponible pour le moment"
                        : "Indisponible pour le moment"}
                    </span>
                  ) : (
                    <span className="text-cream/60">Galerie et demande de sejour</span>
                  )}
                  <button
                    type="button"
                    disabled={reservationBlocked}
                    onClick={beginReservation}
                    className="rounded-full bg-gradient-to-br from-gold-light to-gold px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-night transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Réserver
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            <div className="space-y-10">
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wider text-cream">
                    <Images size={20} />
                    Galerie photos
                  </h2>
                  <span className="text-xs font-semibold uppercase tracking-wider text-gold/80">
                    {images.length} photo{images.length > 1 ? "s" : ""}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setLightboxIndex(activeImageIndex)}
                  aria-label="Agrandir la photo"
                  className="group relative block aspect-video w-full cursor-zoom-in overflow-hidden rounded-2xl border border-gold/15 bg-white/5"
                >
                  <Image
                    src={activeImage}
                    alt={`${detailTitle} galerie`}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 60vw"
                    className="object-cover transition duration-700 group-hover:scale-105"
                  />
                  <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full border border-gold/30 bg-night/60 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-cream opacity-0 backdrop-blur-md transition group-hover:opacity-100">
                    <Maximize2 size={12} /> Agrandir
                  </span>
                </button>

                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {images.map((image, index) => (
                    <button
                      key={`${image}-${index}`}
                      type="button"
                      onClick={() => setActiveImageIndex(index)}
                      aria-label={`Voir la photo ${index + 1}`}
                      className={`relative aspect-video overflow-hidden rounded-xl border-2 bg-night transition ${
                        activeImageIndex === index
                          ? "border-gold"
                          : "border-gold/15 opacity-65 hover:opacity-100"
                      }`}
                    >
                      <Image
                        src={image}
                        alt={`${detailTitle} miniature ${index + 1}`}
                        fill
                        sizes="160px"
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wider text-cream">
                  <Video size={20} />
                  Videos
                </h2>

                {videos.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {videos.map((video, index) => (
                      <button
                        key={`${video}-${index}`}
                        type="button"
                        onClick={() => setSelectedVideo(video)}
                        className="on-dark group relative aspect-video overflow-hidden rounded-2xl border border-gold/15 bg-night text-left shadow-sm transition hover:-translate-y-0.5 hover:border-gold/45 hover:shadow-xl"
                        aria-label={`Lire la video ${index + 1} ${detailTitle}`}
                      >
                        <video
                          muted
                          playsInline
                          preload="metadata"
                          className="h-full w-full bg-black object-contain"
                          onLoadedMetadata={(event) => {
                            const preview = event.currentTarget;
                            if (Number.isFinite(preview.duration) && preview.duration > 0.1) {
                              preview.currentTime = 0.1;
                            }
                          }}
                        >
                          <source src={videoPreviewSrc(video)} type="video/mp4" />
                        </video>
                        <span className="absolute inset-0 bg-night/30 transition group-hover:bg-night/10" />
                        <span className="absolute inset-0 flex items-center justify-center">
                          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-cream/40 bg-bark/75 text-cream shadow-2xl backdrop-blur-sm transition group-hover:scale-105 group-hover:bg-bark">
                            <Play size={24} fill="currentColor" />
                          </span>
                        </span>
                        <span className="absolute bottom-4 left-4 rounded-full border border-cream/25 bg-bark/75 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-cream backdrop-blur-sm">
                          Video {index + 1}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-gold/20 bg-white/5 p-8 text-[15px] leading-6 text-cream/70">
                    Les videos de cette categorie seront ajoutees prochainement.
                  </div>
                )}
              </section>
            </div>

            <aside id="reservation" className="scroll-mt-28">
              <div className="glass-dark glass-edge sticky top-28 space-y-6 rounded-3xl p-8">
                <div className="border-b border-gold/15 pb-5">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gold/80">
                    Demande de reservation
                  </span>
                  <h2 className="font-display text-3xl font-bold uppercase tracking-tight text-cream">
                    {detailTitle}
                  </h2>
                </div>

                {!showForm ? (
                  <div className="space-y-5">
                    <p className="text-[15px] leading-6 text-cream/70">
                      Lancez la demande pour choisir vos dates et envoyer vos informations a
                      l'equipe du Manoir.
                    </p>
                    <button
                      type="button"
                      disabled={reservationBlocked}
                      onClick={beginReservation}
                      className="flex w-full items-center justify-center rounded-full bg-gradient-to-br from-gold-light to-gold py-4 text-xs font-bold uppercase tracking-[0.25em] text-night transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {reservationBlocked ? "Indisponible" : "Réserver"}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div>
                        <label
                          htmlFor="check-in"
                          className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-gold/80"
                        >
                          Date d'arrivee
                        </label>
                        <input
                          id="check-in"
                          type="date"
                          value={checkIn}
                          onChange={(event) => setCheckIn(event.target.value)}
                          onClick={(event) =>
                            (event.currentTarget as HTMLInputElement).showPicker?.()
                          }
                          min={todayString()}
                          className="glass-input w-full rounded-xl px-4 py-3.5 text-sm outline-none cursor-pointer"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="check-out"
                          className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-gold/80"
                        >
                          Date de depart
                        </label>
                        <input
                          id="check-out"
                          type="date"
                          value={checkOut}
                          onChange={(event) => setCheckOut(event.target.value)}
                          onClick={(event) =>
                            (event.currentTarget as HTMLInputElement).showPicker?.()
                          }
                          min={checkIn || todayString()}
                          className="glass-input w-full rounded-xl px-4 py-3.5 text-sm outline-none cursor-pointer"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="guests"
                          className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-gold/80"
                        >
                          Voyageurs
                        </label>
                        <select
                          id="guests"
                          value={guests}
                          onChange={(event) => setGuests(Number(event.target.value))}
                          className="glass-input w-full rounded-xl px-4 py-3.5 text-sm outline-none cursor-pointer"
                        >
                          {Array.from({ length: maxGuests }, (_, index) => index + 1).map(
                            (count) => (
                              <option key={count} value={count} className="bg-night text-cream">
                                {count} voyageur{count > 1 ? "s" : ""}
                              </option>
                            )
                          )}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="special-requests"
                          className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-gold/80"
                        >
                          Demandes speciales
                        </label>
                        <textarea
                          id="special-requests"
                          value={specialRequests}
                          onChange={(event) => setSpecialRequests(event.target.value)}
                          rows={3}
                          placeholder="Ex: arrivee tardive, preference..."
                          className="glass-input w-full resize-none rounded-xl px-4 py-3 text-sm outline-none"
                        />
                      </div>
                    </div>

                    {checkIn && checkOut && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`rounded-2xl border p-5 text-xs leading-relaxed ${
                          available === true
                            ? "border-olive/40 bg-olive/15 text-olive-light"
                            : available === false
                              ? "border-terracotta/40 bg-terracotta/15 text-terracotta-light"
                              : "border-gold/15 bg-white/5 text-gold/80"
                        }`}
                      >
                        {checking ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            <span>Verification des disponibilites...</span>
                          </div>
                        ) : available === true ? (
                          <div className="space-y-3">
                            <p className="font-bold">
                              Disponible pour {nights} nuit{nights > 1 ? "s" : ""}
                            </p>
                            {assignedRoom?.apartment_number && category.type !== "vip" && (
                              <p className="rounded-xl border border-olive/25 bg-white/10 p-3 text-cream">
                                Appartement N°{assignedRoom.apartment_number} vous sera attribué
                                pour votre séjour.
                              </p>
                            )}
                            <div className="space-y-2 border-t border-olive/10 pt-3 text-cream">
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-[10px] uppercase tracking-wider text-cream/45">
                                  Caution ({nights} nuit
                                  {nights > 1 ? "s" : ""} x {formatCurrency(depositPerDay)})
                                </span>
                                <span className="font-display text-lg font-bold">
                                  {formatCurrency(depositAmount)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-[10px] uppercase tracking-wider text-cream/45">
                                  Sejour
                                </span>
                                <span className="font-display text-lg font-bold">
                                  {formatCurrency(stayAmount)}
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : available === false ? (
                          <p className="font-semibold">
                            Aucun appartement disponible pour ces dates. Veuillez choisir d'autres
                            dates.
                          </p>
                        ) : (
                          <p>Calcul des disponibilites...</p>
                        )}
                      </motion.div>
                    )}

                    <button
                      type="button"
                      disabled={reserving || checking || available !== true}
                      onClick={handleReservation}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-gold-light to-gold py-4 text-xs font-bold uppercase tracking-[0.25em] text-night transition duration-300 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {reserving ? (
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-night border-t-transparent" />
                      ) : (
                        "Envoyer la demande"
                      )}
                    </button>
                  </>
                )}

                <div className="flex items-center justify-center gap-2 border-t border-gold/15 pt-2 text-[10px] uppercase tracking-wider text-cream/40">
                  <ShieldCheck size={14} />
                  Validation admin sous 24h
                </div>
              </div>
            </aside>
          </div>
        </motion.div>
      </div>

      {selectedVideo && (
        <div
          className="on-dark fixed inset-x-0 bottom-0 top-[84px] z-[80] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={`Lecture video ${detailTitle}`}
          onClick={() => setSelectedVideo(null)}
        >
          <div
            ref={videoFrameRef}
            className="relative flex h-[calc(100vh-116px)] max-h-[720px] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-cream/15 bg-black shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-shrink-0 items-center justify-between border-b border-cream/10 bg-bark px-5 py-4 text-cream">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-cream/60">
                  Video
                </p>
                <h3 className="mt-1 font-display text-xl font-bold uppercase tracking-wide">
                  {detailTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVideo(null)}
                className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-cream bg-cream text-night shadow-lg transition hover:bg-white"
                aria-label="Fermer la video"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 items-center justify-center bg-black px-3 py-4">
              <video
                ref={videoRef}
                key={selectedVideo}
                autoPlay
                playsInline
                muted={videoMuted}
                onPlay={() => setVideoPlaying(true)}
                onPause={() => setVideoPlaying(false)}
                onLoadedMetadata={(event) => setVideoDuration(event.currentTarget.duration || 0)}
                onTimeUpdate={(event) => setVideoCurrentTime(event.currentTarget.currentTime || 0)}
                className="h-auto max-h-full w-auto max-w-full object-contain"
              >
                <source src={selectedVideo} type="video/mp4" />
                Votre navigateur ne supporte pas la lecture de videos.
              </video>
            </div>

            <div className="flex-shrink-0 border-t border-cream/10 bg-black px-5 py-4 text-cream">
              <input
                type="range"
                min={0}
                max={videoDuration || 0}
                step={0.1}
                value={Math.min(videoCurrentTime, videoDuration || videoCurrentTime)}
                onChange={handleVideoSeek}
                aria-label="Avancer ou reculer dans la video"
                className="h-1.5 w-full cursor-pointer accent-cream"
              />

              <div className="mt-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleVideoPlayback}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-cream/35 bg-cream text-night transition hover:bg-white"
                    aria-label={videoPlaying ? "Mettre la video en pause" : "Lire la video"}
                  >
                    {videoPlaying ? <Pause size={18} /> : <Play size={18} />}
                  </button>

                  <span className="text-xs font-semibold tabular-nums text-cream/80">
                    {formatVideoTime(videoCurrentTime)} / {formatVideoTime(videoDuration)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={toggleVideoMute}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-cream/35 bg-cream text-night transition hover:bg-white"
                    aria-label={videoMuted ? "Activer le son" : "Couper le son"}
                  >
                    {videoMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                  </button>

                  <button
                    type="button"
                    onClick={handleVideoFullscreen}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-cream/35 bg-cream text-night transition hover:bg-white"
                    aria-label="Afficher la video en plein ecran"
                  >
                    <Maximize2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ImageLightbox
        images={images}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
        alt={detailTitle}
      />

      <WhatsAppButton />
    </main>
  );
}
