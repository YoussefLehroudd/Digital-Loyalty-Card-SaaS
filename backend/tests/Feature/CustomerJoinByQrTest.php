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

        $qr = 'http://localhost:3000/star-coffee';

        $response = $this->postJson('/api/user/join-by-qr', [
            'qr' => $qr,
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

    public function test_joinbyqr_supports_raw_slug_format(): void
    {
        $business = Business::factory()->create([
            'slug' => 'star-coffee',
            'name' => 'Star Coffee',
        ]);

        LoyaltyCard::query()->create([
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

        $this->postJson('/api/user/join-by-qr', [
            'qr' => 'star-coffee',
        ], [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk();

        $this->assertDatabaseHas('customers', [
            'user_id' => $user->id,
            'business_id' => $business->id,
        ]);
    }

    public function test_joinbyqr_supports_full_url_with_trailing_slash(): void
    {
        $business = Business::factory()->create([
            'slug' => 'star-coffee',
            'name' => 'Star Coffee',
        ]);

        LoyaltyCard::query()->create([
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

        $this->postJson('/api/user/join-by-qr', [
            'qr' => 'https://example.com/star-coffee/',
        ], [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk();

        $this->assertDatabaseHas('customers', [
            'user_id' => $user->id,
            'business_id' => $business->id,
        ]);
    }

    public function test_joinbyqr_supports_url_with_slug_query_param(): void
    {
        $business = Business::factory()->create([
            'slug' => 'star-coffee',
            'name' => 'Star Coffee',
        ]);

        LoyaltyCard::query()->create([
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

        $this->postJson('/api/user/join-by-qr', [
            'qr' => 'https://example.com/join?slug=star-coffee',
        ], [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk();

        $this->assertDatabaseHas('customers', [
            'user_id' => $user->id,
            'business_id' => $business->id,
        ]);
    }

    public function test_joinbyqr_supports_url_with_business_slug_query_param(): void
    {
        $business = Business::factory()->create([
            'slug' => 'star-coffee',
            'name' => 'Star Coffee',
        ]);

        LoyaltyCard::query()->create([
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

        $this->postJson('/api/user/join-by-qr', [
            'qr' => 'https://example.com/join?business_slug=star-coffee',
        ], [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk();

        $this->assertDatabaseHas('customers', [
            'user_id' => $user->id,
            'business_id' => $business->id,
        ]);
    }

    public function test_joinbyqr_supports_slug_anywhere_in_path(): void
    {
        $business = Business::factory()->create([
            'slug' => 'star-coffee',
            'name' => 'Star Coffee',
        ]);

        LoyaltyCard::query()->create([
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

        // Slug appears in the middle; last segment is not the slug.
        $this->postJson('/api/user/join-by-qr', [
            'qr' => 'https://example.com/businesses/star-coffee/join',
        ], [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk();

        $this->assertDatabaseHas('customers', [
            'user_id' => $user->id,
            'business_id' => $business->id,
        ]);
    }

    public function test_joinbyqr_supports_url_encoded_slug(): void
    {
        $business = Business::factory()->create([
            'slug' => 'star-coffee',
            'name' => 'Star Coffee',
        ]);

        LoyaltyCard::query()->create([
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

        // Encode slashes/spaces are typical; here encode the slug itself (still valid slug after decoding).
        $this->postJson('/api/user/join-by-qr', [
            'qr' => 'https://example.com/star-coffee%20',
        ], [
            'Authorization' => 'Bearer '.$token,
        ])->assertOk();

        $this->assertDatabaseHas('customers', [
            'user_id' => $user->id,
            'business_id' => $business->id,
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
