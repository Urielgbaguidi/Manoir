<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        // Admin
        User::create([
            'name' => 'Admin Manoir',
            'email' => 'admin@manoir.com',
            'password' => Hash::make('password123'),
            'is_admin' => true,
        ]);

        // Client test
        User::create([
            'name' => 'Jean Dupont',
            'email' => 'client@test.com',
            'password' => Hash::make('password123'),
            'is_admin' => false,
        ]);
    }
}
