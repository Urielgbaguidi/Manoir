import { Room } from '@/lib/api';

export type RoomCategory = 'vip' | 'deux_chambres' | 'une_chambre';
export type RoomCategories = Record<RoomCategory, Room[]>;

export interface RoomCategoryConfig {
  type: RoomCategory;
  slug: string;
  label: string;
  rankLabel: string;
  shortDescription: string;
  fullDescription: string;
  representativeImage: string;
  aliases: string[];
}

export interface RoomCategorySummary extends RoomCategoryConfig {
  rooms: Room[];
  images: string[];
  videos: string[];
  equipments: string[];
  priceMin: number;
  priceMax: number;
  depositMin: number | null;
  depositMax: number | null;
  maxOccupants: number;
  availableCount: number;
}

const now = new Date().toISOString();

export const ROOM_CATEGORY_ORDER: RoomCategory[] = [
  'vip',
  'deux_chambres',
  'une_chambre',
];

export const ROOM_CATEGORY_CONFIG: Record<RoomCategory, RoomCategoryConfig> = {
  vip: {
    type: 'vip',
    slug: 'appartement-vip',
    label: 'Appartement VIP',
    rankLabel: 'Categorie 1',
    shortDescription:
      "Deux appartements VIP distincts, chacun avec sa propre galerie, son ambiance et son prix par nuit.",
    fullDescription:
      "Les Appartements VIP reunissent les finitions les plus soignees du Manoir: volumes genereux, atmosphere feutree, terrasse ou vue privilegiee, salle de bain premium et services concus pour un sejour exclusif. Cette categorie s'adresse aux voyageurs qui recherchent une experience intime, elegante et hautement confortable.",
    representativeImage: '/assets/rooms/room1.jpg',
    aliases: ['vip', 'appartement-vip-1', 'appartement-vip-2'],
  },
  deux_chambres: {
    type: 'deux_chambres',
    slug: 'appartement-2-chambres',
    label: 'Appartement 2 Chambres',
    rankLabel: 'Categorie 2',
    shortDescription:
      'Un appartement spacieux pense pour les familles et les groupes, avec deux chambres, salon confortable et cuisine equipee.',
    fullDescription:
      "Les Appartements 2 Chambres offrent un bel equilibre entre espace, confort et fonctionnalite. Chaque unite propose deux chambres separees, un salon convivial, une cuisine equipee et des espaces pratiques pour les sejours en famille, entre amis ou en deplacement prolonge.",
    representativeImage: '/assets/rooms/room4.jpg',
    aliases: [
      'deux-chambres',
      'deux_chambres',
      'appartement-2ch-1',
      'appartement-2ch-2',
      'appartement-2ch-3',
      'appartement-2ch-4',
    ],
  },
  une_chambre: {
    type: 'une_chambre',
    slug: 'appartement-1-chambre',
    label: 'Appartement 1 Chambre',
    rankLabel: 'Categorie 3',
    shortDescription:
      'Un cocon elegant et fonctionnel pour deux personnes, parfait pour un sejour calme, simple et soigne.',
    fullDescription:
      "Les Appartements 1 Chambre privilegient l'intimite et la fluidite du quotidien. Ils combinent une chambre confortable, un salon agreable et une kitchenette moderne pour offrir une base paisible aux couples, voyageurs seuls ou professionnels de passage.",
    representativeImage: '/assets/rooms/room3.jpg',
    aliases: [
      'une-chambre',
      'une_chambre',
      'appartement-1ch-1',
      'appartement-1ch-2',
    ],
  },
};

export const fallbackCategoryRooms: RoomCategories = {
  vip: [
    {
      id: 1,
      name: 'VIP 3',
      slug: 'appartement-vip-1',
      description:
        "Appartement d'exception avec vue imprenable sur la mer. Salon spacieux, chambre avec lit king-size, salle de bain en marbre et terrasse privative.",
      max_occupants: 2,
      apartment_number: 3,
      base_price: 30000,
      deposit: 500000,
      type: 'vip',
      images: ['/assets/rooms/room1.jpg', '/assets/rooms/room2.jpg', '/assets/rooms/room3.jpg'],
      videos: [],
      equipments: ['wifi', 'climatisation', 'jacuzzi', 'tv', 'minibar', 'vue_panoramique', 'terrasse', 'concierge'],
      status: 'available',
      created_at: now,
      updated_at: now,
    },
    {
      id: 2,
      name: 'VIP 7',
      slug: 'appartement-vip-2',
      description:
        'Appartement VIP luxueux avec vue sur le jardin tropical. Design contemporain, materiaux nobles et equipements haut de gamme.',
      max_occupants: 2,
      apartment_number: 7,
      base_price: 40000,
      deposit: 500000,
      type: 'vip',
      images: ['/assets/rooms/room2.jpg', '/assets/rooms/room1.jpg', '/assets/rooms/room4.jpg'],
      videos: [],
      equipments: ['wifi', 'climatisation', 'jacuzzi', 'tv', 'minibar', 'jardin', 'piscine', 'concierge'],
      status: 'available',
      created_at: now,
      updated_at: now,
    },
  ],
  deux_chambres: [
    {
      id: 3,
      name: 'Appartement 2 Chambres - Standard',
      slug: 'appartement-2ch-1',
      description:
        'Appartement spacieux avec deux chambres separees, ideal pour les familles. Cuisine equipee, salon confortable et balcon.',
      max_occupants: 4,
      apartment_number: 2,
      base_price: 118000,
      deposit: 300000,
      type: 'deux_chambres',
      images: ['/assets/rooms/room4.jpg', '/assets/rooms/room3.jpg'],
      videos: [],
      equipments: ['wifi', 'climatisation', 'cuisine', 'tv', 'parking', 'balcon'],
      status: 'available',
      created_at: now,
      updated_at: now,
    },
    {
      id: 4,
      name: 'Appartement 2 Chambres - Confort',
      slug: 'appartement-2ch-2',
      description:
        'Appartement confortable avec deux chambres climatisees, salon lumineux et cuisine moderne.',
      max_occupants: 4,
      apartment_number: 4,
      base_price: 118000,
      deposit: 300000,
      type: 'deux_chambres',
      images: ['/assets/rooms/room3.jpg', '/assets/rooms/room4.jpg'],
      videos: [],
      equipments: ['wifi', 'climatisation', 'cuisine', 'tv', 'parking', 'jardin'],
      status: 'available',
      created_at: now,
      updated_at: now,
    },
    {
      id: 5,
      name: 'Appartement 2 Chambres - Premium',
      slug: 'appartement-2ch-3',
      description:
        'Appartement premium avec deux chambres elegantes, salon spacieux et cuisine equipee.',
      max_occupants: 4,
      apartment_number: 6,
      base_price: 118000,
      deposit: 300000,
      type: 'deux_chambres',
      images: ['/assets/rooms/room1.jpg', '/assets/rooms/room2.jpg'],
      videos: [],
      equipments: ['wifi', 'climatisation', 'cuisine', 'tv', 'parking', 'terrasse', 'minibar'],
      status: 'available',
      created_at: now,
      updated_at: now,
    },
    {
      id: 6,
      name: 'Appartement 2 Chambres - Vue Piscine',
      slug: 'appartement-2ch-4',
      description:
        'Appartement avec vue sur la piscine, deux chambres confortables et un salon lumineux.',
      max_occupants: 4,
      apartment_number: 8,
      base_price: 118000,
      deposit: 300000,
      type: 'deux_chambres',
      images: ['/assets/rooms/room2.jpg', '/assets/rooms/room3.jpg'],
      videos: [],
      equipments: ['wifi', 'climatisation', 'cuisine', 'tv', 'parking', 'piscine', 'balcon'],
      status: 'available',
      created_at: now,
      updated_at: now,
    },
  ],
  une_chambre: [
    {
      id: 7,
      name: 'Appartement 1 Chambre - Cosy',
      slug: 'appartement-1ch-1',
      description:
        'Appartement cozy et fonctionnel avec une chambre confortable, salon agreable et kitchenette equipee.',
      max_occupants: 2,
      apartment_number: 1,
      base_price: 85000,
      deposit: 200000,
      type: 'une_chambre',
      images: ['/assets/rooms/room3.jpg', '/assets/rooms/room1.jpg'],
      videos: [],
      equipments: ['wifi', 'climatisation', 'cuisine', 'tv', 'minibar'],
      status: 'available',
      created_at: now,
      updated_at: now,
    },
    {
      id: 8,
      name: 'Appartement 1 Chambre - Elegant',
      slug: 'appartement-1ch-2',
      description:
        'Appartement elegant avec chambre spacieuse, salon design et kitchenette moderne.',
      max_occupants: 2,
      apartment_number: 5,
      base_price: 85000,
      deposit: 200000,
      type: 'une_chambre',
      images: ['/assets/rooms/room1.jpg', '/assets/rooms/room2.jpg'],
      videos: [],
      equipments: ['wifi', 'climatisation', 'cuisine', 'tv', 'minibar', 'balcon'],
      status: 'available',
      created_at: now,
      updated_at: now,
    },
  ],
};

export const emptyCategories = (): RoomCategories => ({
  vip: [],
  deux_chambres: [],
  une_chambre: [],
});

export const isRoomCategory = (type: string): type is RoomCategory =>
  type === 'vip' || type === 'deux_chambres' || type === 'une_chambre';

export const groupRoomsByCategory = (sourceRooms: Room[]): RoomCategories =>
  sourceRooms.reduce((categories, room) => {
    if (isRoomCategory(room.type)) {
      categories[room.type].push(room);
    }

    return categories;
  }, emptyCategories());

export const hasRoomsInCategories = (categories: RoomCategories) =>
  Object.values(categories).some((categoryRooms) => categoryRooms.length > 0);

export const getCategoryFromSlug = (slug: string): RoomCategory | null => {
  const normalizedSlug = slug.toLowerCase();

  return (
    ROOM_CATEGORY_ORDER.find((category) => {
      const config = ROOM_CATEGORY_CONFIG[category];
      return (
        normalizedSlug === category ||
        normalizedSlug === config.slug ||
        config.aliases.includes(normalizedSlug)
      );
    }) ?? null
  );
};

export const getRoomsForCategory = (category: RoomCategory, sourceRooms: Room[]) => {
  const groupedRooms = groupRoomsByCategory(sourceRooms);
  return groupedRooms[category].length > 0
    ? groupedRooms[category]
    : fallbackCategoryRooms[category];
};

export const formatCurrency = (value: number) =>
  `${value.toLocaleString('fr-FR')} F`;

export const formatCurrencyRange = (
  minValue: number | null,
  maxValue: number | null,
  fallback = 'Sur demande'
) => {
  if (minValue === null || maxValue === null) {
    return fallback;
  }

  return minValue === maxValue
    ? formatCurrency(minValue)
    : `${formatCurrency(minValue)} - ${formatCurrency(maxValue)}`;
};

const uniqueStrings = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.filter((value): value is string => Boolean(value))));

const numericRange = (values: number[]) => {
  if (values.length === 0) {
    return [0, 0] as const;
  }

  return [Math.min(...values), Math.max(...values)] as const;
};

const nullableNumericRange = (values: number[]) => {
  if (values.length === 0) {
    return [null, null] as const;
  }

  return [Math.min(...values), Math.max(...values)] as const;
};

export const buildCategorySummary = (
  category: RoomCategory,
  sourceRooms: Room[] = []
): RoomCategorySummary => {
  const config = ROOM_CATEGORY_CONFIG[category];
  const rooms = getRoomsForCategory(category, sourceRooms);
  const fallbackRooms = fallbackCategoryRooms[category];
  const images = uniqueStrings(rooms.flatMap((room) => room.images ?? []));
  const videos = uniqueStrings(rooms.flatMap((room) => room.videos ?? []));
  const equipments = uniqueStrings(rooms.flatMap((room) => room.equipments ?? []));
  const [priceMin, priceMax] = numericRange(rooms.map((room) => room.base_price));
  const roomDepositValues = rooms
    .map((room) => room.deposit)
    .filter((deposit): deposit is number => typeof deposit === 'number');
  const fallbackDepositValues = fallbackRooms
    .map((room) => room.deposit)
    .filter((deposit): deposit is number => typeof deposit === 'number');
  const [depositMin, depositMax] = nullableNumericRange(
    roomDepositValues.length > 0 ? roomDepositValues : fallbackDepositValues
  );

  return {
    ...config,
    rooms,
    images: images.length > 0 ? images : [config.representativeImage],
    videos,
    equipments,
    priceMin,
    priceMax,
    depositMin,
    depositMax,
    maxOccupants: Math.max(...rooms.map((room) => room.max_occupants)),
    availableCount: rooms.length,
  };
};
