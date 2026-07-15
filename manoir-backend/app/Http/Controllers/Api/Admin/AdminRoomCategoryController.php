<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\RoomCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class AdminRoomCategoryController extends Controller
{
    public function index(): JsonResponse
    {
        $categories = RoomCategory::orderBy('id')->get()
            ->map(fn (RoomCategory $category) => $this->withUnits($category));

        return response()->json($categories);
    }

    public function update(Request $request, string $category): JsonResponse
    {
        $roomCategory = RoomCategory::findBySlugOrType($category);

        if (! $roomCategory) {
            return response()->json(['message' => 'Categorie introuvable.'], 404);
        }

        $data = $request->validate([
            'label' => 'sometimes|required|string|max:255',
            'rank_label' => 'sometimes|required|string|max:255',
            'short_description' => 'sometimes|required|string|max:500',
            'full_description' => 'sometimes|required|string',
            'price_per_night' => 'sometimes|required|integer|min:0',
            'deposit_per_day' => 'sometimes|required|integer|min:0',
            'is_blocked' => 'sometimes|boolean',
            'images' => 'sometimes|array',
            'images.*' => 'string',
            'videos' => 'sometimes|array',
            'videos.*' => 'string',
        ]);

        $roomCategory->update($data);

        return response()->json([
            'message' => 'Categorie mise a jour avec succes.',
            'category' => $this->withUnits($roomCategory->fresh()),
        ]);
    }

    public function uploadMedia(Request $request, string $category): JsonResponse
    {
        $roomCategory = RoomCategory::findBySlugOrType($category);

        if (! $roomCategory) {
            return response()->json(['message' => 'Categorie introuvable.'], 404);
        }

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

        $path = $request->file('file')->store("room-categories/{$roomCategory->type}/{$data['kind']}", 'public');
        $url = $request->getSchemeAndHttpHost().Storage::url($path);
        $media = $roomCategory->{$data['kind']} ?? [];
        $media[] = $url;

        $roomCategory->update([
            $data['kind'] => $media,
        ]);

        return response()->json([
            'message' => $data['kind'] === 'images'
                ? 'Photo ajoutee avec succes.'
                : 'Video ajoutee avec succes.',
            'url' => $url,
            'category' => $this->withUnits($roomCategory->fresh()),
        ], 201);
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
        }

        $category->setRelation(
            'units',
            $query->get()
        );

        return $category;
    }
}
