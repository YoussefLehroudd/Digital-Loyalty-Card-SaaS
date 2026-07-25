<?php

namespace Tests\Feature;

use App\Enums\UserRole;
use App\Models\Business;
use App\Models\Customer;
use App\Models\CustomerLoyalty;
use App\Models\CustomerProfile;
use App\Models\LoyaltyCard;
use App\Models\RewardRedemption;
use App\Models\User;
use App\Models\Visit;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CustomerUserApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_can_register_and_profile_is_created(): void
    {
        $response = $this->postJson('/api/user/register', [
            'first_name' => 'Yassine',
            'last_name' => 'Client',
            'email' => 'yassine@example.com',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'phone' => '+212600000000',
        ]);

        $response->assertCreated()
            ->assertJsonStructure([
                'token',
                'token_type',
                'user' => [
                    'id',
                    'name',
                    'email',
                    'role',
                    'customer_profile' => [
                        'first_name',
                        'last_name',
                        'email',
                        'phone',
                    ],
                ],
            ]);

        $this->assertDatabaseHas('users', [
            'email' => 'yassine@example.com',
            'role' => UserRole::Customer->value,
        ]);

        $this->assertDatabaseHas('customer_profiles', [
            'email' => 'yassine@example.com',
            'first_name' => 'Yassine',
            'last_name' => 'Client',
        ]);
    }

    public function test_customer_register_requires_valid_payload(): void
    {
        $response = $this->postJson('/api/user/register', [
            'first_name' => '',
            'last_name' => '',
            'email' => 'not-an-email',
            'password' => '123',
            'password_confirmation' => '456',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors([
                'first_name',
                'last_name',
                'email',
                'password',
            ]);
    }

    public function test_customer_can_login_with_valid_credentials(): void
    {
        $user = User::factory()->create([
            'role' => UserRole::Customer,
            'email' => 'login.customer@example.com',
            'password' => bcrypt('Password123!'),
        ]);

        CustomerProfile::query()->create([
            'user_id' => $user->id,
            'first_name' => 'Login',
            'last_name' => 'Customer',
            'email' => $user->email,
        ]);

        $response = $this->postJson('/api/user/login', [
            'email' => 'login.customer@example.com',
            'password' => 'Password123!',
        ]);

        $response->assertOk()
            ->assertJsonPath('user.email', 'login.customer@example.com')
            ->assertJsonPath('user.role', UserRole::Customer->value)
            ->assertJsonStructure(['token', 'token_type', 'user']);
    }

    public function test_customer_login_rejects_non_customer_accounts_with_403(): void
    {
        User::factory()->create([
            'role' => UserRole::BusinessOwner,
            'email' => 'owner@example.com',
            'password' => bcrypt('Password123!'),
        ]);

        $response = $this->postJson('/api/user/login', [
            'email' => 'owner@example.com',
            'password' => 'Password123!',
        ]);

        $response->assertStatus(403);
    }

    public function test_customer_login_rejects_invalid_credentials(): void
    {
        $response = $this->postJson('/api/user/login', [
            'email' => 'unknown@example.com',
            'password' => 'Password123!',
        ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors(['email']);
    }

    public function test_customer_authenticated_endpoints_require_authentication(): void
    {
        $this->getJson('/api/user/me')->assertUnauthorized();
        $this->putJson('/api/user/profile', [])->assertUnauthorized();
        $this->putJson('/api/user/password', [])->assertUnauthorized();
        $this->postJson('/api/user/logout')->assertUnauthorized();

        $this->getJson('/api/user/cards')->assertUnauthorized();
        $this->getJson('/api/user/rewards')->assertUnauthorized();
        $this->getJson('/api/user/activity')->assertUnauthorized();
        $this->getJson('/api/user/notifications')->assertUnauthorized();
        $this->getJson('/api/user/businesses')->assertUnauthorized();
    }

    public function test_customer_authenticated_endpoints_reject_non_customer_role(): void
    {
        $owner = User::factory()->create([
            'role' => UserRole::BusinessOwner,
        ]);

        Sanctum::actingAs($owner);

        $this->getJson('/api/user/me')->assertStatus(403);
        $this->getJson('/api/user/cards')->assertStatus(403);
        $this->getJson('/api/user/rewards')->assertStatus(403);
        $this->getJson('/api/user/activity')->assertStatus(403);
        $this->getJson('/api/user/notifications')->assertStatus(403);
        $this->getJson('/api/user/businesses')->assertStatus(403);
    }

    public function test_customer_can_get_me_update_profile_change_password_and_logout(): void
    {
        $user = User::factory()->create([
            'role' => UserRole::Customer,
            'email' => 'profile.customer@example.com',
            'password' => bcrypt('OldPassword123!'),
        ]);

        CustomerProfile::query()->create([
            'user_id' => $user->id,
            'first_name' => 'Old',
            'last_name' => 'Name',
            'email' => $user->email,
            'phone' => '+212611111111',
        ]);

        Sanctum::actingAs($user);

        $this->getJson('/api/user/me')
            ->assertOk()
            ->assertJsonPath('user.email', 'profile.customer@example.com');

        $this->putJson('/api/user/profile', [
            'first_name' => 'New',
            'last_name' => 'Name',
            'email' => 'profile.customer@example.com',
            'phone' => '+212622222222',
            'preferences' => ['lang' => 'fr'],
        ])->assertOk()
            ->assertJsonPath('user.customer_profile.first_name', 'New')
            ->assertJsonPath('user.customer_profile.phone', '+212622222222');

        $this->assertDatabaseHas('customer_profiles', [
            'user_id' => $user->id,
            'first_name' => 'New',
            'phone' => '+212622222222',
        ]);

        $this->putJson('/api/user/password', [
            'old_password' => 'OldPassword123!',
            'new_password' => 'NewPassword123!',
            'new_password_confirmation' => 'NewPassword123!',
        ])->assertOk();

        $this->postJson('/api/user/logout')->assertOk();
    }

    public function test_customer_dashboard_endpoints_return_expected_shapes(): void
    {
        $user = User::factory()->create([
            'role' => UserRole::Customer,
            'email' => 'dash.customer@example.com',
        ]);

        $businessA = Business::factory()->create(['name' => 'Cafe Atlas']);
        $businessB = Business::factory()->create(['name' => 'Resto Medina']);

        $membershipA = Customer::factory()->create([
            'user_id' => $user->id,
            'business_id' => $businessA->id,
            'first_name' => 'Dash',
            'last_name' => 'Customer',
        ]);

        $membershipB = Customer::factory()->create([
            'user_id' => $user->id,
            'business_id' => $businessB->id,
            'first_name' => 'Dash',
            'last_name' => 'Customer',
        ]);

        $cardA = LoyaltyCard::query()->create([
            'business_id' => $businessA->id,
            'reward_name' => 'Free Coffee',
            'required_stamps' => 10,
            'reward_description' => 'One free coffee',
        ]);

        $cardB = LoyaltyCard::query()->create([
            'business_id' => $businessB->id,
            'reward_name' => 'Free Dessert',
            'required_stamps' => 8,
            'reward_description' => 'One free dessert',
        ]);

        CustomerLoyalty::query()->create([
            'customer_id' => $membershipA->id,
            'loyalty_card_id' => $cardA->id,
            'current_stamps' => 9,
        ]);

        CustomerLoyalty::query()->create([
            'customer_id' => $membershipB->id,
            'loyalty_card_id' => $cardB->id,
            'current_stamps' => 8,
        ]);

        Visit::factory()->create([
            'business_id' => $businessA->id,
            'customer_id' => $membershipA->id,
        ]);

        RewardRedemption::factory()->create([
            'business_id' => $businessB->id,
            'customer_id' => $membershipB->id,
            'status' => 'earned',
        ]);

        Sanctum::actingAs($user);

        $cardsRes = $this->getJson('/api/user/cards');
        $cardsRes->assertOk()->assertJsonStructure([
            'data',
            'meta',
            'summary',
        ]);
        $this->assertCount(2, $cardsRes->json('data'));

        $cardId = (string) $membershipA->id;
        $this->getJson('/api/user/cards/' . $cardId)
            ->assertOk()
            ->assertJsonPath('data.customer_id', $cardId);

        $this->getJson('/api/user/rewards')
            ->assertOk()
            ->assertJsonStructure([
                'data' => ['available', 'history'],
                'meta',
                'summary',
            ]);

        $this->getJson('/api/user/activity')
            ->assertOk()
            ->assertJsonStructure([
                'data' => ['items'],
                'meta',
                'summary',
            ]);

        $this->getJson('/api/user/notifications')
            ->assertOk()
            ->assertJsonStructure(['data', 'meta', 'summary']);

        $this->getJson('/api/user/businesses')
            ->assertOk()
            ->assertJsonStructure([
                'data',
                'meta',
                'summary',
            ]);
    }
}
