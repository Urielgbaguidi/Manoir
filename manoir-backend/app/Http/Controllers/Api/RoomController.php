<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Room;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RoomController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Room::where('status', 'available');

        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        if ($request->has('min_price') && $request->has('max_price')) {
            $query->whereBetween('base_price', [$request->min_price, $request->max_price]);
        }

        if ($request->has('check_in') && $request->has('check_out')) {
            $rooms = Room::all()->filter(function ($room) use ($request) {
                return $room->isAvailableForDates($request->check_in, $request->check_out);
            });

            return response()->json($rooms->values());
        }

        $rooms = $query->get();

        return response()->json($rooms);
    }

    public function show(string $slug): JsonResponse
    {
        $room = Room::where('slug', $slug)->firstOrFail();

        return response()->json($room);
    }

    public function checkAvailability(Request $request, string $slug): JsonResponse
    {
        $request->validate([
            'check_in' => 'required|date|after_or_equal:today',
            'check_out' => 'required|date|after:check_in',
        ]);

        $room = Room::where('slug', $slug)->firstOrFail();
        $available = $room->isAvailableForDates($request->check_in, $request->check_out);
        $price = $room->getPriceForDates($request->check_in, $request->check_out);

        return response()->json([
            'available' => $available,
            'price' => $price,
            'check_in' => $request->check_in,
            'check_out' => $request->check_out,
        ]);
    }
}
