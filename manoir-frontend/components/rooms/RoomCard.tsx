"use client";

import { Room } from "@/lib/api";
import { Users, ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface RoomCardProps {
  room: Room;
}

export function RoomCard({ room }: RoomCardProps) {
  const mainImage =
    room.images && room.images.length > 0
      ? room.images[0]
      : "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800";

  return (
    <div className="glass-warm glass-edge glass-hover group flex h-full flex-col justify-between overflow-hidden rounded-[1.6rem] p-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-[1.2rem] bg-night">
        <Image
          src={mainImage}
          alt={room.name}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-night/80 via-night/10 to-transparent" />
        <span className="sheen" />
        <span className="on-dark absolute right-4 top-4 rounded-full border border-gold/30 bg-night/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-gold-light backdrop-blur-md">
          {room.type === "vip"
            ? "VIP"
            : room.type === "deux_chambres"
              ? "2 Chambres"
              : room.type === "une_chambre"
                ? "1 Chambre"
                : room.type}
        </span>
      </div>

      <div className="flex flex-grow flex-col justify-between space-y-6 p-5">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-xl font-semibold uppercase tracking-wide text-cream">
              {room.name}
            </h3>
            <span className="flex items-center gap-1 text-xs font-semibold text-gold/70">
              <Users size={12} /> x{room.max_occupants}
            </span>
          </div>

          <p className="line-clamp-2 text-xs leading-relaxed text-cream/55">{room.description}</p>

          <div className="flex flex-wrap gap-1.5 pt-2">
            {room.equipments?.slice(0, 3).map((eq, i) => (
              <span
                key={i}
                className="rounded-full border border-gold/15 bg-white/5 px-2 py-0.5 text-[9px] uppercase tracking-wide text-cream/65"
              >
                {eq.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-gold/15 pt-4">
          <div>
            <span className="font-display text-xl font-semibold text-cream">
              {room.base_price.toLocaleString("fr-FR")} F
            </span>
            <p className="text-[9px] uppercase tracking-widest text-cream/40">par nuit</p>
          </div>

          <Link
            href={`/rooms/${room.slug}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-gold-light to-gold px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-night transition hover:brightness-105"
          >
            Réserver <ArrowUpRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}
