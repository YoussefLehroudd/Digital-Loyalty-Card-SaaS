<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\BusinessCustomerController;
use App\Http\Controllers\BusinessRewardsController;
use App\Http\Controllers\BusinessProfileController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\LoyaltyCardController;
use App\Http\Controllers\PublicCustomerController;
use App\Http\Controllers\StampController;
use App\Http\Controllers\CustomerAuthController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => [
    'status' => 'ok',
    'service' => config('app.name'),
]);

Route::prefix('auth')->group(function (): void {
    Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:6,1');
    Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:3,1');
    Route::post('/reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:6,1');

    Route::middleware('auth:sanctum')->group(function (): void {
        Route::get('/me', [AuthController::class, 'me']);
        Route::post('/logout', [AuthController::class, 'logout']);
    });
});

/**
 * Customer auth (isolated from business/admin auth)
 */

Route::prefix('user')->group(function (): void {
    Route::post('/register', [CustomerAuthController::class, 'register'])->middleware('throttle:10,1');
    Route::post('/login', [CustomerAuthController::class, 'login'])->middleware('throttle:6,1');

    Route::middleware(['auth:sanctum', 'customer'])->group(function (): void {
        Route::post('/logout', [CustomerAuthController::class, 'logout']);
        Route::get('/me', [CustomerAuthController::class, 'me']);
        Route::put('/profile', [CustomerAuthController::class, 'updateProfile']);
        Route::put('/password', [CustomerAuthController::class, 'changePassword']);
        Route::get('/cards', [\App\Http\Controllers\CustomerDashboardController::class, 'cards']);
        Route::get('/cards/{id}', [\App\Http\Controllers\CustomerDashboardController::class, 'card']);
        Route::delete('/cards/{membershipId}', [\App\Http\Controllers\CustomerDashboardController::class, 'deleteCard']);
        Route::get('/rewards', [\App\Http\Controllers\CustomerDashboardController::class, 'rewards']);
        Route::get('/activity', [\App\Http\Controllers\CustomerDashboardController::class, 'activity']);
        Route::get('/notifications', [\App\Http\Controllers\CustomerDashboardController::class, 'notifications']);
        Route::get('/businesses', [\App\Http\Controllers\CustomerDashboardController::class, 'businesses']);
        Route::post('/join-by-qr', [CustomerAuthController::class, 'joinByQr']);
    });
});

Route::middleware(['json.api', 'auth:sanctum', 'role:business_owner'])->get('/dashboard/session', [
    AuthController::class,
    'dashboardSession',
]);

Route::middleware(['json.api', 'auth:sanctum', 'role:business_owner'])->get('/dashboard', [
    DashboardController::class,
    'show',
]);

Route::middleware(['json.api', 'auth:sanctum', 'role:business_owner'])
    ->prefix('business/profile')
    ->group(function (): void {
        Route::get('/', [BusinessProfileController::class, 'show']);
        Route::patch('/', [BusinessProfileController::class, 'update']);
        Route::post('/logo', [BusinessProfileController::class, 'uploadLogo']);
        Route::post('/hero-image', [BusinessProfileController::class, 'uploadHeroImage']);
    });

Route::middleware(['json.api', 'auth:sanctum', 'role:business_owner'])
    ->prefix('loyalty-card')
    ->group(function (): void {
        Route::get('/', [LoyaltyCardController::class, 'show']);
        Route::post('/', [LoyaltyCardController::class, 'store']);
        Route::put('/', [LoyaltyCardController::class, 'update']);
    });

Route::middleware(['json.api', 'auth:sanctum', 'role:business_owner'])->post('/stamp', [
    StampController::class,
    'store',
]);

Route::middleware(['json.api', 'auth:sanctum', 'role:business_owner'])->post('/redeem-reward', [
    StampController::class,
    'redeemReward',
]);

Route::middleware(['json.api', 'auth:sanctum', 'role:business_owner'])
    ->prefix('business/customers')
    ->group(function (): void {
        Route::get('/', [BusinessCustomerController::class, 'index']);
        Route::get('/search', [BusinessCustomerController::class, 'search']);
        Route::get('/{customer}', [BusinessCustomerController::class, 'show']);
        Route::post('/', [BusinessCustomerController::class, 'store']);
        Route::delete('/{customer}', [BusinessCustomerController::class, 'destroy']);

        // Phase 1: regenerate a customer portal token for this business.
        Route::post('/{customer}/portal-token', [\App\Http\Controllers\CustomerPortalController::class, 'generatePortalToken']);
    });

Route::middleware(['json.api', 'auth:sanctum', 'role:business_owner'])
    ->prefix('business/rewards')
    ->group(function (): void {
        Route::get('/', [BusinessRewardsController::class, 'index']);
    });

Route::get('/public/businesses/{slug}', [PublicCustomerController::class, 'showBusiness']);
Route::post('/public/businesses/{slug}/customers/register', [PublicCustomerController::class, 'register']);
Route::get('/public/customers/wallet/{qrCode}', [PublicCustomerController::class, 'wallet']);

Route::middleware(['customer_portal_token'])
    ->prefix('customer/portal')
    ->group(function (): void {
        Route::get('/profile', [\App\Http\Controllers\CustomerPortalController::class, 'profile']);
        Route::get('/cards', [\App\Http\Controllers\CustomerPortalController::class, 'cards']);
        Route::get('/rewards', [\App\Http\Controllers\CustomerPortalController::class, 'rewards']);
        Route::get('/activity', [\App\Http\Controllers\CustomerPortalController::class, 'activity']);
    });

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');
