<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Business;
use App\Models\LoyaltyCard;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerJoinByQrTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_scans_valid_business_qr_and_membership_is_created(): void
    {
        $business = Business::factory()->create([
            'slug' => 'star-coffee',
            'name' => 'Star Coffee',
        ]);

        $loyaltyCard = LoyaltyCard::query()->create([
            'business_id' => $business->id,
            'reward_name' => 'Free Latte',
            'required_stamps' => 8,
            'reward_description' => 'After 8 stamps',
        ]);

        $user = User::factory()->create([
            'role' => UserRole::Customer,
            'name' => 'Ana Gomez',
            'email' => 'ana@example.test',
        ]);

        $token = $user->createToken('test')->plainTextToken;

        $response = $this->postJson('/api/user/join-by-qr', [
            'qr' => 'http://localhost:3000/star-coffee',
        ], [
            'Authorization' => 'Bearer '.$token,
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('business.slug', 'star-coffee')
            ->assertJsonPath('loyalty_card.id', (string) $loyaltyCard->id);

        $this->assertDatabaseHas('customers', [
            'user_id' => $user->id,
            'business_id' => $business->id,
        ]);

        $this->assertDatabaseHas('customer_loyalties', [
            'loyalty_card_id' => $loyaltyCard->id,
            'current_stamps' => 0,
        ]);
    }

    public function test_duplicate_scan_does_not_create_duplicate_membership_or_loyalty(): void
    {
        $business = Business::factory()->create([
            'slug' => 'star-coffee',
        ]);

        $loyaltyCard = LoyaltyCard::query()->create([
            'business_id' => $business->id,
            'reward_name' => 'Free Drink',
            'required_stamps' => 10,
            'reward_description' => null,
        ]);

        $user = User::factory()->create([
            'role' => UserRole::Customer,
            'name' => 'Ana Gomez',
            'email' => 'ana@example.test',
        ]);

        $token = $user->createToken('test')->plainTextToken;

        $this->postJson('/api/user/join-by-qr', [
            'qr' => 'star-coffee',
        ], [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk();

        $this->postJson('/api/user/join-by-qr', [
            'qr' => 'https://example.com/star-coffee',
        ], [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk();

        $this->assertDatabaseCount('customers', 1);
        $this->assertDatabaseCount('customer_loyalties', 1);

        $this->assertDatabaseHas('customer_loyalties', [
            'loyalty_card_id' => $loyaltyCard->id,
        ]);
    }

    public function test_invalid_qr_returns_validation_error(): void
    {
        $user = User::factory()->create([
            'role' => UserRole::Customer,
        ]);

        $token = $user->createToken('test')->plainTextToken;

        $this->postJson('/api/user/join-by-qr', [
            'qr' => 'not a valid qr ###',
        ], [
            'Authorization' => 'Bearer '.$token,
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['qr']);
    }
}
