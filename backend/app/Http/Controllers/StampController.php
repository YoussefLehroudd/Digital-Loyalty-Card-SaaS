<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\CustomerLoyalty;
use App\Models\LoyaltyCard;
use App\Models\RewardRedemption;
use App\Models\Visit;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use App\Events\StampAdded;
use App\Events\RewardRedeemed;
use Symfony\Component\HttpFoundation\Response;

class StampController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $business = $request->user()->load('business')->business;

        if (! $business) {
            abort(Response::HTTP_FORBIDDEN, 'A business workspace is required.');
        }

        $validated = $request->validate([
            'qr_code' => ['required', 'string'],
        ]);

        $qrCode = (string) $validated['qr_code'];

        $customer = Customer::query()
            ->where('qr_code', $qrCode)
            ->first();

        if (! $customer) {
            return response()->json([
                'message' => 'Customer not found.',
            ], Response::HTTP_NOT_FOUND);
        }

        if ((int) $customer->business_id !== (int) $business->id) {
            return response()->json([
                'message' => 'Customer not found.',
            ], Response::HTTP_NOT_FOUND);
        }

        $loyaltyCard = LoyaltyCard::query()
            ->where('business_id', $business->id)
            ->first();

        if (! $loyaltyCard) {
            return response()->json([
                'message' => 'Loyalty card not configured for this business.',
            ], Response::HTTP_NOT_FOUND);
        }

        $customerLoyalty = CustomerLoyalty::query()
            ->where('customer_id', $customer->id)
            ->first();

        if (! $customerLoyalty) {
            return response()->json([
                'message' => 'Loyalty progress not found.',
            ], Response::HTTP_NOT_FOUND);
        }

        $createdRewardRedemption = false;

        DB::transaction(function () use (
            $customer,
            $business,
            $loyaltyCard,
            $customerLoyalty,
            &$createdRewardRedemption
        ): void {
            Visit::query()->create([
                'customer_id' => $customer->id,
                'business_id' => $business->id,
                'date' => now(),
            ]);

            $customerLoyalty->refresh();
            $required = (int) $loyaltyCard->required_stamps;
            $current = (int) $customerLoyalty->current_stamps;

            // Cap stamps so current_stamps is never allowed to exceed required_stamps.
            if ($current < $required) {
                $customerLoyalty->increment('current_stamps', 1);
                $customerLoyalty->refresh();
            }

            $current = (int) $customerLoyalty->current_stamps;

            if ($current >= $required) {
                // Reward is "unlocked" when there is an earned record not yet redeemed.
                $alreadyEarnedAndNotRedeemed = RewardRedemption::query()
                    ->where('business_id', $business->id)
                    ->where('customer_id', $customer->id)
                    ->where('status', 'earned')
                    ->whereNull('redeemed_at')
                    ->exists();

                if (! $alreadyEarnedAndNotRedeemed) {
                    RewardRedemption::query()->create([
                        'customer_id' => $customer->id,
                        'business_id' => $business->id,
                        'date' => now(),
                        'status' => 'earned',
                        'earned_at' => now(),
                        'redeemed_at' => null,
                    ]);
                    $createdRewardRedemption = true;
                }
            }
        });

        $freshCustomerLoyalty = CustomerLoyalty::query()
            ->where('customer_id', $customer->id)
            ->first();

        $rewardUnlocked = RewardRedemption::query()
            ->where('business_id', $business->id)
            ->where('customer_id', $customer->id)
            ->where('status', 'earned')
            ->whereNull('redeemed_at')
            ->exists();

        // Broadcast after the transaction has completed (DB changes are committed).
        event(new StampAdded(
            businessId: (int) $business->id,
            customerId: (int) $customer->id,
            currentStamps: (int) ($freshCustomerLoyalty?->current_stamps ?? 0),
            requiredStamps: (int) $loyaltyCard->required_stamps,
            rewardUnlocked: (bool) $rewardUnlocked,
        ));

        // SSE source of truth: write latest card.updated payload to Cache
        Cache::put(
            key: "customer:{$customer->id}:card.updated",
            value: [
                'card_id' => (int) ($loyaltyCard->id ?? 0),
                'customer_id' => (int) $customer->id,
                'updated_at' => now()->toISOString(),
            ],
            minutes: 10
        );

        return response()->json([
            'message' => 'Stamp added successfully.',
            'loyalty' => [
                'current_stamps' => (int) ($freshCustomerLoyalty?->current_stamps ?? 0),
                'required_stamps' => (int) $loyaltyCard->required_stamps,
                'reward_unlocked' => $rewardUnlocked,
                'reward_redemption_created' => $createdRewardRedemption,
            ],
        ], Response::HTTP_CREATED);
    }

    public function redeemReward(Request $request): JsonResponse
    {
        $business = $request->user()->load('business')->business;

        if (! $business) {
            abort(Response::HTTP_FORBIDDEN, 'A business workspace is required.');
        }

        $validated = $request->validate([
            'qr_code' => ['required', 'string'],
        ]);

        $qrCode = (string) $validated['qr_code'];

        $customer = Customer::query()
            ->where('qr_code', $qrCode)
            ->first();

        if (! $customer) {
            return response()->json([
                'message' => 'Customer not found.',
            ], Response::HTTP_NOT_FOUND);
        }

        if ((int) $customer->business_id !== (int) $business->id) {
            return response()->json([
                'message' => 'Customer not found.',
            ], Response::HTTP_NOT_FOUND);
        }

        $loyaltyCard = LoyaltyCard::query()
            ->where('business_id', $business->id)
            ->first();

        if (! $loyaltyCard) {
            return response()->json([
                'message' => 'Loyalty card not configured for this business.',
            ], Response::HTTP_NOT_FOUND);
        }

        $customerLoyalty = CustomerLoyalty::query()
            ->where('customer_id', $customer->id)
            ->first();

        if (! $customerLoyalty) {
            return response()->json([
                'message' => 'Loyalty progress not found.',
            ], Response::HTTP_NOT_FOUND);
        }

        $required = (int) $loyaltyCard->required_stamps;

        if ((int) $customerLoyalty->current_stamps < $required) {
            return response()->json([
                'success' => false,
                'message' => 'Reward is not unlocked yet.',
                'loyalty' => [
                    'current_stamps' => (int) $customerLoyalty->current_stamps,
                    'required_stamps' => $required,
                    'reward_unlocked' => false,
                ],
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        $rewardAlreadyRedeemed = false;

        DB::transaction(function () use (
            $customer,
            $business,
            $required,
            $customerLoyalty,
            &$rewardAlreadyRedeemed
        ): void {
            // Find the currently earned reward (idempotent target)
            $earnedReward = RewardRedemption::query()
                ->where('business_id', $business->id)
                ->where('customer_id', $customer->id)
                ->where('status', 'earned')
                ->whereNull('redeemed_at')
                ->first();

            if (! $earnedReward) {
                // Already redeemed (or never earned) -> idempotent success.
                $rewardAlreadyRedeemed = true;
                return;
            }

            // Mark redeemed
            $earnedReward->status = 'redeemed';
            $earnedReward->redeemed_at = now();
            $earnedReward->save();

            // Reset stamps for a new cycle (since there is only one loyalty row per customer)
            $customerLoyalty->refresh();
            $customerLoyalty->current_stamps = 0;
            $customerLoyalty->save();
        });

        $freshCustomerLoyalty = CustomerLoyalty::query()
            ->where('customer_id', $customer->id)
            ->first();

        event(new RewardRedeemed(
            businessId: (int) $business->id,
            customerId: (int) $customer->id,
            currentStamps: (int) ($freshCustomerLoyalty?->current_stamps ?? 0),
            requiredStamps: (int) $required,
        ));

        // SSE source of truth: write latest card.updated payload to Cache
        Cache::put(
            key: "customer:{$customer->id}:card.updated",
            value: [
                'card_id' => (int) ($loyaltyCard->id ?? 0),
                'customer_id' => (int) $customer->id,
                'updated_at' => now()->toISOString(),
            ],
            minutes: 10
        );

        return response()->json([
            'success' => true,
            'message' => $rewardAlreadyRedeemed ? 'Reward was already redeemed.' : 'Reward redeemed',
            'loyalty' => [
                'current_stamps' => (int) ($freshCustomerLoyalty?->current_stamps ?? 0),
                'required_stamps' => $required,
                'reward_unlocked' => false,
            ],
            'reward_redeemed' => true,
        ], Response::HTTP_OK);
    }
}
