<?php

namespace Database\Factories;

use App\Models\Business;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Business>
 */
class BusinessFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $name = fake()->company();
        $base = Str::slug($name);
        $base = $base !== '' ? $base : 'business';

        $slug = $base;
        $suffix = 1;

        while (Business::query()->where('slug', $slug)->exists()) {
            $suffix++;
            $slug = $base.'-'.$suffix;
        }

        return [
            'name' => $name,
            'slug' => $slug,
            'email' => fake()->unique()->companyEmail(),
            'primary_color' => '#171717',
            'phone' => fake()->optional()->phoneNumber(),
            'address' => fake()->optional()->address(),
        ];
    }
}
