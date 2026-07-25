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
use Illuminate\Support\Facades\Log;
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

        $qrValue = (string) $request->validated('qr');

        // Log request shape (keys only) to confirm frontend is sending the expected payload field(s).
        Log::info('[joinByQr] payload keys', [
            'customer_user_id' => $user?->id,
            'payload_keys' => array_keys($request->all() ?? []),
        ]);

        Log::info('[joinByQr] received qr', [
            'customer_user_id' => $user?->id,
            'qr' => $qrValue,
        ]);

        $businessId = $this->extractBusinessIdFromQr($qrValue);
        if ($businessId) {
            $business = Business::query()->find($businessId);

            Log::info('[joinByQr] extracted business id (join_business_id)', [
                'customer_user_id' => $user?->id,
                'business_id' => $businessId,
                'business_found' => (bool) $business,
            ]);
        } else {
            $slug = $this->extractBusinessSlugFromQr($qrValue);
            Log::info('[joinByQr] extracted slug', [
                'customer_user_id' => $user?->id,
                'slug' => $slug,
            ]);

            if (! $slug) {
                throw ValidationException::withMessages([
                    'qr' => ['Invalid business QR code.'],
                ]);
            }

            $business = Business::query()
                ->where('slug', $slug)
                ->first();

            Log::info('[joinByQr] business lookup', [
                'customer_user_id' => $user?->id,
                'slug' => $slug,
                'business_found' => (bool) $business,
                'business_id' => $business?->id,
            ]);
        }

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

    private function extractBusinessIdFromQr(string $qr): ?int
    {
        $raw = trim($qr);
        if ($raw === '') {
            return null;
        }

        // normalize encoded URLs like "...?join_business_id=1"
        $raw = urldecode($raw);
        $rawTrimmed = trim($raw);

        // Accept either full URLs or relative paths like `/user/login?join_business_id=1`.
        $query = null;

        if (filter_var($rawTrimmed, FILTER_VALIDATE_URL)) {
            $parts = parse_url($rawTrimmed);
            $query = $parts['query'] ?? null;
        } else {
            // Attempt to treat input as a path/query string.
            $pos = strpos($rawTrimmed, '?');
            if ($pos === false) {
                return null;
            }

            $query = substr($rawTrimmed, $pos + 1);
        }

        if (! is_string($query) || $query === '') {
            return null;
        }

        parse_str($query, $parsed);
        $rawBusinessId = $parsed['join_business_id'] ?? null;

        if ($rawBusinessId === null || $rawBusinessId === '') {
            return null;
        }

        // Accept numeric strings only.
        if (! is_numeric($rawBusinessId)) {
            return null;
        }

        $id = (int) $rawBusinessId;
        return $id > 0 ? $id : null;
    }

    private function extractBusinessSlugFromQr(string $qr): ?string
    {
        $raw = trim($qr);
        if ($raw === '') {
            return null;
        }

        // QR values can be URL-encoded; decode once to normalize formats like ".../star-coffee%20"
        $raw = urldecode($raw);
        $rawTrimmed = trim($raw);

        $slugRegex = '/^[a-z0-9]+(?:-[a-z0-9]+)*$/i';

        // Raw slug format.
        if (preg_match($slugRegex, $rawTrimmed) === 1) {
            return strtolower($rawTrimmed);
        }

        if (! filter_var($rawTrimmed, FILTER_VALIDATE_URL)) {
            return null;
        }

        $parts = parse_url($rawTrimmed);

        Log::info('[extractBusinessSlugFromQr] parse_url result', [
            'raw' => $rawTrimmed,
            'path' => $parts['path'] ?? null,
            'query' => $parts['query'] ?? null,
        ]);

        // Query param formats:
        // - ?slug=my-business
        // - ?business_slug=my-business
        if (! empty($parts['query'])) {
            parse_str((string) $parts['query'], $query);

            $candidateKeys = ['slug', 'business_slug'];
            foreach ($candidateKeys as $key) {
                $candidate = isset($query[$key]) ? trim((string) $query[$key]) : '';
                if ($candidate !== '' && preg_match($slugRegex, $candidate) === 1) {
                    return strtolower($candidate);
                }
            }
        }

        // Path formats where slug can appear anywhere in the path (not only the last segment).
        $path = $parts['path'] ?? null;

        // Some environments/inputs can yield an empty/null path from parse_url(). Fall back to regex extraction.
        $fallbackPath = null;
        if (! is_string($path) || $path === '') {
            if (preg_match('~https?://[^/]+(/.*)$~i', $rawTrimmed, $m) === 1) {
                $path = $m[1] ?? '';
                $fallbackPath = $path;
            } else {
                $path = '';
                $fallbackPath = '';
            }
        }

        Log::info('[extractBusinessSlugFromQr] path extraction', [
            'raw' => $rawTrimmed,
            'path' => $path,
            'fallback_path' => $fallbackPath,
        ]);

        if ($path !== '') {
            $segments = array_values(array_filter(explode('/', (string) $path)));

            Log::info('[extractBusinessSlugFromQr] path segments', [
                'raw' => $rawTrimmed,
                'segments' => $segments,
            ]);

            // Most reliable form used by app pages:
            //   .../businesses/{slug}/...
            // Prefer this over picking "any slug-like segment" (which breaks on "/businesses/{slug}/join").
            for ($i = 0; $i < count($segments) - 1; $i++) {
                $seg = $segments[$i];
                if (! is_string($seg)) {
                    continue;
                }

                if (strtolower(trim(urldecode($seg))) !== 'businesses') {
                    continue;
                }

                $candidate = $segments[$i + 1] ?? '';
                if (! is_string($candidate)) {
                    continue;
                }

                $decodedCandidate = trim(urldecode($candidate));
                $matches = $decodedCandidate !== '' && preg_match($slugRegex, $decodedCandidate) === 1;

                Log::info('[extractBusinessSlugFromQr] businesses/{slug} pattern', [
                    'raw' => $rawTrimmed,
                    'businesses_index' => $i,
                    'candidate' => $candidate,
                    'decoded_candidate' => $decodedCandidate,
                    'matches_slug_regex' => $matches,
                ]);

                if ($matches) {
                    Log::info('[extractBusinessSlugFromQr] final slug source', [
                        'source' => 'path_businesses_pattern',
                        'raw' => $rawTrimmed,
                        'slug' => strtolower($decodedCandidate),
                    ]);

                    return strtolower($decodedCandidate);
                }
            }

            // Generic fallback: choose the last slug-like segment in the path.
            $lastSlug = null;

            foreach ($segments as $segment) {
                if (! is_string($segment)) {
                    continue;
                }

                $decodedSegment = trim(urldecode($segment));
                Log::info('[extractBusinessSlugFromQr] segment candidate', [
                    'raw' => $rawTrimmed,
                    'segment' => $segment,
                    'decoded_segment' => $decodedSegment,
                    'matches_slug_regex' => $decodedSegment !== '' && preg_match($slugRegex, $decodedSegment) === 1,
                ]);

                if ($decodedSegment !== '' && preg_match($slugRegex, $decodedSegment) === 1) {
                    $lastSlug = strtolower($decodedSegment);
                }
            }

            if ($lastSlug !== null) {
                Log::info('[extractBusinessSlugFromQr] final slug source', [
                    'source' => 'path_last_slug_segment',
                    'raw' => $rawTrimmed,
                    'slug' => $lastSlug,
                ]);

                return $lastSlug;
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
