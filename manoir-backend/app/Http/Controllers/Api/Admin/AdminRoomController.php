<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Room;
use App\Models\RoomCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class AdminRoomController extends Controller
{
    public function index(): JsonResponse
    {
        $rooms = Room::orderBy('type')->orderBy('apartment_number')->orderBy('name')->get();

        return response()->json($rooms);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255|unique:rooms,name',
            'description' => 'required|string',
            'max_occupants' => 'required|integer|min:1',
            'apartment_number' => 'nullable|integer|min:0',
            'base_price' => 'required|integer|min:0',
            'deposit' => 'nullable|integer|min:0',
            'type' => 'required|string|in:vip,deux_chambres,une_chambre,standard,deluxe,suite',
            'equipments' => 'nullable|array',
            'equipments.*' => 'string',
            'images' => 'nullable|array',
            'images.*' => 'string',
            'videos' => 'nullable|array',
            'videos.*' => 'string',
            'status' => 'nullable|string|in:available,unavailable',
        ]);

        $room = Room::create([
            'name' => $request->name,
            'slug' => Str::slug($request->name),
            'description' => $request->description,
            'max_occupants' => $request->max_occupants,
            'apartment_number' => $request->apartment_number,
            'base_price' => $request->base_price,
            'deposit' => $request->deposit,
            'type' => $request->type,
            'equipments' => $request->equipments ?? [],
            'images' => $request->images ?? [],
            'videos' => $request->videos ?? [],
            'status' => $request->status ?? 'available',
        ]);

        $this->syncCategoryPrice($room);

        return response()->json([
            'message' => 'Appartement cree avec succes.',
            'room' => $room,
        ], 201);
    }

    public function show(string $id): JsonResponse
    {
        return response()->json(Room::findOrFail($id));
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $room = Room::findOrFail($id);

        $request->validate([
            'name' => 'sometimes|required|string|max:255|unique:rooms,name,'.$room->id,
            'description' => 'sometimes|required|string',
            'max_occupants' => 'sometimes|required|integer|min:1',
            'apartment_number' => 'sometimes|nullable|integer|min:0',
            'base_price' => 'sometimes|required|integer|min:0',
            'deposit' => 'sometimes|nullable|integer|min:0',
            'type' => 'sometimes|required|string|in:vip,deux_chambres,une_chambre,standard,deluxe,suite',
            'equipments' => 'nullable|array',
            'equipments.*' => 'string',
            'images' => 'nullable|array',
            'images.*' => 'string',
            'videos' => 'nullable|array',
            'videos.*' => 'string',
            'status' => 'sometimes|required|string|in:available,unavailable',
        ]);

        $data = $request->only([
            'name',
            'description',
            'max_occupants',
            'apartment_number',
            'base_price',
            'deposit',
            'type',
            'equipments',
            'images',
            'videos',
            'status',
        ]);

        if (array_key_exists('name', $data)) {
            $data['slug'] = Str::slug($data['name']);
        }

        $room->update($data);
        $room = $room->fresh();
        $this->syncCategoryPrice($room);

        return response()->json([
            'message' => 'Appartement mis a jour avec succes.',
            'room' => $room,
        ]);
    }

    public function uploadMedia(Request $request, string $id): JsonResponse
    {
        $room = Room::findOrFail($id);

        $data = $request->validate([
            'kind' => 'required|in:images,videos',
            'file' => [
                'required',
                'file',
                $request->input('kind') === 'videos'
                    ? 'mimetypes:video/mp4,video/quicktime,video/x-msvideo,video/webm|max:51200'
                    : 'mimes:jpg,jpeg,png,webp,avif|max:10240',
            ],
        ]);

        $path = $request->file('file')->store("rooms/{$room->slug}/{$data['kind']}", 'public');
        $url = $request->getSchemeAndHttpHost().Storage::url($path);
        $media = $room->{$data['kind']} ?? [];
        $media[] = $url;

        $room->update([
            $data['kind'] => $media,
        ]);

        return response()->json([
            'message' => $data['kind'] === 'images'
                ? 'Photo ajoutee avec succes.'
                : 'Video ajoutee avec succes.',
            'url' => $url,
            'room' => $room->fresh(),
        ], 201);
    }

    public function destroy(string $id): JsonResponse
    {
        $room = Room::findOrFail($id);
        $room->delete();
        $this->syncCategoryPrice($room);

        return response()->json([
            'message' => 'Appartement supprime avec succes.',
        ]);
    }

    private function syncCategoryPrice(Room $room): void
    {
        if (! in_array($room->type, RoomCategory::TYPES, true)) {
            return;
        }

        $category = RoomCategory::where('type', $room->type)->first();

        if (! $category) {
            return;
        }

        if ($room->type === 'vip') {
            $minPrice = Room::where('type', 'vip')->min('base_price');
            $category->update([
                'price_per_night' => (int) ($minPrice ?? $room->base_price),
            ]);
        }
    }
}
