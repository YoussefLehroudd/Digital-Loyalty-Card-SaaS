<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterBusinessOwnerRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Models\Business;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(RegisterBusinessOwnerRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $payload = DB::transaction(function () use ($validated, $request) {
            $business = Business::create([
                'name' => $validated['business_name'],
                'email' => $validated['business_email'],
            ]);

            $user = User::create([
                'business_id' => $business->id,
                'name' => $validated['name'],
                'email' => $validated['email'],
                'password' => $validated['password'],
                'role' => UserRole::BusinessOwner,
            ]);

            return $this->authPayload($user, $this->createToken($user, $request));
        });

        return response()->json($payload, 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $start = microtime(true);

        DB::listen(function ($query) use ($start) {
            if (! isset($query->time) || $query->time < 100) return;

            Log::warning('Slow SQL (>100ms)', [
                'route' => 'POST /login',
                'sql' => $query->sql,
                'time_ms' => $query->time,
                'bindings' => $query->bindings,
                'request_duration_ms' => (int) ((microtime(true) - $start) * 1000),
            ]);
        });

        $validated = $request->validated();
        $user = User::query()
            ->with('business')
            ->where('email', $validated['email'])
            ->first();

        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $response = $this->authPayload($user, $this->createToken($user, $request));

        Log::warning('Request timing', [
            'route' => 'POST /login',
            'request_duration_ms' => (int) ((microtime(true) - $start) * 1000),
        ]);

        return response()->json($response);
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
        $start = microtime(true);

        DB::listen(function ($query) use ($start) {
            if (! isset($query->time) || $query->time < 100) return;

            Log::warning('Slow SQL (>100ms)', [
                'route' => 'GET /me',
                'sql' => $query->sql,
                'time_ms' => $query->time,
                'bindings' => $query->bindings,
                'request_duration_ms' => (int) ((microtime(true) - $start) * 1000),
            ]);
        });

        $user = $request->user()->load('business');

        Log::warning('Request timing', [
            'route' => 'GET /me',
            'request_duration_ms' => (int) ((microtime(true) - $start) * 1000),
        ]);

        return response()->json([
            'user' => $this->serializeUser($user),
        ]);
    }

    public function forgotPassword(ForgotPasswordRequest $request): JsonResponse
    {
        Password::sendResetLink($request->validated());

        return response()->json([
            'message' => 'If an account exists, a password reset link has been sent.',
        ]);
    }

    public function resetPassword(ResetPasswordRequest $request): JsonResponse
    {
        $status = Password::reset(
            $request->validated(),
            function (User $user, string $password): void {
                $user->forceFill([
                    'password' => $password,
                    'remember_token' => Str::random(60),
                ])->save();

                $user->tokens()->delete();

                event(new PasswordReset($user));
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages([
                'email' => [__($status)],
            ]);
        }

        return response()->json([
            'message' => 'Password reset successfully.',
        ]);
    }

    public function dashboardSession(Request $request): JsonResponse
    {
        return response()->json([
            'message' => 'Authenticated dashboard session.',
            'user' => $this->serializeUser($request->user()->load('business')),
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
        $user->load('business');

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
            'business_id' => $user->business_id ? (string) $user->business_id : null,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role->value,
            'business' => $user->business ? [
                'id' => (string) $user->business->id,
                'name' => $user->business->name,
                'email' => $user->business->email,
                'logo_url' => $user->business->logo_url,
                'logo_public_id' => $user->business->logo_public_id,
                'primary_color' => $user->business->primary_color,
                'phone' => $user->business->phone,
                'address' => $user->business->address,
            ] : null,
        ];
    }
}
