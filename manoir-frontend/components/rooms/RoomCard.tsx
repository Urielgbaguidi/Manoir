'use client';

import { Room } from '@/lib/api';
import { Users, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface RoomCardProps {
  room: Room;
}

export function RoomCard({ room }: RoomCardProps) {
  // Fallbacks images
  const mainImage = room.images && room.images.length > 0 
    ? room.images[0] 
    : 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800';

  return (
    <div className="group bg-cream rounded-3xl overflow-hidden shadow-2xl border border-bark/10 hover:border-bark/20 transition-all duration-300 flex flex-col justify-between h-full">
      
      {/* Container d'image */}
      <div className="relative aspect-video w-full overflow-hidden bg-cream-dark border-b border-bark/5">
        <Image
          src={mainImage}
          alt={room.name}
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-750 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-bark/20 group-hover:bg-bark/10 transition-colors" />
        <span className="absolute top-4 right-4 text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 bg-bark/60 backdrop-blur-md rounded border border-cream/10 text-cream">
          {room.type === 'vip' ? 'VIP' : room.type === 'deux_chambres' ? '2 Chambres' : room.type === 'une_chambre' ? '1 Chambre' : room.type}
        </span>
      </div>

      {/* Détails */}
      <div className="p-6 flex flex-col justify-between flex-grow space-y-6">
        <div className="space-y-3">
          <div className="flex justify-between items-start gap-2">
            <h3 className="text-xl font-bold font-display uppercase tracking-wide group-hover:text-bark transition-colors text-charcoal">
              {room.name}
            </h3>
            <span className="text-xs font-semibold text-bark/50 flex items-center gap-1">
              <Users size={12} /> x{room.max_occupants}
            </span>
          </div>
          
          <p className="text-xs text-bark/60 line-clamp-2 leading-relaxed">
            {room.description}
          </p>

          <div className="flex flex-wrap gap-1.5 pt-2">
            {room.equipments?.slice(0, 3).map((eq, i) => (
              <span key={i} className="text-[9px] uppercase bg-bark/5 border border-bark/5 px-2 py-0.5 rounded tracking-wide text-bark/70">
                {eq.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-bark/5 mt-auto">
          <div>
            <span className="text-xl font-bold font-display text-bark">
              {room.base_price.toLocaleString('fr-FR')} F
            </span>
            <p className="text-[9px] text-bark/40 uppercase tracking-widest">par nuit</p>
          </div>
          
          <Link 
            href={`/rooms/${room.slug}`}
            className="flex items-center gap-1.5 bg-bark text-cream px-4 py-2 text-[10px] font-black uppercase tracking-wider transition hover:bg-bark-light rounded-lg"
          >
            Réserver <ArrowRight size={12} />
          </Link>
        </div>
      </div>

    </div>
  );
}
