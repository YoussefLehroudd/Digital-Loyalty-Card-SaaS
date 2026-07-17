<?php

namespace Database\Seeders;

use App\Models\LoyaltyCard;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $owner = User::factory()
            ->businessOwner()
            ->create([
                'name' => 'Test Business Owner',
                'email' => 'owner@example.com',
            ]);

        $business = $owner->business;

        if ($business) {
            LoyaltyCard::query()->create([
                'business_id' => $business->id,
                'reward_name' => 'Free Coffee',
                'required_stamps' => 10,
                'reward_description' => 'Get a free coffee after collecting 10 stamps.',
            ]);
        }
    }
}
