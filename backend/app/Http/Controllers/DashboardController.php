<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\RewardRedemption;
use App\Models\Visit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class DashboardController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $start = microtime(true);

        DB::listen(function ($query) use ($start) {
            if (! isset($query->time) || $query->time < 100) return;

            Log::warning('Slow SQL (>100ms)', [
                'route' => 'GET /dashboard',
                'sql' => $query->sql,
                'time_ms' => $query->time,
                'bindings' => $query->bindings,
                'request_duration_ms' => (int) ((microtime(true) - $start) * 1000),
            ]);
        });

        $user = $request->user()->load('business');
        $business = $user->business;

        if (! $business) {
            abort(Response::HTTP_FORBIDDEN, 'A business workspace is required.');
        }

        $businessId = $business->id;
        $activeSince = now()->subDays(30);
        $monthStart = now()->startOfMonth();

        $response = response()->json([
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
                // Avoid whereHas() + correlated subquery; count distinct customers with qualifying visits.
                'active_customers' => Visit::query()
                    ->where('business_id', $businessId)
                    ->where('date', '>=', $activeSince)
                    ->distinct('customer_id')
                    ->count('customer_id'),
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

        Log::warning('Request timing', [
            'route' => 'GET /dashboard',
            'request_duration_ms' => (int) ((microtime(true) - $start) * 1000),
        ]);

        return $response;
    }
}
