'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Images, Sparkles } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { api, RoomCategory } from '@/lib/api';

const fallbackCategories: RoomCategory[] = [
  {
    id: 1,
    type: 'vip',
    slug: 'appartement-vip',
    label: 'Appartement VIP',
    rank_label: 'Categorie 1',
    short_description: "Deux appartements VIP distincts, chacun avec sa propre galerie, son ambiance et son prix par nuit.",
    full_description: '',
    price_per_night: 30000,
    deposit_per_day: 500000,
    is_blocked: false,
    images: ['/assets/rooms/room1.jpg'],
    videos: [],
    created_at: '',
    updated_at: '',
  },
  {
    id: 2,
    type: 'deux_chambres',
    slug: 'appartement-2-chambres',
    label: 'Appartement 2 Chambres',
    rank_label: 'Categorie 2',
    short_description: 'Un appartement spacieux pense pour les familles et les groupes, avec deux chambres, salon confortable et cuisine equipee.',
    full_description: '',
    price_per_night: 118000,
    deposit_per_day: 300000,
    is_blocked: false,
    images: ['/assets/rooms/room4.jpg'],
    videos: [],
    created_at: '',
    updated_at: '',
  },
  {
    id: 3,
    type: 'une_chambre',
    slug: 'appartement-1-chambre',
    label: 'Appartement 1 Chambre',
    rank_label: 'Categorie 3',
    short_description: 'Un cocon elegant et fonctionnel pour deux personnes, parfait pour un sejour calme, simple et soigne.',
    full_description: '',
    price_per_night: 85000,
    deposit_per_day: 200000,
    is_blocked: false,
    images: ['/assets/rooms/room3.jpg'],
    videos: [],
    created_at: '',
    updated_at: '',
  },
];

const formatCurrency = (value: number) => `${value.toLocaleString('fr-FR')} F`;

const minCategoryPrice = (category: RoomCategory) => {
  const unitPrices = category.units
    ?.map((unit) => unit.base_price)
    .filter((price): price is number => typeof price === 'number');

  return unitPrices && unitPrices.length > 0
    ? Math.min(...unitPrices)
    : category.price_per_night;
};

export default function RoomsPage() {
  const [categories, setCategories] = useState<RoomCategory[]>(fallbackCategories);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const results = await api.getRoomCategories();
        setCategories(results.length > 0 ? results : fallbackCategories);
      } catch (error) {
        console.error('Erreur lors du chargement des categories:', error);
      }
    };

    loadCategories();
  }, []);

  return (
    <main className="min-h-screen bg-cream px-6 py-28 text-charcoal md:px-10 grain-layer">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-16 text-center"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-bark/10 bg-bark/5 px-4 py-2 backdrop-blur-md">
            <Sparkles className="h-4 w-4 text-bark" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-bark">
              La Collection du Manoir
            </span>
          </div>
          <h1 className="mb-6 font-display text-4xl font-bold uppercase tracking-tight text-bark md:text-6xl">
            Nos Appartements
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-bark/85">
            Trois categories soigneusement pensees pour choisir votre experience avant de decouvrir la galerie complete.
          </p>
        </motion.div>
 
        <div className="grid gap-7 lg:grid-cols-3">
          {categories.map((category, index) => (
            <motion.div
              key={category.type}
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.55 }}
            >
              <Link href={`/rooms/${category.slug}`} className="group block h-full">
                <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-bark/10 bg-cream shadow-2xl transition duration-300 hover:-translate-y-1 hover:border-bark/25">
                  <div className="relative aspect-[4/3] overflow-hidden bg-cream-dark">
                    <Image
                      src={category.images?.[0] || '/assets/rooms/room1.jpg'}
                      alt={category.label}
                      fill
                      sizes="(max-width: 1024px) 100vw, 33vw"
                      className="object-cover transition duration-700 group-hover:scale-105"
                      priority={index === 0}
                    />
                    <div className="absolute inset-0 bg-bark/20 transition group-hover:bg-bark/10" />
                    <span className="absolute left-5 top-5 rounded-full border border-cream/15 bg-bark/65 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-cream backdrop-blur-md">
                      {category.rank_label}
                    </span>
                    {category.is_blocked && (
                      <span className="absolute right-5 top-5 rounded-full border border-terracotta/25 bg-terracotta px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-cream">
                        Indisponible pour le moment
                      </span>
                    )}
                  </div>
 
                  <div className="flex flex-1 flex-col p-6">
                    <div className="mb-5 space-y-3">
                      <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-bark">
                        {category.label}
                      </h2>
                      <p className="min-h-[4.5rem] text-[15px] leading-6 text-bark/85">
                        {category.short_description}
                      </p>
                    </div>
 
                    <div className="mt-auto border-t border-bark/10 pt-5">
                      <span className="block text-[10px] font-bold uppercase tracking-widest text-bark/70">
                        Prix par nuit
                      </span>
                      <div className="mt-1 flex items-end justify-between gap-4">
                        <div>
                          <span className="font-display text-2xl font-bold text-bark">
                            {category.type === 'vip' ? 'A partir de ' : ''}
                            {formatCurrency(minCategoryPrice(category))}
                          </span>
                          <span className="ml-1 text-xs font-medium text-bark/75">
                            / nuit
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-2 rounded-lg bg-bark px-4 py-2 text-[10px] font-black uppercase tracking-wider text-cream transition group-hover:bg-bark-light">
                          <Images size={14} />
                          Voir les photos
                        </span>
                      </div>
                    </div>
                  </div>
                </article>
              </Link>
            </motion.div>
          ))}
        </div>
 
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-20 border-t border-bark/10 py-12 text-center"
        >
          <h3 className="mb-4 font-display text-2xl font-bold uppercase tracking-tight text-bark md:text-4xl">
            Besoin d'un conseil avant de reserver ?
          </h3>
          <p className="mx-auto mb-8 max-w-xl text-[15px] leading-6 text-bark/85 md:text-base">
            Notre equipe peut vous orienter vers la categorie la plus adaptee a votre sejour.
          </p>
          <Link
            href="/reservations"
            className="inline-flex items-center gap-3 rounded-xl bg-bark px-8 py-4 text-xs font-black uppercase tracking-[0.25em] text-cream transition duration-300 hover:bg-bark-light"
          >
            Nous contacter
            <ArrowRight size={16} />
          </Link>
        </motion.section>
      </div>
    </main>
  );
}
