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
                $alreadyHasRedemption = RewardRedemption::query()
                    ->where('business_id', $business->id)
                    ->where('customer_id', $customer->id)
                    ->exists();

                if (! $alreadyHasRedemption) {
                    RewardRedemption::query()->create([
                        'customer_id' => $customer->id,
                        'business_id' => $business->id,
                        'date' => now(),
                    ]);
                    $createdRewardRedemption = true;
                }
            }
        });

        $freshCustomerLoyalty = CustomerLoyalty::query()
            ->where('customer_id', $customer->id)
            ->first();

        $rewardRedeemed = RewardRedemption::query()
            ->where('business_id', $business->id)
            ->where('customer_id', $customer->id)
            ->exists();

        return response()->json([
            'message' => 'Stamp added successfully.',
            'loyalty' => [
                'current_stamps' => (int) ($freshCustomerLoyalty?->current_stamps ?? 0),
                'required_stamps' => (int) $loyaltyCard->required_stamps,
                'reward_unlocked' => $rewardRedeemed,
                'reward_redemption_created' => $createdRewardRedemption,
            ],
        ], Response::HTTP_CREATED);
    }
}
