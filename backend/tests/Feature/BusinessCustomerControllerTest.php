<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\Customer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BusinessCustomerControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_business_owner_can_list_only_their_customers(): void
    {
        $business = Business::factory()->create();
        $otherBusiness = Business::factory()->create();

        $user = User::factory()->businessOwner($business)->create();

        $customerOne = Customer::factory()->create([
            'business_id' => $business->id,
            'first_name' => 'Alice',
            'last_name' => 'Brew',
        ]);
        $customerTwo = Customer::factory()->create([
            'business_id' => $business->id,
            'first_name' => 'Bob',
            'last_name' => 'Roast',
        ]);
        Customer::factory()->create([
            'business_id' => $otherBusiness->id,
            'first_name' => 'Eve',
            'last_name' => 'Other',
        ]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/business/customers');

        $response
            ->assertOk()
            ->assertJsonCount(2, 'customers')
            ->assertJsonPath('customers.0.business_id', (string) $business->id)
            ->assertJsonPath('customers.1.business_id', (string) $business->id);

        $customerIds = collect($response->json('customers'))->pluck('id')->all();

        $this->assertContains((string) $customerOne->id, $customerIds);
        $this->assertContains((string) $customerTwo->id, $customerIds);
    }

    public function test_business_owner_can_search_only_within_their_customers(): void
    {
        $business = Business::factory()->create();
        $otherBusiness = Business::factory()->create();

        $user = User::factory()->businessOwner($business)->create();

        $match = Customer::factory()->create([
            'business_id' => $business->id,
            'first_name' => 'Maria',
            'last_name' => 'Lopez',
            'email' => 'maria@example.test',
        ]);

        Customer::factory()->create([
            'business_id' => $business->id,
            'first_name' => 'John',
            'last_name' => 'Stone',
            'email' => 'john@example.test',
        ]);

        Customer::factory()->create([
            'business_id' => $otherBusiness->id,
            'first_name' => 'Maria',
            'last_name' => 'Outside',
            'email' => 'maria.outside@example.test',
        ]);

        Sanctum::actingAs($user);

        $response = $this->getJson('/api/business/customers/search?q=Maria');

        $response
            ->assertOk()
            ->assertJsonPath('query', 'Maria')
            ->assertJsonCount(1, 'customers')
            ->assertJsonPath('customers.0.id', (string) $match->id)
            ->assertJsonPath('customers.0.business_id', (string) $business->id);
    }

    public function test_business_owner_can_show_owned_customer(): void
    {
        $business = Business::factory()->create();
        $user = User::factory()->businessOwner($business)->create();

        $customer = Customer::factory()->create([
            'business_id' => $business->id,
            'first_name' => 'Shown',
            'last_name' => 'Customer',
        ]);

        Sanctum::actingAs($user);

        $this
            ->getJson('/api/business/customers/'.$customer->id)
            ->assertOk()
            ->assertJsonPath('customer.id', (string) $customer->id)
            ->assertJsonPath('customer.business_id', (string) $business->id)
            ->assertJsonPath('customer.first_name', 'Shown');
    }

    public function test_business_owner_can_create_customer_manually(): void
    {
        $business = Business::factory()->create();
        $user = User::factory()->businessOwner($business)->create();

        Sanctum::actingAs($user);

        $this
            ->postJson('/api/business/customers', [
                'first_name' => 'Manual',
                'last_name' => 'Entry',
                'email' => 'manual@example.test',
                'phone' => '+1 555 1000',
            ])
            ->assertCreated()
            ->assertJsonPath('message', 'Customer created successfully.')
            ->assertJsonPath('customer.business_id', (string) $business->id)
            ->assertJsonPath('customer.first_name', 'Manual')
            ->assertJsonPath('customer.last_name', 'Entry')
            ->assertJsonPath('customer.email', 'manual@example.test');

        $this->assertDatabaseHas('customers', [
            'business_id' => $business->id,
            'first_name' => 'Manual',
            'last_name' => 'Entry',
            'email' => 'manual@example.test',
        ]);
    }

    public function test_business_owner_can_delete_owned_customer(): void
    {
        $business = Business::factory()->create();
        $user = User::factory()->businessOwner($business)->create();

        $customer = Customer::factory()->create([
            'business_id' => $business->id,
        ]);

        Sanctum::actingAs($user);

        $this
            ->deleteJson('/api/business/customers/'.$customer->id)
            ->assertNoContent();

        $this->assertDatabaseMissing('customers', [
            'id' => $customer->id,
        ]);
    }

    public function test_business_customer_routes_require_authentication(): void
    {
        $customer = Customer::factory()->create();

        $this->getJson('/api/business/customers')->assertUnauthorized();
        $this->getJson('/api/business/customers/search?q=test')->assertUnauthorized();
        $this->getJson('/api/business/customers/'.$customer->id)->assertUnauthorized();
        $this->postJson('/api/business/customers', [
            'first_name' => 'Unauth',
            'last_name' => 'User',
        ])->assertUnauthorized();
        $this->deleteJson('/api/business/customers/'.$customer->id)->assertUnauthorized();
    }

    public function test_business_owner_cannot_access_or_delete_customer_from_another_business(): void
    {
        $business = Business::factory()->create();
        $otherBusiness = Business::factory()->create();

        $user = User::factory()->businessOwner($business)->create();

        $otherCustomer = Customer::factory()->create([
            'business_id' => $otherBusiness->id,
        ]);

        Sanctum::actingAs($user);

        $this
            ->getJson('/api/business/customers/'.$otherCustomer->id)
            ->assertNotFound()
            ->assertJsonPath('message', 'Customer not found.');

        $this
            ->deleteJson('/api/business/customers/'.$otherCustomer->id)
            ->assertNotFound()
            ->assertJsonPath('message', 'Customer not found.');

        $this->assertDatabaseHas('customers', [
            'id' => $otherCustomer->id,
            'business_id' => $otherBusiness->id,
        ]);
    }
}
