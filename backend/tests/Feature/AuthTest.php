<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_business_owner_can_register_with_business(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'business_name' => 'Star Coffee',
            'business_email' => 'hello@star.test',
            'name' => 'Maya Chen',
            'email' => 'maya@star.test',
            'password' => 'Password1234',
            'password_confirmation' => 'Password1234',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('token_type', 'Bearer')
            ->assertJsonPath('user.role', 'business_owner')
            ->assertJsonPath('user.business.name', 'Star Coffee');

        $this->assertDatabaseHas('businesses', [
            'email' => 'hello@star.test',
        ]);

        $this->assertDatabaseHas('users', [
            'email' => 'maya@star.test',
            'role' => 'business_owner',
        ]);
    }

    public function test_business_owner_can_login_and_logout(): void
    {
        $business = Business::factory()->create();
        $user = User::factory()->businessOwner($business)->create([
            'email' => 'owner@example.test',
            'password' => 'Password1234',
        ]);

        $login = $this->postJson('/api/auth/login', [
            'email' => 'owner@example.test',
            'password' => 'Password1234',
        ]);

        $token = $login
            ->assertOk()
            ->assertJsonPath('user.business.id', (string) $business->id)
            ->json('token');

        $this->assertNotEmpty($token);
        $this->assertCount(1, $user->fresh()->tokens);

        $this
            ->withToken($token)
            ->postJson('/api/auth/logout')
            ->assertOk();

        $this->assertCount(0, $user->fresh()->tokens);
    }

    public function test_invalid_login_is_rejected(): void
    {
        User::factory()->create([
            'email' => 'owner@example.test',
            'password' => 'Password1234',
        ]);

        $this
            ->postJson('/api/auth/login', [
                'email' => 'owner@example.test',
                'password' => 'wrong-password',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }

    public function test_dashboard_session_requires_business_owner_role(): void
    {
        $business = Business::factory()->create();
        $user = User::factory()->businessOwner($business)->create();

        Sanctum::actingAs($user);

        $this
            ->getJson('/api/dashboard/session')
            ->assertOk()
            ->assertJsonPath('user.role', 'business_owner');
    }

    public function test_forgot_password_sends_reset_notification(): void
    {
        Notification::fake();
        $user = User::factory()->create([
            'email' => 'owner@example.test',
        ]);

        $this
            ->postJson('/api/auth/forgot-password', [
                'email' => 'owner@example.test',
            ])
            ->assertOk();

        Notification::assertSentTo($user, ResetPassword::class);
    }

    public function test_password_can_be_reset(): void
    {
        $user = User::factory()->create([
            'email' => 'owner@example.test',
            'password' => 'Password1234',
        ]);

        $token = Password::createToken($user);

        $this
            ->postJson('/api/auth/reset-password', [
                'token' => $token,
                'email' => 'owner@example.test',
                'password' => 'NewPassword1234',
                'password_confirmation' => 'NewPassword1234',
            ])
            ->assertOk();

        $this->assertTrue(Hash::check('NewPassword1234', $user->fresh()->password));
    }
}
