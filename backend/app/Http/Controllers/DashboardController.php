<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\RewardRedemption;
use App\Models\Visit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class DashboardController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $user = $request->user()->load('business');
        $business = $user->business;

        if (! $business) {
            abort(Response::HTTP_FORBIDDEN, 'A business workspace is required.');
        }

        $businessId = $business->id;
        $activeSince = now()->subDays(30);
        $monthStart = now()->startOfMonth();

        return response()->json([
            'business' => [
                'id' => (string) $business->id,
                'name' => $business->name,
                'email' => $business->email,
                'logo_url' => $business->logo_url,
                'logo_public_id' => $business->logo_public_id,
                'primary_color' => $business->primary_color,
            ],
            'metrics' => [
                'total_customers' => Customer::query()
                    ->where('business_id', $businessId)
                    ->count(),
                'active_customers' => Customer::query()
                    ->where('business_id', $businessId)
                    ->whereHas('visits', fn ($query) => $query
                        ->where('business_id', $businessId)
                        ->where('date', '>=', $activeSince))
                    ->count(),
                'visits_this_month' => Visit::query()
                    ->where('business_id', $businessId)
                    ->where('date', '>=', $monthStart)
                    ->count(),
                'rewards_redeemed' => RewardRedemption::query()
                    ->where('business_id', $businessId)
                    ->count(),
            ],
            'generated_at' => now()->toISOString(),
        ]);
    }
}
