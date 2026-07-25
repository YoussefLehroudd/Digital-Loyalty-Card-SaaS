<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Business;
use App\Models\Customer;
use App\Models\CustomerLoyalty;
use App\Models\LoyaltyCard;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PublicCustomerControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_business_lookup_by_slug_returns_business_and_loyalty_card(): void
    {
        $business = Business::factory()->create([
            'name' => 'Star Coffee',
            'slug' => 'star-coffee',
        ]);

        $loyaltyCard = LoyaltyCard::query()->create([
            'business_id' => $business->id,
            'reward_name' => 'Free Latte',
            'required_stamps' => 8,
            'reward_description' => 'Get a free latte after 8 stamps.',
        ]);

        $this
            ->getJson('/api/public/businesses/star-coffee')
            ->assertOk()
            ->assertJsonPath('business.id', (string) $business->id)
            ->assertJsonPath('business.slug', 'star-coffee')
            ->assertJsonPath('business.name', 'Star Coffee')
            ->assertJsonPath('loyalty_card.id', (string) $loyaltyCard->id)
            ->assertJsonPath('loyalty_card.business_id', (string) $business->id)
            ->assertJsonPath('loyalty_card.reward_name', 'Free Latte')
            ->assertJsonPath('loyalty_card.required_stamps', 8);
    }

    public function test_public_customer_registration_creates_customer_and_loyalty_progress_when_card_exists(): void
    {
        $business = Business::factory()->create([
            'slug' => 'star-coffee',
        ]);

        $loyaltyCard = LoyaltyCard::query()->create([
            'business_id' => $business->id,
            'reward_name' => 'Free Drink',
            'required_stamps' => 10,
            'reward_description' => 'Reward description',
        ]);

        $response = $this
            ->postJson('/api/public/businesses/star-coffee/customers/register', [
                'first_name' => 'Ana',
                'last_name' => 'Gomez',
                'email' => 'ana@example.test',
                'phone' => '+1 555 0001',
            ])
            ->assertCreated()
            ->assertJsonPath('message', 'Customer registered successfully.')
            ->assertJsonPath('customer.business_id', (string) $business->id)
            ->assertJsonPath('customer.first_name', 'Ana')
            ->assertJsonPath('customer.last_name', 'Gomez');

        $customerId = (int) $response->json('customer.id');

        $this->assertDatabaseHas('customers', [
            'id' => $customerId,
            'business_id' => $business->id,
            'first_name' => 'Ana',
            'last_name' => 'Gomez',
            'email' => 'ana@example.test',
        ]);

        $this->assertDatabaseHas('customer_loyalties', [
            'customer_id' => $customerId,
            'loyalty_card_id' => $loyaltyCard->id,
            'current_stamps' => 0,
        ]);
    }

    public function test_wallet_lookup_by_qr_code_returns_business_customer_card_and_loyalty(): void
    {
        $business = Business::factory()->create([
            'name' => 'Wallet Coffee',
            'slug' => 'wallet-coffee',
        ]);

        $customer = Customer::factory()->create([
            'business_id' => $business->id,
            'first_name' => 'Wallet',
            'last_name' => 'Owner',
            'qr_code' => 'qr-wallet-123',
        ]);

        $loyaltyCard = LoyaltyCard::query()->create([
            'business_id' => $business->id,
            'reward_name' => 'Free Espresso',
            'required_stamps' => 6,
            'reward_description' => 'Collect six stamps.',
        ]);

        $loyalty = CustomerLoyalty::query()->create([
            'customer_id' => $customer->id,
            'loyalty_card_id' => $loyaltyCard->id,
            'current_stamps' => 3,
        ]);

        $this
            ->getJson('/api/public/customers/wallet/qr-wallet-123')
            ->assertOk()
            ->assertJsonPath('business.id', (string) $business->id)
            ->assertJsonPath('business.slug', 'wallet-coffee')
            ->assertJsonPath('customer.id', (string) $customer->id)
            ->assertJsonPath('customer.qr_code', 'qr-wallet-123')
            ->assertJsonPath('loyalty_card.id', (string) $loyaltyCard->id)
            ->assertJsonPath('loyalty.current_stamps', 3)
            ->assertJsonPath('loyalty.id', (string) $loyalty->id);
    }

    public function test_public_registration_validates_required_fields(): void
    {
        Business::factory()->create([
            'slug' => 'validate-coffee',
        ]);

        $this
            ->postJson('/api/public/businesses/validate-coffee/customers/register', [
                'first_name' => '',
                'last_name' => '',
                'email' => 'not-an-email',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['first_name', 'last_name', 'email']);
    }

    public function test_public_endpoints_return_not_found_for_unknown_resources(): void
    {
        $this
            ->getJson('/api/public/businesses/unknown-business')
            ->assertNotFound()
            ->assertJsonPath('message', 'Business not found.');

        $this
            ->postJson('/api/public/businesses/unknown-business/customers/register', [
                'first_name' => 'Ghost',
                'last_name' => 'User',
            ])
            ->assertNotFound()
            ->assertJsonPath('message', 'Business not found.');

        $this
            ->getJson('/api/public/customers/wallet/unknown-qr')
            ->assertNotFound()
            ->assertJsonPath('message', 'Customer wallet not found.');
    }

    public function test_authenticated_customer_registers_with_business_creates_membership_loyalty_and_qr(): void
    {
        $business = Business::factory()->create([
            'slug' => 'star-coffee',
        ]);

        $loyaltyCard = LoyaltyCard::query()->create([
            'business_id' => $business->id,
            'reward_name' => 'Free Drink',
            'required_stamps' => 10,
            'reward_description' => 'Reward description',
        ]);

        $customerUser = User::factory()->create([
            'role' => UserRole::Customer,
        ]);

        $token = $customerUser->createToken('test')->plainTextToken;

        $response = $this
            ->postJson('/api/public/businesses/star-coffee/customers/register', [
                'first_name' => 'Ana',
                'last_name' => 'Gomez',
                'email' => 'ana@example.test',
                'phone' => '+1 555 0001',
            ], [
                'Authorization' => 'Bearer '.$token,
            ])
            ->assertCreated()
            ->assertJsonPath('message', 'Customer registered successfully.')
            ->assertJsonPath('customer.user_id', (string) $customerUser->id)
            ->assertJsonPath('customer.business_id', (string) $business->id)
            ->assertJsonPath('loyalty_card.id', (string) $loyaltyCard->id);

        $customerId = (int) $response->json('customer.id');

        $this->assertDatabaseHas('customers', [
            'id' => $customerId,
            'user_id' => $customerUser->id,
            'business_id' => $business->id,
            'first_name' => 'Ana',
            'last_name' => 'Gomez',
            'email' => 'ana@example.test',
        ]);

        $this->assertDatabaseHas('customer_loyalties', [
            'customer_id' => $customerId,
            'loyalty_card_id' => $loyaltyCard->id,
            'current_stamps' => 0,
        ]);

        $this->assertDatabaseCount('customers', 1);
    }

    public function test_authenticated_customer_registers_twice_does_not_duplicate_membership(): void
    {
        $business = Business::factory()->create([
            'slug' => 'star-coffee',
        ]);

        LoyaltyCard::query()->create([
            'business_id' => $business->id,
            'reward_name' => 'Free Drink',
            'required_stamps' => 10,
            'reward_description' => 'Reward description',
        ]);

        $customerUser = User::factory()->create([
            'role' => UserRole::Customer,
        ]);

        $token = $customerUser->createToken('test')->plainTextToken;

        $payload = [
            'first_name' => 'Ana',
            'last_name' => 'Gomez',
            'email' => 'ana@example.test',
            'phone' => '+1 555 0001',
        ];

        $this
            ->postJson('/api/public/businesses/star-coffee/customers/register', $payload, [
                'Authorization' => 'Bearer '.$token,
            ])
            ->assertCreated();

        $this
            ->postJson('/api/public/businesses/star-coffee/customers/register', $payload, [
                'Authorization' => 'Bearer '.$token,
            ])
            ->assertCreated();

        $this->assertDatabaseCount('customers', 1);

        $this->assertDatabaseHas('customers', [
            'user_id' => $customerUser->id,
            'business_id' => $business->id,
        ]);
    }

    public function test_guest_customer_register_behavior_unchanged(): void
    {
        $business = Business::factory()->create([
            'slug' => 'star-coffee',
        ]);

        $loyaltyCard = LoyaltyCard::query()->create([
            'business_id' => $business->id,
            'reward_name' => 'Free Drink',
            'required_stamps' => 10,
            'reward_description' => 'Reward description',
        ]);

        $this
            ->postJson('/api/public/businesses/star-coffee/customers/register', [
                'first_name' => 'Ana',
                'last_name' => 'Gomez',
                'email' => 'ana@example.test',
                'phone' => '+1 555 0001',
            ])
            ->assertCreated()
            ->assertJsonPath('message', 'Customer registered successfully.')
            ->assertJsonPath('customer.business_id', (string) $business->id)
            ->assertJsonPath('customer.user_id', null)
            ->assertJsonPath('loyalty_card', null);

        // Loyalty progress is still created for guest flow if a loyalty card exists.
        $customer = Customer::query()->where('business_id', $business->id)->first();
        $this->assertNotNull($customer);
        $this->assertDatabaseHas('customer_loyalties', [
            'customer_id' => $customer->id,
            'loyalty_card_id' => $loyaltyCard->id,
            'current_stamps' => 0,
        ]);
    }

    public function test_authenticated_admin_cannot_link_customer_membership(): void
    {
        $business = Business::factory()->create([
            'slug' => 'star-coffee',
        ]);

        User::factory()->create([
            'role' => UserRole::BusinessOwner,
        ]);

        $adminUser = User::factory()->create([
            'role' => UserRole::BusinessOwner,
        ]);

        $token = $adminUser->createToken('test')->plainTextToken;

        $this
            ->postJson('/api/public/businesses/star-coffee/customers/register', [
                'first_name' => 'Admin',
                'last_name' => 'User',
                'email' => 'admin@example.test',
            ], [
                'Authorization' => 'Bearer '.$token,
            ])
            ->assertForbidden()
            ->assertJsonPath('message', 'Forbidden.');

        $this->assertDatabaseCount('customers', 0);
    }

    public function test_authenticated_business_owner_cannot_link_customer_membership(): void
    {
        $business = Business::factory()->create([
            'slug' => 'star-coffee',
        ]);

        $businessOwner = User::factory()->create([
            'role' => UserRole::BusinessOwner,
        ]);

        $token = $businessOwner->createToken('test')->plainTextToken;

        $this
            ->postJson('/api/public/businesses/star-coffee/customers/register', [
                'first_name' => 'Owner',
                'last_name' => 'User',
                'email' => 'owner@example.test',
            ], [
                'Authorization' => 'Bearer '.$token,
            ])
            ->assertForbidden()
            ->assertJsonPath('message', 'Forbidden.');

        $this->assertDatabaseCount('customers', 0);
    }
}
