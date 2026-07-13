'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { AlertCircle, ArrowLeft, Images, ShieldCheck, Sparkles, Video } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api, Room, RoomCategory } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

const fallbackCategories: Record<string, RoomCategory> = {
  'appartement-vip': {
    id: 1,
    type: 'vip',
    slug: 'appartement-vip',
    label: 'Appartement VIP',
    rank_label: 'Categorie 1',
    short_description: '',
    full_description: "Les Appartements VIP reunissent les finitions les plus soignees du Manoir: volumes genereux, atmosphere feutree, terrasse ou vue privilegiee, salle de bain premium et services concus pour un sejour exclusif.",
    price_per_night: 30000,
    deposit_per_day: 500000,
    is_blocked: false,
    images: ['/assets/rooms/room1.jpg', '/assets/rooms/room2.jpg', '/assets/rooms/room3.jpg'],
    videos: [],
    units: [
      {
        id: 1,
        name: 'VIP 1',
        slug: 'appartement-vip-1',
        description: "Appartement VIP 1 du Manoir, pense pour un sejour intime avec finitions premium, salon elegant et galerie propre a cet appartement.",
        max_occupants: 2,
        apartment_number: 3,
        base_price: 30000,
        deposit: 500000,
        type: 'vip',
        images: ['/assets/rooms/room1.jpg', '/assets/rooms/room2.jpg', '/assets/rooms/room3.jpg'],
        videos: [],
        equipments: [],
        status: 'available',
        created_at: '',
        updated_at: '',
      },
      {
        id: 2,
        name: 'VIP 2',
        slug: 'appartement-vip-2',
        description: "Appartement VIP 2 du Manoir, plus exclusif, avec ambiance feutree, confort renforce et galerie dediee.",
        max_occupants: 2,
        apartment_number: 7,
        base_price: 40000,
        deposit: 500000,
        type: 'vip',
        images: ['/assets/rooms/room2.jpg', '/assets/rooms/room1.jpg', '/assets/rooms/room4.jpg'],
        videos: [],
        equipments: [],
        status: 'available',
        created_at: '',
        updated_at: '',
      },
    ],
    created_at: '',
    updated_at: '',
  },
  'appartement-2-chambres': {
    id: 2,
    type: 'deux_chambres',
    slug: 'appartement-2-chambres',
    label: 'Appartement 2 Chambres',
    rank_label: 'Categorie 2',
    short_description: '',
    full_description: "Les Appartements 2 Chambres offrent un bel equilibre entre espace, confort et fonctionnalite. Chaque unite propose deux chambres separees, un salon convivial, une cuisine equipee et des espaces pratiques.",
    price_per_night: 118000,
    deposit_per_day: 300000,
    is_blocked: false,
    images: ['/assets/rooms/room4.jpg', '/assets/rooms/room3.jpg', '/assets/rooms/room1.jpg'],
    videos: [],
    created_at: '',
    updated_at: '',
  },
  'appartement-1-chambre': {
    id: 3,
    type: 'une_chambre',
    slug: 'appartement-1-chambre',
    label: 'Appartement 1 Chambre',
    rank_label: 'Categorie 3',
    short_description: '',
    full_description: "Les Appartements 1 Chambre privilegient l'intimite et la fluidite du quotidien. Ils combinent une chambre confortable, un salon agreable et une kitchenette moderne.",
    price_per_night: 85000,
    deposit_per_day: 200000,
    is_blocked: false,
    images: ['/assets/rooms/room3.jpg', '/assets/rooms/room1.jpg', '/assets/rooms/room2.jpg'],
    videos: [],
    created_at: '',
    updated_at: '',
  },
};

const fallbackByType: Record<string, string> = {
  vip: 'appartement-vip',
  deux_chambres: 'appartement-2-chambres',
  une_chambre: 'appartement-1-chambre',
};

const formatCurrency = (value: number) => `${value.toLocaleString('fr-FR')} F`;
const todayString = () => new Date().toISOString().split('T')[0];

const dayDiff = (from: string, to: string) => {
  if (!from || !to) return 0;
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
};

const roomDisplayName = (room: Room) =>
  room.name.toLowerCase().startsWith('appartement') ? room.name : `Appartement ${room.name}`;

export default function RoomCategoryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  const [category, setCategory] = useState<RoomCategory | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [reserving, setReserving] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [specialRequests, setSpecialRequests] = useState('');
  const [assignedRoom, setAssignedRoom] = useState<Room | null>(null);

  const units = useMemo(() => {
    const rawUnits = category?.units ?? [];

    if (category?.type !== 'vip') {
      return rawUnits;
    }

    const fallbackVipUnits = fallbackCategories['appartement-vip'].units ?? [];

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
        equipments: apiUnit.equipments?.length ? apiUnit.equipments : fallbackUnit.equipments,
      };
    });
  }, [category]);
  const selectedUnitSlug = searchParams.get('unit');
  const selectedUnit = useMemo(
    () => units.find((unit) => unit.slug === selectedUnitSlug || String(unit.id) === selectedUnitSlug) ?? null,
    [units, selectedUnitSlug]
  );
  const activeRoom = category?.type === 'vip' ? selectedUnit : null;
  const detailTitle = activeRoom ? roomDisplayName(activeRoom) : category?.label ?? 'Appartement';
  const detailDescription = activeRoom?.description || category?.full_description || '';
  const pricePerNight = activeRoom?.base_price ?? category?.price_per_night ?? 0;
  const depositPerDay = activeRoom?.deposit ?? category?.deposit_per_day ?? 0;
  const activeRoomBlocked = Boolean(category?.type === 'vip' && activeRoom && activeRoom.status !== 'available');
  const reservationBlocked = Boolean(category?.is_blocked || activeRoomBlocked);

  useEffect(() => {
    const loadCategory = async () => {
      setLoading(true);
      setActiveImageIndex(0);
      setAvailable(null);
      setAssignedRoom(null);
      setShowForm(false);

      try {
        const data = await api.getRoomCategory(slug);
        setCategory(data);
      } catch (error) {
        console.error('Erreur lors du chargement de la categorie:', error);
        const fallbackKey = fallbackCategories[slug] ? slug : fallbackByType[slug];
        setCategory(fallbackKey ? fallbackCategories[fallbackKey] : null);
      } finally {
        setLoading(false);
      }
    };

    if (slug) loadCategory();
  }, [slug]);

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
        const result = await api.checkCategoryAvailability(category.slug, checkIn, checkOut, activeRoom?.id);
        setAvailable(result.available);
        setAssignedRoom(result.available_room ?? activeRoom ?? null);
      } catch (error) {
        console.error('Erreur lors de la verification:', error);
        setAvailable(null);
        setAssignedRoom(null);
        showToast('Impossible de verifier la disponibilite pour le moment.', 'error');
      } finally {
        setChecking(false);
      }
    };

    verify();
  }, [category, activeRoom, checkIn, checkOut, showToast]);

  useEffect(() => {
    if (
      searchParams.get('reserve') === '1' &&
      user &&
      category &&
      !category.is_blocked &&
      !activeRoomBlocked &&
      (category.type !== 'vip' || activeRoom)
    ) {
      setShowForm(true);
      setTimeout(() => document.getElementById('reservation')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  }, [searchParams, user, category, activeRoom, activeRoomBlocked]);

  const images = activeRoom?.images?.length ? activeRoom.images : category?.images?.length ? category.images : ['/assets/rooms/room1.jpg'];
  const videos = activeRoom?.videos?.length ? activeRoom.videos : category?.videos ?? [];
  const activeImage = images[activeImageIndex] ?? images[0];

  const nights = useMemo(() => dayDiff(checkIn, checkOut), [checkIn, checkOut]);
  const daysBeforeArrival = useMemo(() => dayDiff(todayString(), checkIn), [checkIn]);
  const depositAmount = daysBeforeArrival * depositPerDay;
  const stayAmount = nights * pricePerNight;

  const beginReservation = () => {
    if (!category) return;

    if (category.is_blocked) {
      showToast('Cette categorie est indisponible pour le moment.', 'info');
      return;
    }

    if (activeRoomBlocked) {
      showToast('Cet appartement VIP est indisponible pour le moment.', 'info');
      return;
    }

    if (!user) {
      showToast('Creez votre compte pour continuer la demande de reservation.', 'info');
      const unitQuery = activeRoom ? `unit=${activeRoom.slug}&` : '';
      router.push(`/auth/register?redirect=${encodeURIComponent(`/rooms/${category.slug}?${unitQuery}reserve=1`)}`);
      return;
    }

    setShowForm(true);
    setTimeout(() => document.getElementById('reservation')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const handleReservation = async () => {
    if (!category) return;

    if (!checkIn || !checkOut) {
      showToast('Choisissez vos dates avant de lancer la demande.', 'info');
      return;
    }

    if (new Date(checkOut) <= new Date(checkIn)) {
      showToast("La date de depart doit etre posterieure a la date d'arrivee.", 'error');
      return;
    }

    if (activeRoomBlocked) {
      showToast('Cet appartement VIP est indisponible pour le moment.', 'info');
      return;
    }

    if (available !== true) {
      showToast('Cette categorie n\'est pas disponible sur ces dates.', 'info');
      return;
    }

    setReserving(true);

    try {
      const response = await api.createReservation({
        category_type: category.type,
        room_id: activeRoom?.id,
        check_in: checkIn,
        check_out: checkOut,
        special_requests: specialRequests,
      });
      showToast(response.message || "Votre demande est en cours d'examen.", 'success');
      await logout('/auth/login?message=reservation-sent&redirect=/espace-client');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Une erreur est survenue.', 'error');
    } finally {
      setReserving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-bark border-t-transparent" />
      </div>
    );
  }

  if (!category) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-6">
        <div className="max-w-md space-y-4 text-center">
          <AlertCircle className="mx-auto h-16 w-16 text-bark/30" />
          <h1 className="font-display text-4xl font-bold uppercase text-bark">
            Categorie introuvable
          </h1>
          <p className="text-bark/75">
            Cette categorie n'existe pas ou a ete retiree du catalogue.
          </p>
          <Button onClick={() => router.push('/rooms')}>Retour aux appartements</Button>
        </div>
      </div>
    );
  }

  if (category.type === 'vip' && !selectedUnit) {
    const vipUnits = units;

    return (
      <main className="min-h-screen bg-cream px-6 py-28 text-charcoal md:px-10 grain-layer">
        <div className="mx-auto max-w-7xl">
          <nav className="mb-10 flex items-center gap-2 text-xs text-bark/75">
            <Link href="/rooms" className="inline-flex items-center gap-2 transition hover:text-bark">
              <ArrowLeft size={14} />
              Appartements
            </Link>
            <span>/</span>
            <span className="text-bark/85">Appartement VIP</span>
          </nav>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="mb-12 max-w-3xl"
          >
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-bark/10 bg-bark/5 px-4 py-2 backdrop-blur-md">
              <Sparkles className="h-4 w-4 text-bark" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-bark">
                Selection VIP
              </span>
            </div>
            <h1 className="mb-5 font-display text-4xl font-bold uppercase tracking-tight text-bark md:text-6xl">
              Choisir un Appartement VIP
            </h1>
            <p className="text-lg leading-8 text-bark/85">
              Les deux appartements VIP ont chacun leurs photos, leurs videos, leur description et leur prix par nuit.
            </p>
          </motion.div>

          <div className="grid gap-7 lg:grid-cols-2">
            {vipUnits.map((unit, index) => {
              const isUnitBlocked = category.is_blocked || unit.status !== 'available';
              const card = (
                <article className={`flex h-full flex-col overflow-hidden rounded-2xl border border-bark/10 bg-cream shadow-2xl transition duration-300 ${
                  isUnitBlocked ? 'opacity-65' : 'hover:-translate-y-1 hover:border-bark/25'
                }`}>
                  <div className="relative aspect-[16/10] overflow-hidden bg-cream-dark">
                    <Image
                      src={unit.images?.[0] || category.images?.[0] || '/assets/rooms/room1.jpg'}
                      alt={roomDisplayName(unit)}
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className={`object-cover transition duration-700 ${isUnitBlocked ? 'grayscale' : 'group-hover:scale-105'}`}
                      priority={index === 0}
                    />
                    <div className="absolute inset-0 bg-bark/20 transition group-hover:bg-bark/10" />
                    {isUnitBlocked && (
                      <span className="absolute left-5 top-5 rounded-full border border-terracotta/25 bg-terracotta px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-cream">
                        Indisponible pour le moment
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-6">
                    <h2 className="mb-3 font-display text-3xl font-bold uppercase tracking-tight text-bark">
                      {roomDisplayName(unit)}
                    </h2>
                    <p className="min-h-[4rem] text-[15px] leading-6 text-bark/85">
                      {unit.description}
                    </p>

                    <div className="mt-6 flex items-end justify-between gap-4 border-t border-bark/10 pt-5">
                      <div>
                        <span className="block text-[10px] font-bold uppercase tracking-widest text-bark/70">
                          Prix par nuit
                        </span>
                        <span className="font-display text-2xl font-bold text-bark">
                          {formatCurrency(unit.base_price)}
                        </span>
                        <span className="ml-1 text-xs font-medium text-bark/75">/ nuit</span>
                      </div>
                      <span className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-wider transition ${
                        isUnitBlocked ? 'bg-bark/25 text-bark/55' : 'bg-bark text-cream group-hover:bg-bark-light'
                      }`}>
                        <Images size={14} />
                        {isUnitBlocked ? 'Indisponible' : 'Voir les photos'}
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
                    <Link href={`/rooms/${category.slug}?unit=${unit.slug}`} className="group block h-full">
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
    <main className="min-h-screen bg-cream px-6 py-28 text-charcoal md:px-10 grain-layer">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="mb-10">
            <nav className="mb-6 flex items-center gap-2 text-xs text-bark/75">
              <Link href="/rooms" className="inline-flex items-center gap-2 transition hover:text-bark">
                <ArrowLeft size={14} />
                Appartements
              </Link>
              <span>/</span>
              <span className="text-bark/85">{detailTitle}</span>
            </nav>

            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-bark/10 bg-bark/5 px-4 py-2 backdrop-blur-md">
              <Sparkles className="h-4 w-4 text-bark" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-bark">
                {category.rank_label}
              </span>
            </div>

            <div className="grid gap-8 lg:grid-cols-[1fr_0.42fr] lg:items-end">
              <div>
                <h1 className="mb-5 font-display text-4xl font-bold uppercase tracking-tight text-bark md:text-6xl">
                  {detailTitle}
                </h1>
                <p className="max-w-3xl text-lg leading-8 text-bark/85">
                  {detailDescription}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 rounded-2xl border border-bark/10 bg-cream-dark/30 p-5">
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-bark/70">
                    Prix par nuit
                  </span>
                  <span className="mt-1 block font-display text-2xl font-bold text-bark">
                    {formatCurrency(pricePerNight)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-widest text-bark/70">
                    Caution par jour
                  </span>
                  <span className="mt-1 block font-display text-2xl font-bold text-bark">
                    {formatCurrency(depositPerDay)}
                  </span>
                </div>
                <div className="col-span-2 flex items-center justify-between border-t border-bark/10 pt-4 text-sm text-bark/85">
                  {reservationBlocked ? (
                    <span className="rounded-full border border-terracotta/20 bg-terracotta/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-terracotta">
                      {activeRoomBlocked ? 'Appartement indisponible pour le moment' : 'Indisponible pour le moment'}
                    </span>
                  ) : (
                    <span className="text-bark/75">Galerie et demande de sejour</span>
                  )}
                  <button
                    type="button"
                    disabled={reservationBlocked}
                    onClick={beginReservation}
                    className="rounded-lg bg-bark px-4 py-2 text-[10px] font-black uppercase tracking-wider text-cream transition hover:bg-bark-light disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Reserver
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            <div className="space-y-10">
              <section className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wider text-bark">
                    <Images size={20} />
                    Galerie photos
                  </h2>
                  <span className="text-xs font-semibold uppercase tracking-wider text-bark/70">
                    {images.length} photo{images.length > 1 ? 's' : ''}
                  </span>
                </div>

                <div className="relative aspect-video overflow-hidden rounded-2xl border border-bark/10 bg-cream-dark/40">
                  <Image
                    src={activeImage}
                    alt={`${detailTitle} galerie`}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 60vw"
                    className="object-cover transition duration-700 hover:scale-105"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {images.map((image, index) => (
                    <button
                      key={`${image}-${index}`}
                      type="button"
                      onClick={() => setActiveImageIndex(index)}
                      aria-label={`Voir la photo ${index + 1}`}
                      className={`relative aspect-video overflow-hidden rounded-xl border-2 bg-cream-dark transition ${
                        activeImageIndex === index
                          ? 'border-bark'
                          : 'border-bark/10 opacity-65 hover:opacity-100'
                      }`}
                    >
                      <Image src={image} alt={`${detailTitle} miniature ${index + 1}`} fill sizes="160px" className="object-cover" />
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-4">
                <h2 className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wider text-bark">
                  <Video size={20} />
                  Videos
                </h2>

                {videos.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {videos.map((video, index) => (
                      <div key={`${video}-${index}`} className="relative aspect-video overflow-hidden rounded-2xl border border-bark/10 bg-cream-dark/40">
                        <video controls className="h-full w-full object-cover" poster={images[0]} aria-label={`Video ${index + 1} ${detailTitle}`}>
                          <source src={video} type="video/mp4" />
                          Votre navigateur ne supporte pas la lecture de videos.
                        </video>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-bark/15 bg-cream-dark/25 p-8 text-[15px] leading-6 text-bark/80">
                    Les videos de cette categorie seront ajoutees prochainement.
                  </div>
                )}
              </section>
            </div>

            <aside id="reservation" className="scroll-mt-28">
              <div className="sticky top-28 space-y-6 rounded-2xl border border-bark/10 bg-cream-dark/30 p-8 backdrop-blur-md">
                <div className="border-b border-bark/10 pb-5">
                  <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-bark/70">
                    Demande de reservation
                  </span>
                  <h2 className="font-display text-3xl font-bold uppercase tracking-tight text-bark">
                    {detailTitle}
                  </h2>
                </div>

                {!showForm ? (
                  <div className="space-y-5">
                    <p className="text-[15px] leading-6 text-bark/85">
                      Lancez la demande pour choisir vos dates et envoyer vos informations a l'equipe du Manoir.
                    </p>
                    <button
                      type="button"
                      disabled={reservationBlocked}
                      onClick={beginReservation}
                      className="flex w-full items-center justify-center rounded-xl bg-bark py-4 text-xs font-black uppercase tracking-[0.25em] text-cream transition hover:bg-bark-light disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {reservationBlocked ? 'Indisponible' : 'Reserver'}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="check-in" className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-bark/70">
                          Date d'arrivee
                        </label>
                        <input
                          id="check-in"
                          type="date"
                          value={checkIn}
                          onChange={(event) => setCheckIn(event.target.value)}
                          onClick={(event) => (event.currentTarget as HTMLInputElement).showPicker?.()}
                          min={todayString()}
                          className="luxury-input w-full rounded-xl border border-bark/10 bg-cream px-4 py-3.5 text-sm text-charcoal outline-none transition-all focus:border-bark focus:ring-1 focus:ring-bark/15 cursor-pointer"
                        />
                      </div>

                      <div>
                        <label htmlFor="check-out" className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-bark/70">
                          Date de depart
                        </label>
                        <input
                          id="check-out"
                          type="date"
                          value={checkOut}
                          onChange={(event) => setCheckOut(event.target.value)}
                          onClick={(event) => (event.currentTarget as HTMLInputElement).showPicker?.()}
                          min={checkIn || todayString()}
                          className="luxury-input w-full rounded-xl border border-bark/10 bg-cream px-4 py-3.5 text-sm text-charcoal outline-none transition-all focus:border-bark focus:ring-1 focus:ring-bark/15 cursor-pointer"
                        />
                      </div>

                      <div>
                        <label htmlFor="special-requests" className="mb-2 block text-[10px] font-semibold uppercase tracking-widest text-bark/70">
                          Demandes speciales
                        </label>
                        <textarea
                          id="special-requests"
                          value={specialRequests}
                          onChange={(event) => setSpecialRequests(event.target.value)}
                          rows={3}
                          placeholder="Ex: arrivee tardive, preference..."
                          className="w-full resize-none rounded-xl border border-bark/10 bg-cream px-4 py-3 text-sm text-charcoal outline-none transition-all placeholder-bark/25 focus:border-bark"
                        />
                      </div>
                    </div>

                    {checkIn && checkOut && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`rounded-2xl border p-5 text-xs leading-relaxed ${
                          available === true
                            ? 'border-olive/20 bg-olive/5 text-olive'
                            : available === false
                              ? 'border-terracotta/20 bg-terracotta/5 text-terracotta'
                              : 'border-bark/10 bg-bark/5 text-bark/70'
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
                              Disponible pour {nights} nuit{nights > 1 ? 's' : ''}
                            </p>
                            {assignedRoom?.apartment_number && category.type !== 'vip' && (
                              <p className="rounded-xl border border-olive/15 bg-cream/60 p-3 text-bark">
                                Appartement N°{assignedRoom.apartment_number} vous sera attribué pour votre séjour.
                              </p>
                            )}
                            <div className="space-y-2 border-t border-olive/10 pt-3 text-bark">
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-[10px] uppercase tracking-wider text-bark/50">
                                  Caution ({daysBeforeArrival} jour{daysBeforeArrival > 1 ? 's' : ''} x {formatCurrency(depositPerDay)})
                                </span>
                                <span className="font-display text-lg font-bold">{formatCurrency(depositAmount)}</span>
                              </div>
                              <div className="flex items-center justify-between gap-4">
                                <span className="text-[10px] uppercase tracking-wider text-bark/50">
                                  Sejour
                                </span>
                                <span className="font-display text-lg font-bold">{formatCurrency(stayAmount)}</span>
                              </div>
                            </div>
                          </div>
                        ) : available === false ? (
                          <p className="font-semibold">
                            Aucun appartement disponible pour ces dates. Veuillez choisir d'autres dates.
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
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-bark py-4 text-xs font-black uppercase tracking-[0.25em] text-cream transition duration-300 hover:bg-bark-light disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {reserving ? (
                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-cream border-t-transparent" />
                      ) : (
                        'Envoyer la demande'
                      )}
                    </button>
                  </>
                )}

                <div className="flex items-center justify-center gap-2 border-t border-bark/10 pt-2 text-[10px] uppercase tracking-wider text-bark/40">
                  <ShieldCheck size={14} />
                  Validation admin sous 24h
                </div>
              </div>
            </aside>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
