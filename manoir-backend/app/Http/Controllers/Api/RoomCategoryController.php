<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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
        $room = $roomCategory->availableRoomForDates(
            $request->check_in,
            $request->check_out,
            $request->integer('room_id') ?: null
        );
        $pricePerNight = $room?->base_price ?: $roomCategory->price_per_night;

        return response()->json([
            'available' => $room !== null,
            'price' => $pricePerNight * $nights,
            'deposit_per_day' => $room?->deposit ?: $roomCategory->deposit_per_day,
            'available_room' => $room,
        ]);
    }

    private function withUnits(RoomCategory $category): RoomCategory
    {
        $query = $category->rooms()
            ->orderBy('apartment_number')
            ->orderBy('id');

        if ($category->type === 'vip') {
            $query->whereIn('slug', ['appartement-vip-1', 'appartement-vip-2']);
        } else {
            $query->where('status', 'available');
        }

        $category->setRelation(
            'units',
            $query->get()
        );

        return $category;
    }
}
