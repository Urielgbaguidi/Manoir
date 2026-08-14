<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        foreach (\App\Models\RoomCategory::all() as $category) {
            $videos = $category->videos;
            if (is_array($videos)) {
                $cleanedVideos = array_map(function ($video) {
                    return preg_replace('#^(https?://[^/]+)\1#', '$1', $video);
                }, $videos);

                if ($cleanedVideos !== $videos) {
                    $category->update(['videos' => $cleanedVideos]);
                }
            }
        }

        foreach (\App\Models\Room::all() as $room) {
            $videos = $room->videos;
            if (is_array($videos)) {
                $cleanedVideos = array_map(function ($video) {
                    return preg_replace('#^(https?://[^/]+)\1#', '$1', $video);
                }, $videos);

                if ($cleanedVideos !== $room->videos) {
                    $room->update(['videos' => $cleanedVideos]);
                }
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        //
     }
};
