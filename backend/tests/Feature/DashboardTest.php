<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\Customer;
use App\Models\RewardRedemption;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DashboardTest extends TestCase
{
    use RefreshDatabase;

    public function test_business_dashboard_metrics_are_scoped_to_authenticated_business(): void
    {
        $business = Business::factory()->create([
            'name' => 'Star Coffee',
        ]);
        $otherBusiness = Business::factory()->create();
        $user = User::factory()->businessOwner($business)->create();

        $activeCustomer = Customer::factory()->create([
            'business_id' => $business->id,
        ]);
        Customer::factory()->create([
            'business_id' => $business->id,
        ]);
        $otherCustomer = Customer::factory()->create([
            'business_id' => $otherBusiness->id,
        ]);

        Visit::factory()->create([
            'business_id' => $business->id,
            'customer_id' => $activeCustomer->id,
            'date' => now()->subDays(5),
        ]);
        Visit::factory()->create([
            'business_id' => $business->id,
            'customer_id' => $activeCustomer->id,
            'date' => now()->subMonths(2),
        ]);
        Visit::factory()->create([
            'business_id' => $otherBusiness->id,
            'customer_id' => $otherCustomer->id,
            'date' => now(),
        ]);

        RewardRedemption::factory()->count(2)->create([
            'business_id' => $business->id,
            'customer_id' => $activeCustomer->id,
        ]);
        RewardRedemption::factory()->create([
            'business_id' => $otherBusiness->id,
            'customer_id' => $otherCustomer->id,
        ]);

        Sanctum::actingAs($user);

        $this
            ->getJson('/api/dashboard')
            ->assertOk()
            ->assertJsonPath('business.name', 'Star Coffee')
            ->assertJsonPath('metrics.total_customers', 2)
            ->assertJsonPath('metrics.active_customers', 1)
            ->assertJsonPath('metrics.visits_this_month', 1)
            ->assertJsonPath('metrics.rewards_redeemed', 2);
    }

    public function test_dashboard_requires_authenticated_business_owner(): void
    {
        $this->getJson('/api/dashboard')->assertUnauthorized();
    }
}
