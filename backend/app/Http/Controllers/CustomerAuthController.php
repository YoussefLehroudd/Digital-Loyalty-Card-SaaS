<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Http\Requests\Auth\CustomerLoginRequest;
use App\Http\Requests\Auth\CustomerPasswordRequest;
use App\Http\Requests\Auth\CustomerProfileRequest;
use App\Http\Requests\Auth\CustomerRegisterRequest;
use App\Models\CustomerProfile;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\NewAccessToken;

class CustomerAuthController extends Controller
{
    public function register(CustomerRegisterRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $payload = DB::transaction(function () use ($validated, $request) {
            $user = User::create([
                'name' => trim(($validated['first_name'] ?? '') . ' ' . ($validated['last_name'] ?? '')),
                'email' => $validated['email'],
                'password' => Hash::make($validated['password']),
                'role' => UserRole::Customer,
            ]);

            CustomerProfile::create([
                'user_id' => $user->id,
                'first_name' => $validated['first_name'],
                'last_name' => $validated['last_name'],
                'email' => $validated['email'],
                'phone' => $validated['phone'] ?? null,
                'avatar_url' => $validated['avatar_url'] ?? null,
                'preferences' => $validated['preferences'] ?? null,
            ]);

            return $this->authPayload($user, $this->createToken($user, $request));
        });

        return response()->json($payload, 201);
    }

    public function login(CustomerLoginRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $user = User::query()
            ->where('email', $validated['email'])
            ->with('customerProfile')
            ->first();

        // If the account exists but is not a customer, forbid (no 422/redirect).
        if ($user && $user->role !== UserRole::Customer) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        // If no such customer account or password mismatch => standard credential error.
        if (! $user || ! Hash::check($validated['password'], $user->password) || $user->role !== UserRole::Customer) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        return response()->json(
            $this->authPayload($user, $this->createToken($user, $request))
        );
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json([
            'message' => 'Logged out successfully.',
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load('customerProfile');

        return response()->json([
            'user' => $this->serializeUser($user),
        ]);
    }

    public function updateProfile(CustomerProfileRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $user = $request->user()->load('customerProfile');

        $profile = $user->customerProfile;
        if (! $profile) {
            $profile = CustomerProfile::create([
                'user_id' => $user->id,
                'first_name' => $validated['first_name'],
                'last_name' => $validated['last_name'],
                'email' => $validated['email'] ?? $user->email,
                'phone' => $validated['phone'] ?? null,
                'avatar_url' => $validated['avatar_url'] ?? null,
                'preferences' => $validated['preferences'] ?? null,
            ]);
        } else {
            $profile->update([
                'first_name' => $validated['first_name'],
                'last_name' => $validated['last_name'],
                'email' => $validated['email'] ?? $profile->email ?? $user->email,
                'phone' => $validated['phone'] ?? $profile->phone,
                'avatar_url' => $validated['avatar_url'] ?? $profile->avatar_url,
                'preferences' => $validated['preferences'] ?? $profile->preferences,
            ]);
        }

        // keep auth user record in sync (optional but useful)
        $user->update([
            'name' => trim($validated['first_name'] . ' ' . $validated['last_name']),
            'email' => $profile->email ?? $user->email,
        ]);

        return response()->json([
            'message' => 'Profile updated successfully.',
            'user' => $this->serializeUser($user->fresh()->load('customerProfile')),
        ]);
    }

    public function changePassword(CustomerPasswordRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $user = $request->user();

        if (! Hash::check($validated['old_password'], $user->password)) {
            throw ValidationException::withMessages([
                'old_password' => ['The provided password is incorrect.'],
            ]);
        }

        $user->update([
            'password' => Hash::make($validated['new_password']),
        ]);

        // Revoke current tokens for security
        $user->tokens()->delete();

        return response()->json([
            'message' => 'Password updated successfully.',
        ]);
    }

    private function createToken(User $user, Request $request): string
    {
        $deviceName = (string) ($request->input('device_name') ?: 'web');

        return $user->createToken($deviceName)->plainTextToken;
    }

    /**
     * @return array<string, mixed>
     */
    private function authPayload(User $user, string $token): array
    {
        $user->load('customerProfile');

        return [
            'token' => $token,
            'token_type' => 'Bearer',
            'user' => $this->serializeUser($user),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeUser(User $user): array
    {
        return [
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role->value,
            'customer_profile' => $user->customerProfile ? [
                'first_name' => $user->customerProfile->first_name,
                'last_name' => $user->customerProfile->last_name,
                'email' => $user->customerProfile->email,
                'phone' => $user->customerProfile->phone,
                'avatar_url' => $user->customerProfile->avatar_url,
                'preferences' => $user->customerProfile->preferences,
            ] : null,
        ];
    }
}
