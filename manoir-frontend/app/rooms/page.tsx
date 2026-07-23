"use client";
export const dynamic = "force-dynamic";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Images, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { api, RoomCategory } from "@/lib/api";

const fallbackCategories: RoomCategory[] = [
  {
    id: 1,
    type: "vip",
    slug: "appartement-vip",
    label: "Appartement VIP",
    rank_label: "Categorie 1",
    short_description:
      "Deux appartements VIP distincts, chacun avec sa propre galerie, son ambiance et son prix par nuit.",
    full_description: "",
    price_per_night: 30000,
    deposit_per_day: 500000,
    is_blocked: false,
    images: ["/assets/rooms/room1.jpg"],
    videos: [],
    created_at: "",
    updated_at: ""
  },
  {
    id: 2,
    type: "deux_chambres",
    slug: "appartement-2-chambres",
    label: "Appartement 2 Chambres",
    rank_label: "Categorie 2",
    short_description:
      "Un appartement spacieux pense pour les familles et les groupes, avec deux chambres, salon confortable et cuisine equipee.",
    full_description: "",
    price_per_night: 118000,
    deposit_per_day: 300000,
    is_blocked: false,
    images: ["/assets/rooms/room4.jpg"],
    videos: [],
    created_at: "",
    updated_at: ""
  },
  {
    id: 3,
    type: "une_chambre",
    slug: "appartement-1-chambre",
    label: "Appartement 1 Chambre",
    rank_label: "Categorie 3",
    short_description:
      "Un cocon elegant et fonctionnel pour deux personnes, parfait pour un sejour calme, simple et soigne.",
    full_description: "",
    price_per_night: 85000,
    deposit_per_day: 200000,
    is_blocked: false,
    images: ["/assets/rooms/room3.jpg"],
    videos: [],
    created_at: "",
    updated_at: ""
  }
];

const formatCurrency = (value: number) => `${value.toLocaleString("fr-FR")} F`;

const minCategoryPrice = (category: RoomCategory) => {
  const unitPrices = category.units
    ?.map((unit) => unit.base_price)
    .filter((price): price is number => typeof price === "number");

  return unitPrices && unitPrices.length > 0 ? Math.min(...unitPrices) : category.price_per_night;
};

export default function RoomsPage() {
  const [categories, setCategories] = useState<RoomCategory[]>(fallbackCategories);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const results = await api.getRoomCategories();
        setCategories(results.length > 0 ? results : fallbackCategories);
      } catch (error) {
        console.error("Erreur lors du chargement des categories:", error);
      }
    };

    loadCategories();
  }, []);

  return (
    <main className="relative min-h-screen px-6 py-32 text-cream md:px-10">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mb-16 text-center"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold/25 bg-white/5 px-4 py-2 backdrop-blur-md">
            <Sparkles className="h-4 w-4 text-gold-light" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cream/85">
              La Collection du Manoir
            </span>
          </div>
          <h1 className="mb-6 font-display text-[clamp(2.6rem,7vw,5rem)] font-semibold uppercase leading-[0.9] tracking-[-0.04em]">
            Nos <span className="text-gradient-gold">Appartements</span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-cream/70">
            Trois catégories soigneusement pensées pour choisir votre expérience avant de découvrir
            la galerie complète.
          </p>
        </motion.div>

        <div className="grid gap-7 lg:grid-cols-3">
          {categories.map((category, index) => (
            <motion.div
              key={category.type}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              <Link href={`/rooms/${category.slug}`} className="group block h-full">
                <article className="glass-warm glass-edge glass-hover flex h-full flex-col overflow-hidden rounded-[1.6rem] p-2">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[1.2rem] bg-night">
                    <Image
                      src={category.images?.[0] || "/assets/rooms/room1.jpg"}
                      alt={category.label}
                      fill
                      sizes="(max-width: 1024px) 100vw, 33vw"
                      className="object-cover transition duration-700 group-hover:scale-105"
                      priority={index === 0}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-night/85 via-night/20 to-transparent" />
                    <span className="sheen" />
                    <span className="on-dark absolute left-4 top-4 rounded-full border border-gold/30 bg-night/60 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-gold-light backdrop-blur-md">
                      {category.rank_label}
                    </span>
                    {category.is_blocked && (
                      <span className="absolute right-4 top-4 rounded-full border border-terracotta/40 bg-terracotta px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-cream">
                        Indisponible
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <div className="mb-5 space-y-3">
                      <h2 className="font-display text-2xl font-semibold uppercase tracking-tight text-cream">
                        {category.label}
                      </h2>
                      <p className="min-h-[4.5rem] text-[15px] leading-6 text-cream/65">
                        {category.short_description}
                      </p>
                    </div>

                    <div className="mt-auto border-t border-gold/15 pt-5">
                      <span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-gold/70">
                        Prix par nuit
                      </span>
                      <div className="mt-1 flex items-end justify-between gap-4">
                        <div>
                          <span className="font-display text-2xl font-semibold text-cream">
                            {category.type === "vip" ? "À partir de " : ""}
                            {formatCurrency(minCategoryPrice(category))}
                          </span>
                          <span className="ml-1 text-xs font-medium text-cream/55">/ nuit</span>
                        </div>
                        <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-gold-light to-gold px-4 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-night transition group-hover:brightness-105">
                          <Images size={14} />
                          Photos
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
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-12%" }}
          transition={{ duration: 0.8 }}
          className="glass-dark glass-edge mt-20 overflow-hidden rounded-[2rem] px-8 py-14 text-center"
        >
          <h3 className="mb-4 font-display text-[clamp(1.7rem,4vw,3rem)] font-semibold uppercase tracking-tight text-cream">
            Besoin d'un conseil avant de <span className="text-gradient-gold">réserver</span> ?
          </h3>
          <p className="mx-auto mb-8 max-w-xl text-[15px] leading-6 text-cream/65 md:text-base">
            Notre équipe peut vous orienter vers la catégorie la plus adaptée à votre séjour.
          </p>
          <Link
            href="/reservations"
            className="group inline-flex items-center gap-3 rounded-full bg-gradient-to-br from-gold-light to-gold px-8 py-4 text-xs font-bold uppercase tracking-[0.25em] text-night shadow-[0_10px_36px_-10px_rgba(201,164,92,0.7)] transition hover:brightness-105"
          >
            Nous contacter
            <ArrowUpRight
              size={16}
              className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1"
            />
          </Link>
        </motion.section>
      </div>
    </main>
  );
}
