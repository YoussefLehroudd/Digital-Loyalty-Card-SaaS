<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\Customer;
use App\Models\CustomerLoyalty;
use App\Models\LoyaltyCard;
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
}
