"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Images,
  Mail,
  Maximize2,
  Pause,
  Play,
  ShieldCheck,
  Video,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import {
  api,
  ApiError,
  AvailabilitySuggestion,
  AvailableAlternative,
  OwnFreeWindow,
  Reservation,
  Room,
  RoomAvailability,
  RoomCategory
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import ImageLightbox from "@/components/ui/ImageLightbox";
import WhatsAppButton from "@/components/ui/WhatsAppButton";
import BookingStepper from "@/components/reservations/BookingStepper";
import {
  errorMessage,
  isRetryableError,
  useIdempotentIntent
} from "@/components/reservations/useIdempotentIntent";
import { reservationHref } from "@/lib/reservationDisplay";

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

  const base = room.name.toLowerCase().startsWith("appartement")
    ? room.name
    : `Appartement ${room.name}`;

  // Les appartements d'une meme categorie portent le meme nom en base
  // (« Appartement 2 Chambres » x4) : sans le numero, le client ne peut pas
  // les distinguer les uns des autres.
  return room.apartment_number ? `${base} · N°${room.apartment_number}` : base;
};

const videoPreviewSrc = (video: string) => (video.includes("#") ? video : `${video}#t=0.1`);

/** Délai avant la redirection vers le suivi, une fois la demande envoyée. */
const REDIRECT_AFTER_SENT_MS = 5000;

/** "2026-08-21" -> "21 août" */
const formatJour = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" });

/** Libellé court, pour la pastille posée sur la photo. */
const libelleCourt = (a: RoomAvailability) => (a.status === "occupied" ? "Occupé" : "Disponible");

/** Pastille posée sur la photo : opaque, pour rester lisible sur toute image. */
function AvailabilityBadge({ availability }: { availability?: RoomAvailability }) {
  if (!availability) return null;

  const occupe = availability.status === "occupied";

  return (
    <span
      className={`absolute left-4 top-4 inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-night/40 ${
        occupe ? "bg-terracotta" : "bg-olive"
      }`}
    >
      <span className="h-2 w-2 rounded-full bg-white/90" aria-hidden />
      {libelleCourt(availability)}
    </span>
  );
}

/** Étiquette simple « Disponible » / « Occupé » dans la fiche, sans date. */
function AvailabilityStrip({ availability }: { availability?: RoomAvailability }) {
  if (!availability) return null;

  const occupe = availability.status === "occupied";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-widest text-white ${
        occupe ? "bg-terracotta" : "bg-olive"
      }`}
    >
      <span className="h-2 w-2 rounded-full bg-white/90" aria-hidden />
      {libelleCourt(availability)}
    </span>
  );
}

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
  // Les dates peuvent arriver par l'URL : un creneau propose sur un autre
  // appartement renvoie ici avec les dates deja choisies, sinon le client
  // devrait les ressaisir apres avoir change de page.
  const [checkIn, setCheckIn] = useState(() => searchParams.get("check_in") ?? "");
  const [checkOut, setCheckOut] = useState(() => searchParams.get("check_out") ?? "");
  const [available, setAvailable] = useState<boolean | null>(null);
  // Appartements libres sur les memes dates, proposes quand la demande echoue.
  const [alternatives, setAlternatives] = useState<AvailableAlternative[]>([]);
  // Creneaux les plus proches, quand rien n'est libre sur toute la duree.
  const [suggestions, setSuggestions] = useState<AvailabilitySuggestion[]>([]);
  // Creneau libre de l'appartement consulte : il doit s'afficher meme quand
  // d'autres appartements sont libres sur les dates voulues.
  const [ownWindow, setOwnWindow] = useState<OwnFreeWindow | null>(null);
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
  // Parcours de demande : 0 = dates, 1 = informations, 2 = demande envoyée.
  const [formStep, setFormStep] = useState<0 | 1 | 2>(0);
  const [sentReservation, setSentReservation] = useState<Reservation | null>(null);
  const { keyFor, reset: resetIntent, run: runOnce } = useIdempotentIntent();
  const redirectTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (redirectTimer.current) window.clearTimeout(redirectTimer.current);
    },
    []
  );

  // Chaque appartement est choisi individuellement, quelle que soit sa
  // categorie : il a ses propres photos, videos, description et prix, tous
  // modifiables par l'administration.
  const units = useMemo(() => {
    const rawUnits = category?.units ?? [];
    const fallbackUnits = category ? (fallbackCategories[category.slug]?.units ?? []) : [];

    // Sans reponse de l'API, on affiche au moins le contenu de secours.
    if (rawUnits.length === 0) {
      return fallbackUnits;
    }

    // L'API fait foi : elle donne la liste et l'ordre des appartements. Le
    // contenu local ne sert qu'a combler un champ laisse vide en base.
    return rawUnits.map((apiUnit) => {
      const fallbackUnit = fallbackUnits.find(
        (unit) =>
          unit.slug === apiUnit.slug || unit.name.toLowerCase() === apiUnit.name.toLowerCase()
      );

      if (!fallbackUnit) {
        return apiUnit;
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
  const activeRoom = selectedUnit;
  const detailTitle = activeRoom ? roomDisplayName(activeRoom) : (category?.label ?? "Appartement");
  const detailDescription = activeRoom?.description || category?.full_description || "";
  const pricePerNight = activeRoom?.base_price ?? category?.price_per_night ?? 0;
  const maxGuests = activeRoom?.max_occupants ?? (category?.type === "deux_chambres" ? 4 : 2);
  const activeRoomBlocked = Boolean(activeRoom && activeRoom.status !== "available");
  const reservationBlocked = Boolean(category?.is_blocked || activeRoomBlocked);

  useEffect(() => {
    const loadCategory = async () => {
      setLoading(true);
      setActiveImageIndex(0);
      setAvailable(null);
      setAssignedRoom(null);
      setShowForm(false);
      setFormStep(0);
      setSentReservation(null);
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
        setAlternatives([]);
        setSuggestions([]);
        setOwnWindow(null);
        return;
      }

      if (new Date(checkOut) <= new Date(checkIn)) {
        setAvailable(false);
        setAssignedRoom(null);
        setAlternatives([]);
        setSuggestions([]);
        setOwnWindow(null);
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
        setAlternatives(result.alternatives ?? []);
        setSuggestions(result.suggestions ?? []);
        setOwnWindow(result.own_window ?? null);
      } catch (error) {
        console.error("Erreur lors de la verification:", error);
        setAvailable(null);
        setAssignedRoom(null);
        setAlternatives([]);
        setSuggestions([]);
        setOwnWindow(null);
        showToast("Impossible de vérifier la disponibilité pour le moment.", "error");
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
      user.email_verified_at !== null &&
      user.profile_completed !== false &&
      category &&
      !category.is_blocked &&
      !activeRoomBlocked &&
      activeRoom
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
  // Estimation : le serveur recalcule le montant et reste seul juge.
  const stayAmount = nights * pricePerNight;
  const guestCount = Math.max(1, Math.min(guests, maxGuests));

  /** Adresse de retour : la fiche, le formulaire ouvert et les dates conservées. */
  const returnPath = () => {
    if (!category) return "/rooms";
    const query = new URLSearchParams();
    if (activeRoom) query.set("unit", activeRoom.slug);
    if (checkIn) query.set("check_in", checkIn);
    if (checkOut) query.set("check_out", checkOut);
    query.set("reserve", "1");
    return `/rooms/${category.slug}?${query.toString()}`;
  };

  const goToEmailConfirmation = () =>
    router.push(
      `/auth/confirmer-email?email=${encodeURIComponent(user?.email ?? "")}&redirect=${encodeURIComponent(returnPath())}`
    );

  const goToPhoneStep = () =>
    router.push(`/auth/register?etape=telephone&redirect=${encodeURIComponent(returnPath())}`);

  const beginReservation = () => {
    if (!category) return;

    if (category.is_blocked) {
      showToast("Cette catégorie est indisponible pour le moment.", "error");
      return;
    }

    if (activeRoomBlocked) {
      showToast("Cet appartement est indisponible pour le moment.", "error");
      return;
    }

    if (!user) {
      showToast("Créez votre compte pour finaliser votre réservation.", "info");
      router.push(`/auth/register?redirect=${encodeURIComponent(returnPath())}`);
      return;
    }

    // Le serveur refuse de toute facon une demande venant d'une adresse non
    // confirmee ou d'un compte sans telephone : autant amener le client au bon
    // endroit plutot que de le laisser remplir un formulaire qui sera rejete.
    if (user.email_verified_at === null) {
      showToast("Confirmez votre adresse e-mail pour réserver.", "info");
      goToEmailConfirmation();
      return;
    }

    if (user.profile_completed === false) {
      showToast("Ajoutez votre numéro de téléphone pour réserver.", "info");
      goToPhoneStep();
      return;
    }

    setFormStep(0);
    setShowForm(true);
    setTimeout(
      () =>
        document
          .getElementById("reservation")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50
    );
  };

  /** Étape 1 -> 2 : les dates sont libres, on passe aux informations. */
  const continueToDetails = () => {
    if (!checkIn || !checkOut) {
      showToast("Choisissez vos dates avant de continuer.", "info");
      return;
    }
    if (available !== true) {
      showToast("Aucun appartement libre sur ces dates. Essayez d'autres dates.", "error");
      return;
    }
    setFormStep(1);
  };

  const handleReservation = () =>
    runOnce(async () => {
      if (!category) return;

      if (!checkIn || !checkOut) {
        showToast("Choisissez vos dates avant de lancer la demande.", "info");
        setFormStep(0);
        return;
      }

      if (new Date(checkOut) <= new Date(checkIn)) {
        showToast("La date de départ doit être après la date d'arrivée.", "error");
        setFormStep(0);
        return;
      }

      if (activeRoomBlocked) {
        showToast("Cet appartement est indisponible pour le moment.", "error");
        return;
      }

      if (available !== true) {
        showToast("Aucun appartement libre sur ces dates. Essayez d'autres dates.", "error");
        setFormStep(0);
        return;
      }

      const payload = {
        category_type: category.type,
        room_id: activeRoom?.id,
        check_in: checkIn,
        check_out: checkOut,
        guests: guestCount,
        special_requests: specialRequests.trim() || undefined
      };
      // Une clé par demande : un nouvel essai après une coupure réseau
      // réutilise la même, le serveur ne crée donc pas de doublon.
      const idempotencyKey = keyFor(JSON.stringify(payload));

      setReserving(true);

      try {
        const response = await api.createReservation(payload, idempotencyKey);
        resetIntent();
        setSentReservation(response.reservation);
        setFormStep(2);
        showToast("Demande envoyée. Vous serez prévenu par email dès sa validation.", "success");
        redirectTimer.current = window.setTimeout(
          () => router.push(reservationHref(response.reservation.id)),
          REDIRECT_AFTER_SENT_MS
        );
      } catch (error) {
        if (error instanceof ApiError && error.reason === "email_not_verified") {
          resetIntent();
          showToast("Confirmez votre adresse e-mail pour envoyer votre demande.", "info");
          goToEmailConfirmation();
          return;
        }
        if (error instanceof ApiError && error.reason === "phone_required") {
          resetIntent();
          showToast("Ajoutez votre numéro de téléphone pour envoyer votre demande.", "info");
          goToPhoneStep();
          return;
        }
        if (!isRetryableError(error)) resetIntent();
        showToast(errorMessage(error, "La demande n'a pas pu être envoyée."), "error");
      } finally {
        setReserving(false);
      }
    });

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

  if (!selectedUnit) {
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
            <span className="text-cream/70">{category.label}</span>
          </nav>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="mb-12 max-w-3xl"
          >
            <div className="mb-6 inline-flex items-center rounded-full border border-gold/15 bg-white/5 px-4 py-2 backdrop-blur-md">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-cream">
                {category.rank_label || "Selection"}
              </span>
            </div>
            <h1 className="mb-5 font-display text-4xl font-bold uppercase tracking-tight text-cream md:text-6xl">
              Choisir un {category.label}
            </h1>
            <p className="text-lg leading-8 text-cream/70">
              {vipUnits.length > 1
                ? `Les ${vipUnits.length} appartements de cette categorie ont chacun leurs photos, leurs videos, leur description et leur prix par nuit.`
                : "Cet appartement dispose de ses propres photos, videos, description et prix par nuit."}
            </p>
          </motion.div>

          <div className="grid gap-7 md:grid-cols-2">
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
                    {isUnitBlocked ? (
                      <span className="absolute left-5 top-5 rounded-full border border-terracotta/25 bg-terracotta px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-cream">
                        Indisponible pour le moment
                      </span>
                    ) : (
                      <AvailabilityBadge availability={unit.availability} />
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

            <div className="mb-6 inline-flex items-center rounded-full border border-gold/15 bg-white/5 px-4 py-2 backdrop-blur-md">
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
                    Paiement
                  </span>
                  <span className="mt-1 block font-display text-lg font-bold leading-tight text-cream">
                    Après validation
                  </span>
                  <span className="mt-0.5 block text-[11px] text-cream/50">demande gratuite</span>
                </div>
                {/* L'etat d'occupation est la premiere chose que cherche un
                    client sur une fiche : il precede donc l'appel a reserver. */}
                {!reservationBlocked && (
                  <div className="col-span-2">
                    <AvailabilityStrip availability={activeRoom?.availability} />
                  </div>
                )}

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
              <div className="glass-dark glass-edge !sticky top-28 space-y-6 rounded-3xl p-8">
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
                      Choisissez vos dates et envoyez votre demande à l&apos;équipe du Manoir. Elle
                      est gratuite : vous ne payez qu&apos;après sa validation.
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
                    <BookingStepper current={formStep} compact />

                    {formStep === 2 ? (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-5"
                      >
                        <div className="rounded-2xl border border-olive/40 bg-olive/15 p-5 text-center">
                          <CheckCircle2 className="mx-auto h-10 w-10 text-olive-light" />
                          <p className="mt-3 font-display text-xl font-bold text-cream">
                            Demande envoyée
                          </p>
                          <p className="mt-2 text-sm leading-6 text-cream/70">
                            Elle est maintenant{" "}
                            <strong className="text-cream">en attente de validation</strong> par
                            l&apos;équipe du Manoir.
                          </p>
                        </div>
                        <ul className="space-y-3 text-sm leading-6 text-cream/70">
                          <li className="flex gap-3">
                            <Mail size={16} className="mt-1 shrink-0 text-gold-light" />
                            Vous recevrez un email dès que votre demande sera validée.
                          </li>
                          <li className="flex gap-3">
                            <ShieldCheck size={16} className="mt-1 shrink-0 text-gold-light" />
                            Aucun paiement maintenant : le règlement du séjour s&apos;ouvrira dans
                            votre espace client après validation.
                          </li>
                        </ul>
                        {sentReservation && (
                          <Link
                            href={reservationHref(sentReservation.id)}
                            className="flex w-full items-center justify-center rounded-full bg-gradient-to-br from-gold-light to-gold py-4 text-xs font-bold uppercase tracking-[0.2em] text-night transition hover:brightness-105"
                          >
                            Suivre ma demande
                          </Link>
                        )}
                        <p className="text-center text-[11px] text-cream/45">
                          Redirection automatique vers votre espace client…
                        </p>
                      </motion.div>
                    ) : formStep === 1 ? (
                      <div className="space-y-5">
                        <div className="space-y-2 rounded-2xl border border-gold/15 bg-white/5 p-4 text-sm text-cream/75">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[10px] uppercase tracking-wider text-cream/45">
                              Appartement
                            </span>
                            <span className="text-right font-semibold text-cream">
                              {assignedRoom?.apartment_number
                                ? `N°${assignedRoom.apartment_number}`
                                : detailTitle}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-[10px] uppercase tracking-wider text-cream/45">
                              Dates
                            </span>
                            <span className="text-right">
                              {formatJour(checkIn)} → {formatJour(checkOut)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3 border-t border-gold/10 pt-2">
                            <span className="text-[10px] uppercase tracking-wider text-cream/45">
                              Séjour ({nights} nuit{nights > 1 ? "s" : ""})
                            </span>
                            <span className="font-display text-lg font-bold text-cream">
                              {formatCurrency(stayAmount)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setFormStep(0)}
                            disabled={reserving}
                            className="text-[11px] font-semibold text-gold-light underline underline-offset-4 disabled:opacity-50"
                          >
                            Modifier les dates
                          </button>
                        </div>

                        <div>
                          <label
                            htmlFor="guests"
                            className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-gold/80"
                          >
                            Nombre de voyageurs
                          </label>
                          <select
                            id="guests"
                            value={guestCount}
                            onChange={(event) => setGuests(Number(event.target.value))}
                            className="glass-input w-full cursor-pointer rounded-xl px-4 py-3.5 text-sm outline-none"
                          >
                            {Array.from({ length: maxGuests }, (_, index) => index + 1).map(
                              (count) => (
                                <option key={count} value={count}>
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
                            Demandes spéciales (facultatif)
                          </label>
                          <textarea
                            id="special-requests"
                            value={specialRequests}
                            onChange={(event) => setSpecialRequests(event.target.value)}
                            rows={3}
                            maxLength={1000}
                            placeholder="Ex : arrivée tardive, lit bébé..."
                            className="glass-input w-full resize-none rounded-xl px-4 py-3 text-sm outline-none"
                          />
                        </div>

                        <p className="rounded-2xl border border-gold/20 bg-white/5 p-4 text-[12px] leading-5 text-cream/75">
                          <strong className="text-cream">Rien à payer maintenant.</strong>{" "}
                          L&apos;équipe du Manoir étudie votre demande et vous prévient par email.
                          Vous réglerez ensuite le séjour en ligne (Mobile Money ou carte) depuis
                          votre espace client.
                        </p>

                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => setFormStep(0)}
                            disabled={reserving}
                            className="rounded-full border border-gold/25 px-5 py-4 text-xs font-bold uppercase tracking-[0.18em] text-cream/80 transition hover:bg-white/5 disabled:opacity-50"
                          >
                            Retour
                          </button>
                          <button
                            type="button"
                            disabled={reserving || checking || available !== true}
                            onClick={handleReservation}
                            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-br from-gold-light to-gold py-4 text-xs font-bold uppercase tracking-[0.2em] text-night transition duration-300 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {reserving ? (
                              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-night border-t-transparent" />
                            ) : (
                              "Envoyer la demande"
                            )}
                          </button>
                        </div>
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
                                {assignedRoom?.apartment_number && (
                                  <p className="rounded-xl border border-olive/25 bg-white/10 p-3 text-cream">
                                    Appartement N°{assignedRoom.apartment_number} proposé pour votre
                                    séjour.
                                  </p>
                                )}
                                <div className="space-y-2 border-t border-olive/10 pt-3 text-cream">
                                  <div className="flex items-center justify-between gap-4">
                                    <span className="text-[10px] uppercase tracking-wider text-cream/45">
                                      Sejour ({nights} nuit{nights > 1 ? "s" : ""})
                                    </span>
                                    <span className="font-display text-lg font-bold">
                                      {formatCurrency(stayAmount)}
                                    </span>
                                  </div>
                                  <p className="pt-1 text-[11px] leading-4 text-cream/50">
                                    Rien à payer aujourd&apos;hui : le séjour se règle en ligne une
                                    fois votre demande validée.
                                  </p>
                                </div>
                              </div>
                            ) : available === false ? (
                              <div className="space-y-3">
                                <p className="font-semibold">
                                  {alternatives.length > 0
                                    ? "Cet appartement n'est pas libre sur ces dates."
                                    : suggestions.length > 0
                                      ? `Aucun appartement n'est libre sur ces ${nights} nuit${nights > 1 ? "s" : ""} d'affilee. Voici ce qui est possible :`
                                      : "Aucun appartement disponible pour ces dates. Veuillez choisir d'autres dates."}
                                </p>

                                {/* Le creneau de l'appartement que le client
                                consulte. Affiche meme quand d'autres
                                appartements sont libres sur ces dates : sans
                                cela, il n'aurait d'autre choix que d'en
                                changer, alors qu'il tient peut-etre a
                                celui-ci. */}
                                {ownWindow && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCheckIn(ownWindow.starts_on);
                                      setCheckOut(ownWindow.ends_on);
                                    }}
                                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-olive/40 bg-olive/15 px-4 py-3 text-left transition hover:bg-olive/25"
                                  >
                                    <span className="text-cream">
                                      <span className="font-semibold">
                                        Cet appartement est libre du{" "}
                                        {formatJour(ownWindow.starts_on)} au{" "}
                                        {formatJour(ownWindow.ends_on)}
                                      </span>
                                      <span className="mt-0.5 block text-xs text-cream/60">
                                        Cliquez pour appliquer ces dates
                                      </span>
                                    </span>
                                    <span className="shrink-0 text-xs font-semibold text-olive-light">
                                      {ownWindow.nights} nuit{ownWindow.nights > 1 ? "s" : ""}
                                    </span>
                                  </button>
                                )}

                                {alternatives.length === 0 &&
                                  suggestions.filter((creneau) => creneau.id !== activeRoom?.id)
                                    .length > 0 && (
                                    <div className="space-y-2">
                                      <p className="text-[11px] uppercase tracking-wider text-cream/60">
                                        Autres appartements sur cette periode
                                      </p>
                                      <ul className="space-y-2">
                                        {suggestions
                                          .filter((creneau) => creneau.id !== activeRoom?.id)
                                          .map((creneau) => (
                                            <li key={creneau.id}>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  // Les dates partent dans l'URL : sans
                                                  // elles, le changement de page les
                                                  // effacerait et le client devrait
                                                  // tout ressaisir.
                                                  router.push(
                                                    `/rooms/${creneau.category_slug}?unit=${creneau.slug}` +
                                                      `&check_in=${creneau.starts_on}&check_out=${creneau.ends_on}&reserve=1`
                                                  );
                                                }}
                                                className="flex w-full items-center justify-between gap-3 rounded-xl border border-gold/25 bg-white/10 px-4 py-3 text-left transition hover:border-gold/50 hover:bg-white/15"
                                              >
                                                <span className="text-cream">
                                                  <span className="font-semibold">
                                                    Appartement N°{creneau.apartment_number}
                                                  </span>
                                                  <span className="ml-2 text-xs text-cream/60">
                                                    {creneau.category_label}
                                                  </span>
                                                  <span className="mt-0.5 block text-xs text-cream/70">
                                                    Libre du {formatJour(creneau.starts_on)} au{" "}
                                                    {formatJour(creneau.ends_on)}
                                                  </span>
                                                  <span className="mt-0.5 block text-[11px] text-cream/45">
                                                    Cliquez pour appliquer ces dates
                                                  </span>
                                                </span>
                                                <span className="shrink-0 text-right">
                                                  <span className="block text-xs font-semibold text-gold-light">
                                                    {creneau.nights} nuit
                                                    {creneau.nights > 1 ? "s" : ""}
                                                  </span>
                                                  <span className="block text-[11px] text-cream/50">
                                                    {formatCurrency(creneau.price_per_night)} / nuit
                                                  </span>
                                                </span>
                                              </button>
                                            </li>
                                          ))}
                                      </ul>
                                    </div>
                                  )}

                                {alternatives.length > 0 && (
                                  <div className="space-y-2">
                                    <p className="text-[11px] uppercase tracking-wider text-cream/60">
                                      Disponible{alternatives.length > 1 ? "s" : ""} sur ces mêmes
                                      dates
                                    </p>
                                    <ul className="space-y-2">
                                      {alternatives.map((autre) => (
                                        <li key={autre.id}>
                                          <Link
                                            href={`/rooms/${autre.category_slug}?unit=${autre.slug}`}
                                            className="flex items-center justify-between gap-3 rounded-xl border border-gold/25 bg-white/10 px-4 py-3 transition hover:border-gold/50 hover:bg-white/15"
                                          >
                                            <span className="text-cream">
                                              <span className="font-semibold">
                                                Appartement N°{autre.apartment_number}
                                              </span>
                                              <span className="ml-2 text-xs text-cream/60">
                                                {autre.category_label}
                                              </span>
                                            </span>
                                            <span className="shrink-0 text-xs font-semibold text-gold-light">
                                              {formatCurrency(autre.price_per_night)} / nuit
                                            </span>
                                          </Link>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p>Calcul des disponibilites...</p>
                            )}
                          </motion.div>
                        )}

                        <button
                          type="button"
                          disabled={checking || available !== true}
                          onClick={continueToDetails}
                          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-gold-light to-gold py-4 text-xs font-bold uppercase tracking-[0.25em] text-night transition duration-300 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Continuer
                        </button>
                      </>
                    )}
                  </>
                )}

                <div className="flex items-center justify-center gap-2 border-t border-gold/15 pt-2 text-center text-[10px] uppercase tracking-wider text-cream/40">
                  <ShieldCheck size={14} className="shrink-0" />
                  Demande gratuite · paiement après validation
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
