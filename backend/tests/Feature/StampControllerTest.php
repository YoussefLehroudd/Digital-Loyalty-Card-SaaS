<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\Customer;
use App\Models\CustomerLoyalty;
use App\Models\LoyaltyCard;
use App\Models\RewardRedemption;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class StampControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_valid_qr_adds_stamp(): void
    {
        $business = Business::factory()->create();
        $user = User::factory()->businessOwner($business)->create();

        $loyaltyCard = LoyaltyCard::query()->create([
            'business_id' => $business->id,
            'reward_name' => 'Free coffee',
            'required_stamps' => 3,
            'reward_description' => '1 reward after 3 stamps',
        ]);

        $customer = Customer::factory()->create([
            'business_id' => $business->id,
            'qr_code' => 'cus_valid_1',
        ]);

        CustomerLoyalty::query()->create([
            'customer_id' => $customer->id,
            'loyalty_card_id' => $loyaltyCard->id,
            'current_stamps' => 0,
        ]);

        Sanctum::actingAs($user);

        $this
            ->postJson('/api/stamp', [
                'qr_code' => 'cus_valid_1',
            ])
            ->assertCreated()
            ->assertJsonPath('message', 'Stamp added successfully.')
            ->assertJsonPath('loyalty.current_stamps', 1)
            ->assertJsonPath('loyalty.reward_unlocked', false);

        $this->assertDatabaseCount('visits', 1);

        $this->assertDatabaseHas('customer_loyalties', [
            'customer_id' => $customer->id,
            'loyalty_card_id' => $loyaltyCard->id,
            'current_stamps' => 1,
        ]);

        $this->assertDatabaseCount('reward_redemptions', 0);
    }

    public function test_invalid_qr_returns_404(): void
    {
        $business = Business::factory()->create();
        $user = User::factory()->businessOwner($business)->create();

        Sanctum::actingAs($user);

        $this
            ->postJson('/api/stamp', [
                'qr_code' => 'cus_invalid',
            ])
            ->assertNotFound();

        $this->assertDatabaseCount('visits', 0);
        $this->assertDatabaseCount('reward_redemptions', 0);
    }

    public function test_customer_from_another_business_is_blocked(): void
    {
        $businessA = Business::factory()->create();
        $businessB = Business::factory()->create();

        $userA = User::factory()->businessOwner($businessA)->create();

        $loyaltyCardA = LoyaltyCard::query()->create([
            'business_id' => $businessA->id,
            'reward_name' => 'Free coffee',
            'required_stamps' => 3,
            'reward_description' => '1 reward after 3 stamps',
        ]);

        $customerB = Customer::factory()->create([
            'business_id' => $businessB->id,
            'qr_code' => 'cus_other_business',
        ]);

        // CustomerLoyalty exists, but still should not be accessible from business A.
        CustomerLoyalty::query()->create([
            'customer_id' => $customerB->id,
            'loyalty_card_id' => $loyaltyCardA->id, // intentionally “wrong” mapping; shouldn’t matter for 404 check
            'current_stamps' => 0,
        ]);

        Sanctum::actingAs($userA);

        $this
            ->postJson('/api/stamp', [
                'qr_code' => 'cus_other_business',
            ])
            ->assertNotFound();

        $this->assertDatabaseCount('visits', 0);
        $this->assertDatabaseCount('reward_redemptions', 0);
    }

    public function test_reward_unlocks_when_stamps_reach_target(): void
    {
        $business = Business::factory()->create();
        $user = User::factory()->businessOwner($business)->create();

        $loyaltyCard = LoyaltyCard::query()->create([
            'business_id' => $business->id,
            'reward_name' => 'Free coffee',
            'required_stamps' => 2,
            'reward_description' => 'Reward after 2 stamps',
        ]);

        $customer = Customer::factory()->create([
            'business_id' => $business->id,
            'qr_code' => 'cus_reward_1',
        ]);

        CustomerLoyalty::query()->create([
            'customer_id' => $customer->id,
            'loyalty_card_id' => $loyaltyCard->id,
            'current_stamps' => 1,
        ]);

        Sanctum::actingAs($user);

        $this
            ->postJson('/api/stamp', [
                'qr_code' => 'cus_reward_1',
            ])
            ->assertCreated()
            ->assertJsonPath('loyalty.current_stamps', 2)
            ->assertJsonPath('loyalty.reward_unlocked', true);

        $this->assertDatabaseCount('visits', 1);

        $this->assertDatabaseHas('reward_redemptions', [
            'business_id' => $business->id,
            'customer_id' => $customer->id,
        ]);

        $this->assertDatabaseHas('customer_loyalties', [
            'customer_id' => $customer->id,
            'loyalty_card_id' => $loyaltyCard->id,
            'current_stamps' => 2,
        ]);
    }
}
