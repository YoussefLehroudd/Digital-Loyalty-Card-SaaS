<?php

namespace Database\Factories;

use App\Models\Business;
use App\Models\Customer;
use App\Models\RewardRedemption;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<RewardRedemption>
 */
class RewardRedemptionFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'business_id' => Business::factory(),
            'customer_id' => Customer::factory(),
            'date' => now(),
        ];
    }
}
