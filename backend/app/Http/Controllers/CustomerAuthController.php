<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Http\Requests\Auth\CustomerJoinByQrRequest;
use App\Http\Requests\Auth\CustomerLoginRequest;
use App\Http\Requests\Auth\CustomerPasswordRequest;
use App\Http\Requests\Auth\CustomerProfileRequest;
use App\Http\Requests\Auth\CustomerRegisterRequest;
use App\Models\Business;
use App\Models\CustomerProfile;
use App\Models\User;
use App\Services\CustomerMembershipService;
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

    public function joinByQr(
        CustomerJoinByQrRequest $request,
        CustomerMembershipService $customerMembershipService
    ): JsonResponse {
        $user = $request->user();

        if (! $user || $user->role !== UserRole::Customer) {
            return response()->json([
                'message' => 'Forbidden.',
            ], 403);
        }

        $slug = $this->extractBusinessSlugFromQr((string) $request->validated('qr'));

        if (! $slug) {
            throw ValidationException::withMessages([
                'qr' => ['Invalid business QR code.'],
            ]);
        }

        $business = Business::query()
            ->where('slug', $slug)
            ->first();

        if (! $business) {
            return response()->json([
                'message' => 'Business not found.',
            ], 404);
        }

        $profile = $user->customerProfile;
        $fallbackNames = preg_split('/\s+/', trim((string) $user->name)) ?: [];

        $result = $customerMembershipService->registerForBusiness(
            $business,
            [
                'first_name' => $profile?->first_name ?? ($fallbackNames[0] ?? 'Customer'),
                'last_name' => $profile?->last_name ?? trim(implode(' ', array_slice($fallbackNames, 1))),
                'email' => $profile?->email ?? $user->email,
                'phone' => $profile?->phone,
            ],
            $user
        );

        return response()->json([
            'message' => 'Joined business successfully.',
            'business' => [
                'id' => (string) $business->id,
                'slug' => $business->slug,
                'name' => $business->name,
            ],
            'customer' => [
                'id' => (string) $result['customer']->id,
                'qr_code' => $result['customer']->qr_code,
            ],
            'loyalty_card' => $result['loyalty_card'] ? [
                'id' => (string) $result['loyalty_card']->id,
                'business_id' => (string) $result['loyalty_card']->business_id,
            ] : null,
            'loyalty' => $result['loyalty'] ? [
                'id' => (string) $result['loyalty']->id,
                'customer_id' => (string) $result['loyalty']->customer_id,
                'loyalty_card_id' => (string) $result['loyalty']->loyalty_card_id,
                'current_stamps' => $result['loyalty']->current_stamps,
            ] : null,
        ]);
    }

    private function extractBusinessSlugFromQr(string $qr): ?string
    {
        $raw = trim($qr);
        if ($raw === '') {
            return null;
        }

        if (preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/i', $raw) === 1) {
            return strtolower($raw);
        }

        if (filter_var($raw, FILTER_VALIDATE_URL)) {
            $parts = parse_url($raw);

            if (! empty($parts['query'])) {
                parse_str($parts['query'], $query);
                $slug = isset($query['slug']) ? trim((string) $query['slug']) : '';
                if ($slug !== '' && preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/i', $slug) === 1) {
                    return strtolower($slug);
                }
            }

            if (! empty($parts['path'])) {
                $segments = array_values(array_filter(explode('/', (string) $parts['path'])));
                if (count($segments) >= 1) {
                    $candidate = end($segments);
                    if (is_string($candidate) && preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/i', $candidate) === 1) {
                        return strtolower($candidate);
                    }
                }
            }
        }

        return null;
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
