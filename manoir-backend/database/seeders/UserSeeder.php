<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        // Les roles ne sont pas assignables en masse (moindre privilege) :
        // ils sont poses explicitement.
        User::create([
            'name' => 'Admin Manoir',
            'email' => 'admin@manoir.com',
            'phone' => '+22990000000',
            'country' => 'BJ',
            'password' => Hash::make('password123'),
        ])->forceFill([
            'is_admin' => true,
            'is_super_admin' => true,
            'email_verified_at' => now(),
        ])->save();

        User::create([
            'name' => 'Jean Dupont',
            'email' => 'client@test.com',
            'phone' => '+22991000000',
            'country' => 'BJ',
            'password' => Hash::make('password123'),
        ])->forceFill(['email_verified_at' => now()])->save();
    }
}
