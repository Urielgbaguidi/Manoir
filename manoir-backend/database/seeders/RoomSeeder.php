<?php

namespace Database\Seeders;

use App\Models\Room;
use App\Models\SeasonalPrice;
use Illuminate\Database\Seeder;

class RoomSeeder extends Seeder
{
    public function run(): void
    {
        // Catégorie 1: Appartement VIP (2 disponibles)
        $vip1 = Room::create([
            'name' => 'VIP 3',
            'slug' => 'appartement-vip-1',
            'description' => 'Appartement d\'exception avec vue imprenable sur la mer. Cet appartement VIP offre un espace de vie raffiné avec salon spacieux, chambre avec lit king-size, salle de bain en marbre et terrasse privative. Profitez d\'un service personnalisé et d\'un confort absolu pour un séjour inoubliable.',
            'max_occupants' => 2,
            'apartment_number' => 3,
            'base_price' => 30000,
            'deposit' => 500000,
            'type' => 'vip',
            'images' => [
                '/assets/rooms/room1.jpg',
                '/assets/rooms/room2.jpg',
                '/assets/rooms/room3.jpg',
            ],
            'videos' => [],
            'equipments' => ['wifi', 'climatisation', 'jacuzzi', 'tv', 'minibar', 'vue_panoramique', 'terrasse', 'concierge'],
            'status' => 'available',
        ]);

        $vip2 = Room::create([
            'name' => 'VIP 7',
            'slug' => 'appartement-vip-2',
            'description' => 'Appartement VIP luxueux avec vue sur le jardin tropical. Design contemporain, matériaux nobles et équipements haut de gamme pour une expérience exclusive. Inclut un accès direct à la piscine et un service de conciergerie 24h/24.',
            'max_occupants' => 2,
            'apartment_number' => 7,
            'base_price' => 40000,
            'deposit' => 500000,
            'type' => 'vip',
            'images' => [
                '/assets/rooms/room2.jpg',
                '/assets/rooms/room1.jpg',
                '/assets/rooms/room4.jpg',
            ],
            'videos' => [],
            'equipments' => ['wifi', 'climatisation', 'jacuzzi', 'tv', 'minibar', 'jardin', 'piscine', 'concierge'],
            'status' => 'available',
        ]);

        // Catégorie 2: Appartement 2 Chambres (4 disponibles)
        $deuxCh1 = Room::create([
            'name' => 'Appartement 2 Chambres - Standard',
            'slug' => 'appartement-2ch-1',
            'description' => 'Appartement spacieux avec deux chambres séparées, idéal pour les familles ou les groupes d\'amis. Cuisine équipée, salon confortable et balcon avec vue. Parfait pour des séjours prolongés.',
            'max_occupants' => 4,
            'apartment_number' => 2,
            'base_price' => 118000,
            'deposit' => 300000,
            'type' => 'deux_chambres',
            'images' => [
                '/assets/rooms/room4.jpg',
                '/assets/rooms/room3.jpg',
            ],
            'videos' => [],
            'equipments' => ['wifi', 'climatisation', 'cuisine', 'tv', 'parking', 'balcon'],
            'status' => 'available',
        ]);

        $deuxCh2 = Room::create([
            'name' => 'Appartement 2 Chambres - Confort',
            'slug' => 'appartement-2ch-2',
            'description' => 'Appartement confortable avec deux chambres climatisées, salon lumineux et cuisine moderne. Idéalement situé pour profiter de toutes les commodités du Manoir.',
            'max_occupants' => 4,
            'apartment_number' => 4,
            'base_price' => 118000,
            'deposit' => 300000,
            'type' => 'deux_chambres',
            'images' => [
                '/assets/rooms/room3.jpg',
                '/assets/rooms/room4.jpg',
            ],
            'videos' => [],
            'equipments' => ['wifi', 'climatisation', 'cuisine', 'tv', 'parking', 'jardin'],
            'status' => 'available',
        ]);

        $deuxCh3 = Room::create([
            'name' => 'Appartement 2 Chambres - Premium',
            'slug' => 'appartement-2ch-3',
            'description' => 'Appartement premium avec deux chambres élégantes, salon spacieux et cuisine équipée. Décoration raffinée et équipements modernes pour un séjour agréable en famille ou entre amis.',
            'max_occupants' => 4,
            'apartment_number' => 6,
            'base_price' => 118000,
            'deposit' => 300000,
            'type' => 'deux_chambres',
            'images' => [
                '/assets/rooms/room1.jpg',
                '/assets/rooms/room2.jpg',
            ],
            'videos' => [],
            'equipments' => ['wifi', 'climatisation', 'cuisine', 'tv', 'parking', 'terrasse', 'minibar'],
            'status' => 'available',
        ]);

        $deuxCh4 = Room::create([
            'name' => 'Appartement 2 Chambres - Vue Piscine',
            'slug' => 'appartement-2ch-4',
            'description' => 'Appartement avec vue sur la piscine, deux chambres confortables et un salon lumineux. Profitez de la vue et de la tranquillité du jardin tropical depuis votre balcon privé.',
            'max_occupants' => 4,
            'apartment_number' => 8,
            'base_price' => 118000,
            'deposit' => 300000,
            'type' => 'deux_chambres',
            'images' => [
                '/assets/rooms/room2.jpg',
                '/assets/rooms/room3.jpg',
            ],
            'videos' => [],
            'equipments' => ['wifi', 'climatisation', 'cuisine', 'tv', 'parking', 'piscine', 'balcon'],
            'status' => 'available',
        ]);

        // Catégorie 3: Appartement 1 Chambre (2 disponibles)
        $uneCh1 = Room::create([
            'name' => 'Appartement 1 Chambre - Cosy',
            'slug' => 'appartement-1ch-1',
            'description' => 'Appartement cozy et fonctionnel avec une chambre confortable, salon agréable et kitchenette équipée. Parfait pour les couples ou les voyageurs d\'affaires en quête de tranquillité.',
            'max_occupants' => 2,
            'apartment_number' => 1,
            'base_price' => 85000,
            'deposit' => 200000,
            'type' => 'une_chambre',
            'images' => [
                '/assets/rooms/room3.jpg',
                '/assets/rooms/room1.jpg',
            ],
            'videos' => [],
            'equipments' => ['wifi', 'climatisation', 'cuisine', 'tv', 'minibar'],
            'status' => 'available',
        ]);

        $uneCh2 = Room::create([
            'name' => 'Appartement 1 Chambre - Élégant',
            'slug' => 'appartement-1ch-2',
            'description' => 'Appartement élégant avec chambre spacieuse, salon design et kitchenette moderne. Décoration soignée et ambiance chaleureuse pour un séjour mémorable.',
            'max_occupants' => 2,
            'apartment_number' => 5,
            'base_price' => 85000,
            'deposit' => 200000,
            'type' => 'une_chambre',
            'images' => [
                '/assets/rooms/room1.jpg',
                '/assets/rooms/room2.jpg',
            ],
            'videos' => [],
            'equipments' => ['wifi', 'climatisation', 'cuisine', 'tv', 'minibar', 'balcon'],
            'status' => 'available',
        ]);

        // Prix saisonniers pour les Appartements VIP
        SeasonalPrice::create([
            'room_id' => $vip1->id,
            'name' => 'Haute saison',
            'start_date' => '2024-12-15',
            'end_date' => '2025-01-15',
            'price' => 30000,
        ]);

        SeasonalPrice::create([
            'room_id' => $vip1->id,
            'name' => 'Week-end',
            'start_date' => '2024-01-01',
            'end_date' => '2024-12-31',
            'price' => 30000,
        ]);

        SeasonalPrice::create([
            'room_id' => $vip2->id,
            'name' => 'Haute saison',
            'start_date' => '2024-12-15',
            'end_date' => '2025-01-15',
            'price' => 40000,
        ]);

        // Prix saisonniers pour Appartements 2 Chambres
        SeasonalPrice::create([
            'room_id' => $deuxCh1->id,
            'name' => 'Haute saison',
            'start_date' => '2024-12-15',
            'end_date' => '2025-01-15',
            'price' => 118000,
        ]);

        SeasonalPrice::create([
            'room_id' => $deuxCh2->id,
            'name' => 'Haute saison',
            'start_date' => '2024-12-15',
            'end_date' => '2025-01-15',
            'price' => 118000,
        ]);

        SeasonalPrice::create([
            'room_id' => $deuxCh3->id,
            'name' => 'Haute saison',
            'start_date' => '2024-12-15',
            'end_date' => '2025-01-15',
            'price' => 118000,
        ]);

        SeasonalPrice::create([
            'room_id' => $deuxCh4->id,
            'name' => 'Haute saison',
            'start_date' => '2024-12-15',
            'end_date' => '2025-01-15',
            'price' => 118000,
        ]);

        // Prix saisonniers pour Appartements 1 Chambre
        SeasonalPrice::create([
            'room_id' => $uneCh1->id,
            'name' => 'Haute saison',
            'start_date' => '2024-12-15',
            'end_date' => '2025-01-15',
            'price' => 85000,
        ]);

        SeasonalPrice::create([
            'room_id' => $uneCh2->id,
            'name' => 'Haute saison',
            'start_date' => '2024-12-15',
            'end_date' => '2025-01-15',
            'price' => 85000,
        ]);
    }
}
