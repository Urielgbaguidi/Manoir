<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Room;
use App\Models\RoomCategory;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoomCategoryController extends Controller
{
    public function index(): JsonResponse
    {
        $categories = RoomCategory::orderBy('id')->get()
            ->map(fn (RoomCategory $category) => $this->withUnits($category));

        return response()->json($categories);
    }

    public function show(string $category): JsonResponse
    {
        $roomCategory = RoomCategory::findBySlugOrType($category);

        if (! $roomCategory) {
            return response()->json(['message' => 'Categorie introuvable.'], 404);
        }

        return response()->json($this->withUnits($roomCategory));
    }

    public function checkAvailability(Request $request, string $category): JsonResponse
    {
        $request->validate([
            'check_in' => 'required|date|after_or_equal:today',
            'check_out' => 'required|date|after:check_in',
            'room_id' => 'nullable|integer|exists:rooms,id',
        ]);

        $roomCategory = RoomCategory::findBySlugOrType($category);

        if (! $roomCategory) {
            return response()->json(['message' => 'Categorie introuvable.'], 404);
        }

        $nights = max(1, Carbon::parse($request->check_in)->diffInDays(Carbon::parse($request->check_out)));
        $demande = $request->integer('room_id') ?: null;
        $room = $roomCategory->availableRoomForDates(
            $request->check_in,
            $request->check_out,
            $demande
        );

        // Meme quand d'autres appartements sont libres sur les dates voulues,
        // celui que le client consulte doit dire quand IL se libere : sinon sa
        // seule issue est d'en changer, alors qu'il tient peut-etre a celui-la.
        $ownWindow = null;
        if ($room === null && $demande) {
            $ownWindow = Room::find($demande)?->longestFreeWindow($request->check_in, $request->check_out);
        }
        // Chaque appartement a ses propres tarifs : ils priment sur ceux de la
        // categorie, sinon le client verrait un prix sur la fiche et serait
        // facture a un autre.
        $pricePerNight = (int) ($room?->base_price ?: $roomCategory->price_per_night);
        $depositPerDay = (int) ($room?->deposit ?: $roomCategory->deposit_per_day);

        // Rien de plus decourageant qu'un « aucun appartement disponible » sans
        // suite : quand la demande echoue, on liste ce qui reste libre sur ces
        // memes dates, toutes categories confondues.
        $alternatives = [];
        if ($room === null) {
            $categoriesParType = RoomCategory::all()->keyBy('type');

            $alternatives = Room::query()
                ->where('status', 'available')
                ->whereNotNull('apartment_number')
                ->orderBy('apartment_number')
                ->get()
                ->filter(fn (Room $autre) => $autre->isAvailableForDates($request->check_in, $request->check_out))
                ->map(function (Room $autre) use ($categoriesParType, $nights) {
                    $categorie = $categoriesParType->get($autre->type);
                    $prix = (int) ($autre->base_price ?: $categorie?->price_per_night ?: 0);

                    return [
                        'id' => $autre->id,
                        'slug' => $autre->slug,
                        'apartment_number' => $autre->apartment_number,
                        'type' => $autre->type,
                        'category_label' => $categorie?->label,
                        'category_slug' => $categorie?->slug,
                        'price_per_night' => $prix,
                        'price' => $prix * $nights,
                        'image' => $autre->images[0] ?? null,
                    ];
                })
                ->values()
                ->all();
        }

        // Si rien n'est libre sur toute la duree, on propose les plus longs
        // creneaux possibles a l'interieur de la periode : le client sait alors
        // quoi raccourcir, au lieu de chercher a l'aveugle.
        $suggestions = [];
        if ($room === null && $alternatives === []) {
            $categoriesParType = RoomCategory::all()->keyBy('type');

            $suggestions = Room::query()
                ->where('status', 'available')
                ->whereNotNull('apartment_number')
                ->orderBy('apartment_number')
                ->get()
                ->map(function (Room $autre) use ($request, $categoriesParType) {
                    $creneau = $autre->longestFreeWindow($request->check_in, $request->check_out);

                    if ($creneau === null) {
                        return null;
                    }

                    $categorie = $categoriesParType->get($autre->type);
                    $prix = (int) ($autre->base_price ?: $categorie?->price_per_night ?: 0);

                    return [
                        'id' => $autre->id,
                        'slug' => $autre->slug,
                        'apartment_number' => $autre->apartment_number,
                        'category_label' => $categorie?->label,
                        'category_slug' => $categorie?->slug,
                        'price_per_night' => $prix,
                        'starts_on' => $creneau['starts_on'],
                        'ends_on' => $creneau['ends_on'],
                        'nights' => $creneau['nights'],
                    ];
                })
                ->filter()
                // Celui que le client consulte est deja annonce par
                // `own_window` : le remettre ici ferait doublon.
                ->reject(fn ($creneau) => $demande !== null && $creneau['id'] === $demande)
                // Le plus long creneau en premier : c'est le plus proche de ce
                // que le client voulait.
                ->sortByDesc('nights')
                ->take(4)
                ->values()
                ->all();
        }

        return response()->json([
            'available' => $room !== null,
            'price' => $pricePerNight * $nights,
            'deposit_per_day' => $depositPerDay,
            'available_room' => $room,
            'own_window' => $ownWindow,
            'alternatives' => $alternatives,
            'suggestions' => $suggestions,
        ]);
    }

    private function withUnits(RoomCategory $category): RoomCategory
    {
        $query = $category->rooms()
            ->orderBy('apartment_number')
            ->orderBy('id');

        if ($category->type === 'vip') {
            $query->where(function ($query) {
                $query->whereIn('slug', ['appartement-vip-1', 'appartement-vip-2', 'vip-3', 'vip-7'])
                    ->orWhereIn('apartment_number', [3, 7]);
            });
        } else {
            $query->where('status', 'available');
        }

        // Chaque appartement porte son etat d'occupation : le client voit
        // immediatement, sur la carte, s'il est libre ou pris et jusqu'a quand.
        $units = $query->get()->each(
            fn (Room $room) => $room->setAttribute('availability', $room->availabilitySummary())
        );

        $category->setRelation('units', $units);

        return $category;
    }
}
