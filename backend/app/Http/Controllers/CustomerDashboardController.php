<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\CustomerLoyalty;
use App\Models\LoyaltyCard;
use App\Models\RewardRedemption;
use App\Models\Visit;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class CustomerDashboardController extends Controller
{
    public function deleteCard(string $membershipId): JsonResponse
    {
        $userId = (int) auth()->user()->id;
        $membershipCustomerId = (int) $membershipId;

        // MembershipId is expected to be the `customers.id` row (frontend uses CustomerCardItem.id).
        $customer = Customer::query()
            ->where('user_id', $userId)
            ->whereKey($membershipCustomerId)
            ->first();

        if (! $customer) {
            return response()->json(['message' => 'Card not found.'], Response::HTTP_NOT_FOUND);
        }

        // Delete loyalty progress first (customer loyalty rows point to this customer).
        CustomerLoyalty::query()
            ->where('customer_id', $customer->id)
            ->delete();

        // Delete membership row for this business.
        $customer->delete();

        return response()->json([
            'message' => 'Card removed successfully.',
            'data' => [
                'membershipId' => (string) $membershipCustomerId,
            ],
            'meta' => [],
            'summary' => [],
        ], Response::HTTP_OK);
    }

    public function cards(): JsonResponse
    {
        $userId = (int) auth()->user()->id;

        $memberships = Customer::query()
            ->where('user_id', $userId)
            ->with('business')
            ->get();

        $cards = $memberships->map(function (Customer $customer): array {
            $loyalty = CustomerLoyalty::query()
                ->where('customer_id', $customer->id)
                ->first();

            $loyaltyCard = $loyalty?->loyaltyCard ?: LoyaltyCard::query()
                ->where('business_id', $customer->business_id)
                ->first();

            $required = (int) ($loyaltyCard?->required_stamps ?? 0);
            $current = (int) ($loyalty?->current_stamps ?? 0);

            return [
                'id' => (string) $customer->id,
                'customer_id' => (string) $customer->id,
                'business' => [
                    'id' => (string) $customer->business?->id,
                    'name' => $customer->business?->name,
                    'slug' => $customer->business?->slug,
                    'logo_url' => $customer->business?->logo_url,
                    'primary_color' => $customer->business?->primary_color,
                ],
                'membership' => [
                    'qr_code' => $customer->qr_code,
                    'first_name' => $customer->first_name,
                    'last_name' => $customer->last_name,
                ],
                'loyalty_card' => $loyaltyCard ? [
                    'id' => (string) $loyaltyCard->id,
                    'business_id' => (string) $loyaltyCard->business_id,
                    'reward_name' => $loyaltyCard->reward_name,
                    'required_stamps' => $required,
                    'reward_description' => $loyaltyCard->reward_description,
                ] : null,
                'loyalty' => $loyalty ? [
                    'id' => (string) $loyalty->id,
                    'current_stamps' => $current,
                    'required_stamps' => $required,
                    'progress_percent' => $required > 0 ? min(100, (int) round(($current / $required) * 100)) : 0,
                ] : null,
                'qr' => [
                    'qr_code' => $customer->qr_code,
                ],
            ];
        })->values();

        return response()->json([
            'data' => $cards,
            'meta' => [],
            'summary' => [],
        ], Response::HTTP_OK);
    }

    public function card(string $id): JsonResponse
    {
        $userId = (int) auth()->user()->id;

        // Current implementation of `cards()` uses:
        // - `data.id` = customer_id (membership/customer record id)
        // But frontend appears to call `/api/user/cards/{id}` with `loyalty_card.id`.
        // To be backward-compatible, accept both:
        // 1) {id} as customer id
        // 2) {id} as loyalty_card id (via customer_loyalties.loyalty_card_id)
        $customer = Customer::query()
            ->where('user_id', $userId)
            ->whereKey($id)
            ->with('business')
            ->first();

        if (! $customer) {
            $loyaltyCard = LoyaltyCard::query()
                ->whereKey($id)
                ->first();

            if (! $loyaltyCard) {
                return response()->json(['message' => 'Card not found.'], Response::HTTP_NOT_FOUND);
            }

            $customerId = CustomerLoyalty::query()
                ->where('loyalty_card_id', $loyaltyCard->id)
                ->whereHas('customer', function ($q) use ($userId) {
                    $q->where('user_id', $userId);
                })
                ->value('customer_id');

            if (! $customerId) {
                return response()->json(['message' => 'Card not found.'], Response::HTTP_NOT_FOUND);
            }

            $customer = Customer::query()
                ->where('user_id', $userId)
                ->whereKey($customerId)
                ->with('business')
                ->first();
        }

        if (! $customer) {
            return response()->json(['message' => 'Card not found.'], Response::HTTP_NOT_FOUND);
        }

        // Reuse cards serializer by calling cards() and filtering by id.
        $cards = $this->cards()->getData(true)['data'] ?? [];

        foreach ($cards as $card) {
            // cards() returns `id` as customer_id
            if (($card['id'] ?? null) === (string) $customer->id) {
                return response()->json([
                    'data' => $card,
                    'meta' => [],
                    'summary' => [],
                ], Response::HTTP_OK);
            }
        }

        // Should never happen, but keep a safe fallback.
        return response()->json(['message' => 'Card not found.'], Response::HTTP_NOT_FOUND);
    }

    public function rewards(): JsonResponse
    {
        $userId = (int) auth()->user()->id;

        $memberships = Customer::query()
            ->where('user_id', $userId)
            ->get(['id', 'business_id']);

        $customerIds = $memberships->pluck('id')->all();

        if (empty($customerIds)) {
            return response()->json([
                'data' => [
                    'available' => [],
                    'history' => [],
                ],
                'meta' => [],
                'summary' => [],
            ], Response::HTTP_OK);
        }

        $loyalties = CustomerLoyalty::query()
            ->whereIn('customer_id', $customerIds)
            ->with('loyaltyCard')
            ->get();

        $available = $loyalties->map(function (CustomerLoyalty $loyalty): ?array {
            $loyaltyCard = $loyalty->loyaltyCard;
            if (! $loyaltyCard) return null;

            $required = (int) $loyaltyCard->required_stamps;
            $current = (int) $loyalty->current_stamps;

            if ($required > 0 && $current >= $required) {
                return [
                    'loyalty_card_id' => (string) $loyaltyCard->id,
                    'business_id' => (string) $loyaltyCard->business_id,
                    'reward_name' => $loyaltyCard->reward_name,
                    'reward_description' => $loyaltyCard->reward_description,
                    'points_required' => $required,
                    'ready' => true,
                ];
            }

            return null;
        })->filter()->values()->all();

        $historyRows = RewardRedemption::query()
            ->whereIn('customer_id', $customerIds)
            ->orderBy('earned_at', 'desc')
            ->get(['id', 'status', 'earned_at', 'redeemed_at', 'business_id', 'customer_id']);

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
                'business_id' => (string) $r->business_id,
                'customer_id' => (string) $r->customer_id,
                'earned_at' => $r->earned_at ? optional($r->earned_at)->toISOString() : null,
                'redeemed_at' => $r->redeemed_at ? optional($r->redeemed_at)->toISOString() : null,
            ];
        })->values()->all();

        return response()->json([
            'data' => [
                'available' => $available,
                'history' => $history,
            ],
            'meta' => [],
            'summary' => [],
        ], Response::HTTP_OK);
    }

    public function activity(): JsonResponse
    {
        $userId = (int) auth()->user()->id;

        $memberships = Customer::query()
            ->where('user_id', $userId)
            ->get(['id', 'business_id']);

        $customerIds = $memberships->pluck('id')->all();

        if (empty($customerIds)) {
            return response()->json([
                'data' => [
                    'items' => [],
                ],
                'meta' => [],
                'summary' => [],
            ], Response::HTTP_OK);
        }

        $visits = Visit::query()
            ->whereIn('customer_id', $customerIds)
            ->orderBy('date', 'desc')
            ->get(['id', 'date', 'business_id', 'customer_id']);

        $visitHistory = $visits->map(function (Visit $v): array {
            return [
                'id' => (string) $v->id,
                'type' => 'visit',
                'business_id' => (string) $v->business_id,
                'customer_id' => (string) $v->customer_id,
                'date' => $v->date ? optional($v->date)->toISOString() : null,
                'points' => 1,
            ];
        });

        $redemptions = RewardRedemption::query()
            ->whereIn('customer_id', $customerIds)
            ->orderBy('earned_at', 'desc')
            ->get(['id', 'status', 'earned_at', 'redeemed_at', 'business_id', 'customer_id']);

        $rewardEvents = $redemptions->map(function (RewardRedemption $r): array {
            if ($r->status === 'earned' && empty($r->redeemed_at)) {
                return [
                    'id' => (string) $r->id,
                    'type' => 'reward_claimed',
                    'business_id' => (string) $r->business_id,
                    'customer_id' => (string) $r->customer_id,
                    'date' => $r->earned_at ? optional($r->earned_at)->toISOString() : null,
                ];
            }

            if ($r->status === 'redeemed' || ! empty($r->redeemed_at)) {
                return [
                    'id' => (string) $r->id,
                    'type' => 'reward_redeemed',
                    'business_id' => (string) $r->business_id,
                    'customer_id' => (string) $r->customer_id,
                    'date' => $r->redeemed_at ? optional($r->redeemed_at)->toISOString() : null,
                ];
            }

            return [
                'id' => (string) $r->id,
                'type' => 'reward_event',
                'business_id' => (string) $r->business_id,
                'customer_id' => (string) $r->customer_id,
                'date' => $r->earned_at ? optional($r->earned_at)->toISOString() : null,
            ];
        });

        $items = $visitHistory->concat($rewardEvents)
            ->sortByDesc('date')
            ->values()
            ->take(50)
            ->all();

        return response()->json([
            'data' => [
                'items' => $items,
            ],
            'meta' => [],
            'summary' => [],
        ], Response::HTTP_OK);
    }

    public function notifications(): JsonResponse
    {
        // No notification model exists in current backend architecture.
        return response()->json([
            'data' => [],
            'meta' => [],
            'summary' => [],
        ], Response::HTTP_OK);
    }

    public function businesses(): JsonResponse
    {
        $userId = (int) auth()->user()->id;

        $memberships = Customer::query()
            ->where('user_id', $userId)
            ->get(['id', 'business_id', 'qr_code', 'first_name', 'last_name']);

        if ($memberships->isEmpty()) {
            return response()->json([
                'data' => [],
                'meta' => [],
                'summary' => [],
            ], Response::HTTP_OK);
        }

        $businessIds = $memberships->pluck('business_id')->unique()->values()->all();

        $loyaltyCards = LoyaltyCard::query()
            ->whereIn('business_id', $businessIds)
            ->get()
            ->keyBy('business_id');

        // customer_loyalties are per membership customer_id; map by customer.business_id.
        $loyalties = CustomerLoyalty::query()
            ->whereIn('customer_id', $memberships->pluck('id')->all())
            ->get()
            ->keyBy('customer_id');

        $cardsByCustomerId = $loyalties->map(function (CustomerLoyalty $l) {
            return [
                'current_stamps' => (int) $l->current_stamps,
                'loyalty_card_id' => $l->loyalty_card_id ? (string) $l->loyalty_card_id : null,
                'loyalty_card' => $l->loyaltyCard ? [
                    'id' => (string) $l->loyaltyCard->id,
                    'reward_name' => $l->loyaltyCard->reward_name,
                    'required_stamps' => (int) $l->loyaltyCard->required_stamps,
                    'reward_description' => $l->loyaltyCard->reward_description,
                ] : null,
            ];
        });

        // Emit businesses once per membership (front-end can decide).
        $data = $memberships->map(function (Customer $m) use ($loyaltyCards, $cardsByCustomerId) {
            $loyaltyCard = $loyaltyCards->get($m->business_id);

            $loyaltyMeta = $cardsByCustomerId->get($m->id);

            $required = (int) ($loyaltyCard?->required_stamps ?? 0);
            $current = (int) ($loyaltyMeta['current_stamps'] ?? 0);

            return [
                'business' => [
                    'id' => (string) $m->business_id,
                ],
                'membership' => [
                    'customer_id' => (string) $m->id,
                    'qr_code' => $m->qr_code,
                    'first_name' => $m->first_name,
                    'last_name' => $m->last_name,
                ],
                'card' => $loyaltyCard ? [
                    'id' => (string) $loyaltyCard->id,
                    'reward_name' => $loyaltyCard->reward_name,
                    'required_stamps' => $required,
                    'reward_description' => $loyaltyCard->reward_description,
                ] : null,
                'loyalty_status' => [
                    'current_stamps' => $current,
                    'progress_percent' => $required > 0 ? min(100, (int) round(($current / $required) * 100)) : 0,
                    'required_stamps' => $required,
                ],
            ];
        })->values();

        return response()->json([
            'data' => $data,
            'meta' => [],
            'summary' => [],
        ], Response::HTTP_OK);
    }
}
