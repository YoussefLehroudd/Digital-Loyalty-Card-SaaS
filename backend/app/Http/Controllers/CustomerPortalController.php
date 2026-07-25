<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\CustomerLoyalty;
use App\Models\LoyaltyCard;
use App\Models\RewardRedemption;
use App\Models\Visit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class CustomerPortalController extends Controller
{
    public function generatePortalToken(Request $request, string $customer): JsonResponse
    {
        $business = $request->user()->load('business')->business;

        if (! $business) {
            abort(Response::HTTP_FORBIDDEN, 'A business workspace is required.');
        }

        $customerRecord = Customer::query()
            ->where('business_id', $business->id)
            ->whereKey($customer)
            ->first();

        if (! $customerRecord) {
            return response()->json(['message' => 'Customer not found.'], Response::HTTP_NOT_FOUND);
        }

        $rawToken = bin2hex(random_bytes(32)); // 64 hex chars

        $tokenHash = hash('sha256', $rawToken);

        // One active token per (customer, business) for Phase 1.
        $existing = \App\Models\CustomerPortalToken::query()
            ->where('customer_id', $customerRecord->id)
            ->where('business_id', $business->id)
            ->first();

        if ($existing) {
            $existing->update([
                'token_hash' => $tokenHash,
                'enabled' => true,
                'revoked_at' => null,
            ]);
        } else {
            \App\Models\CustomerPortalToken::query()->create([
                'customer_id' => $customerRecord->id,
                'business_id' => $business->id,
                'token_hash' => $tokenHash,
                'enabled' => true,
                'revoked_at' => null,
            ]);
        }

        return response()->json([
            'data' => [
                'token' => $rawToken, // return raw token once
            ],
            'meta' => [],
            'summary' => [],
        ], Response::HTTP_OK);
    }

    public function profile(Request $request): JsonResponse
    {
        $customerId = (int) $request->attributes->get('portal_customer_id');
        $businessId = (int) $request->attributes->get('portal_business_id');

        $customer = Customer::query()
            ->whereKey($customerId)
            ->first();

        if (! $customer) {
            return response()->json(['message' => 'Customer not found.'], Response::HTTP_NOT_FOUND);
        }

        $business = $customer->business()
            ->whereKey($businessId)
            ->first();

        if (! $business) {
            return response()->json(['message' => 'Business not found.'], Response::HTTP_NOT_FOUND);
        }

        $loyalty = CustomerLoyalty::query()
            ->where('customer_id', $customerId)
            ->first();

        $loyaltyCard = LoyaltyCard::query()
            ->where('business_id', $businessId)
            ->first();

        // Phase 1 schema: one loyalty card per business; one loyalty row per customer.
        $required = (int) ($loyaltyCard?->required_stamps ?? 0);
        $current = (int) ($loyalty?->current_stamps ?? 0);

        $progress = $required > 0 ? min(100, (int) round(($current / $required) * 100)) : 0;

        $tier = $this->deriveTier($required, $current, $loyaltyCard);

        $totalVisits = Visit::query()
            ->where('customer_id', $customerId)
            ->where('business_id', $businessId)
            ->count();

        $lastVisit = Visit::query()
            ->where('customer_id', $customerId)
            ->where('business_id', $businessId)
            ->orderBy('date', 'desc')
            ->value('date');

        return response()->json([
            'data' => [
                'customer' => [
                    'id' => (string) $customer->id,
                    'first_name' => $customer->first_name,
                    'last_name' => $customer->last_name,
                    'email' => $customer->email,
                    'phone' => $customer->phone,
                    'qr_code' => $customer->qr_code,
                ],
                'business' => [
                    'id' => (string) $business->id,
                    'name' => $business->name,
                    'slug' => $business->slug,
                    'logo_url' => $business->logo_url,
                    'primary_color' => $business->primary_color,
                ],
                'loyalty' => [
                    'current_stamps' => $current,
                    'required_stamps' => $required,
                    'progress_percent' => $progress,
                    'tier' => $tier,
                ],
                'totals' => [
                    'total_visits' => (int) $totalVisits,
                    'last_visit_at' => $lastVisit ? optional($lastVisit)->toISOString() : null,
                ],
            ],
            'meta' => [],
            'summary' => [],
        ]);
    }

    public function cards(Request $request): JsonResponse
    {
        $customerId = (int) $request->attributes->get('portal_customer_id');
        $businessId = (int) $request->attributes->get('portal_business_id');

        $loyaltyCard = LoyaltyCard::query()
            ->where('business_id', $businessId)
            ->first();

        if (! $loyaltyCard) {
            return response()->json([
                'data' => [],
                'meta' => [],
                'summary' => [],
            ], Response::HTTP_OK);
        }

        $loyalty = CustomerLoyalty::query()
            ->where('customer_id', $customerId)
            ->first();

        $required = (int) ($loyaltyCard?->required_stamps ?? 0);
        $current = (int) ($loyalty?->current_stamps ?? 0);

        $progress = $required > 0 ? min(100, (int) round(($current / $required) * 100)) : 0;

        $business = $loyaltyCard->business()->first();

        return response()->json([
            'data' => [
                [
                    'id' => (string) $loyaltyCard->id,
                    'business_id' => (string) $loyaltyCard->business_id,
                    'reward_name' => $loyaltyCard->reward_name,
                    'required_stamps' => $required,
                    'reward_description' => $loyaltyCard->reward_description,
                    'progress_percent' => $progress,
                    'current_stamps' => $current,
                    'business' => [
                        'id' => (string) $business?->id,
                        'name' => $business?->name,
                        'logo_url' => $business?->logo_url,
                        'primary_color' => $business?->primary_color,
                    ],
                    // In Phase 1 we keep the existing QR code behavior for scanning.
                    // QR image data generation happens on frontend.
                    'customer_qr_code' => $request->attributes->get('portal_customer_id') ? Customer::query()->whereKey($customerId)->value('qr_code') : null,
                ],
            ],
            'meta' => [],
            'summary' => [],
        ]);
    }

    public function rewards(Request $request): JsonResponse
    {
        $customerId = (int) $request->attributes->get('portal_customer_id');
        $businessId = (int) $request->attributes->get('portal_business_id');

        $loyaltyCard = LoyaltyCard::query()
            ->where('business_id', $businessId)
            ->first();

        $required = (int) ($loyaltyCard?->required_stamps ?? 0);

        $currentStamps = CustomerLoyalty::query()
            ->where('customer_id', $customerId)
            ->value('current_stamps');

        $currentStamps = (int) ($currentStamps ?? 0);

        $rewardUnlocked = $required > 0 ? $currentStamps >= $required : false;

        $historyRows = RewardRedemption::query()
            ->where('business_id', $businessId)
            ->where('customer_id', $customerId)
            ->orderBy('earned_at', 'desc')
            ->get(['id', 'status', 'earned_at', 'redeemed_at']);

        $history = $historyRows->map(function (RewardRedemption $r): array {
            $computed = 'collecting';
            if ($r->status === 'redeemed' || ! empty($r->redeemed_at)) {
                $computed = 'redeemed';
            } elseif ($r->status === 'earned') {
                $computed = 'ready';
            }

            return [
                'id' => (string) $r->id,
                'status' => $computed,
                'earned_at' => $r->earned_at ? optional($r->earned_at)->toISOString() : null,
                'redeemed_at' => $r->redeemed_at ? optional($r->redeemed_at)->toISOString() : null,
            ];
        })->values();

        // “Available rewards” for Phase 1 = the main loyalty reward when ready.
        $available = $loyaltyCard
            ? [[
                'reward_name' => $loyaltyCard->reward_name,
                'reward_description' => $loyaltyCard->reward_description,
                'points_required' => $required,
                'ready' => $rewardUnlocked,
            ]][0]
            : null;

        return response()->json([
            'data' => [
                'available' => $available ? [$available] : [],
                'history' => $history,
            ],
            'meta' => [],
            'summary' => [],
        ]);
    }

    public function activity(Request $request): JsonResponse
    {
        $customerId = (int) $request->attributes->get('portal_customer_id');
        $businessId = (int) $request->attributes->get('portal_business_id');

        $visits = Visit::query()
            ->where('customer_id', $customerId)
            ->where('business_id', $businessId)
            ->orderBy('date', 'desc')
            ->get(['id', 'date', 'business_id']);

        $visitHistory = $visits->map(function (Visit $v): array {
            return [
                'id' => (string) $v->id,
                'type' => 'visit',
                'date' => $v->date ? optional($v->date)->toISOString() : null,
                'points' => 1,
            ];
        })->values();

        // For points earned/spent, we can model:
        // - earned points: earned reward redemptions (status earned)
        // - spent points: redeemed_at of reward redemptions
        $redemptions = RewardRedemption::query()
            ->where('business_id', $businessId)
            ->where('customer_id', $customerId)
            ->orderBy('earned_at', 'desc')
            ->get(['id', 'status', 'earned_at', 'redeemed_at']);

        $rewardEvents = $redemptions->map(function (RewardRedemption $r): array {
            if ($r->status === 'earned' && empty($r->redeemed_at)) {
                return [
                    'id' => (string) $r->id,
                    'type' => 'reward_claimed',
                    'date' => $r->earned_at ? optional($r->earned_at)->toISOString() : null,
                ];
            }

            if ($r->status === 'redeemed' || ! empty($r->redeemed_at)) {
                return [
                    'id' => (string) $r->id,
                    'type' => 'reward_redeemed',
                    'date' => $r->redeemed_at ? optional($r->redeemed_at)->toISOString() : null,
                ];
            }

            return [
                'id' => (string) $r->id,
                'type' => 'reward_event',
                'date' => $r->earned_at ? optional($r->earned_at)->toISOString() : null,
            ];
        })->values();

        $activity = $visitHistory->concat($rewardEvents)->sortByDesc('date')->values()->take(50);

        return response()->json([
            'data' => [
                'items' => $activity,
            ],
            'meta' => [],
            'summary' => [],
        ]);
    }

    private function deriveTier(int $required, int $current, ?LoyaltyCard $loyaltyCard): string
    {
        if ($required <= 0) {
            return 'Member';
        }

        $ratio = $current / $required;

        if ($ratio < 0.33) return 'Bronze';
        if ($ratio < 0.67) return 'Silver';
        if ($ratio <= 1.0) return 'Gold';

        return $loyaltyCard?->reward_name ? 'Platinum' : 'Gold';
    }
}
