<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\BusinessCustomerController;
use App\Http\Controllers\BusinessProfileController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\LoyaltyCardController;
use App\Http\Controllers\PublicCustomerController;
use App\Http\Controllers\StampController;
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

Route::middleware(['auth:sanctum', 'role:business_owner'])->get('/dashboard/session', [
    AuthController::class,
    'dashboardSession',
]);

Route::middleware(['auth:sanctum', 'role:business_owner'])->get('/dashboard', [
    DashboardController::class,
    'show',
]);

Route::middleware(['auth:sanctum', 'role:business_owner'])
    ->prefix('business/profile')
    ->group(function (): void {
        Route::get('/', [BusinessProfileController::class, 'show']);
        Route::patch('/', [BusinessProfileController::class, 'update']);
        Route::post('/logo', [BusinessProfileController::class, 'uploadLogo']);
        Route::post('/hero-image', [BusinessProfileController::class, 'uploadHeroImage']);
    });

Route::middleware(['auth:sanctum', 'role:business_owner'])
    ->prefix('loyalty-card')
    ->group(function (): void {
        Route::get('/', [LoyaltyCardController::class, 'show']);
        Route::post('/', [LoyaltyCardController::class, 'store']);
        Route::put('/', [LoyaltyCardController::class, 'update']);
    });

Route::middleware(['auth:sanctum', 'role:business_owner'])->post('/stamp', [
    StampController::class,
    'store',
]);

Route::middleware(['auth:sanctum', 'role:business_owner'])->post('/redeem-reward', [
    StampController::class,
    'redeemReward',
]);

Route::middleware(['auth:sanctum', 'role:business_owner'])
    ->prefix('business/customers')
    ->group(function (): void {
        Route::get('/', [BusinessCustomerController::class, 'index']);
        Route::get('/search', [BusinessCustomerController::class, 'search']);
        Route::get('/{customer}', [BusinessCustomerController::class, 'show']);
        Route::post('/', [BusinessCustomerController::class, 'store']);
        Route::delete('/{customer}', [BusinessCustomerController::class, 'destroy']);
    });

Route::get('/public/businesses/{slug}', [PublicCustomerController::class, 'showBusiness']);
Route::post('/public/businesses/{slug}/customers/register', [PublicCustomerController::class, 'register']);
Route::get('/public/customers/wallet/{qrCode}', [PublicCustomerController::class, 'wallet']);

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');
