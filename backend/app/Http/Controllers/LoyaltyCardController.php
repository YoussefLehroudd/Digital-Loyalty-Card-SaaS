<?php

namespace App\Http\Controllers;

use App\Events\BusinessCardUpdated;
use App\Http\Requests\LoyaltyCard\CreateLoyaltyCardRequest;
use App\Http\Requests\LoyaltyCard\UpdateLoyaltyCardRequest;
use App\Models\LoyaltyCard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class LoyaltyCardController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $business = $this->currentBusiness($request);

        $loyaltyCard = LoyaltyCard::query()
            ->where('business_id', $business->id)
            ->first();

        if (! $loyaltyCard) {
            return response()->json([
                'message' => 'Loyalty card not configured for this business.',
            ], Response::HTTP_NOT_FOUND);
        }

        return response()->json([
            'loyalty_card' => $this->serialize($loyaltyCard),
        ]);
    }

    public function store(CreateLoyaltyCardRequest $request): JsonResponse
    {
        $business = $this->currentBusiness($request);

        $alreadyExists = LoyaltyCard::query()
            ->where('business_id', $business->id)
            ->exists();

        if ($alreadyExists) {
            return response()->json([
                'message' => 'Loyalty card already exists for this business.',
            ], Response::HTTP_CONFLICT);
        }

        $loyaltyCard = LoyaltyCard::query()->create([
            'business_id' => $business->id,
            ...$request->validated(),
        ]);

        event(new BusinessCardUpdated(
            businessId: (int) $business->id,
            loyaltyCardId: (int) $loyaltyCard->id,
        ));

        return response()->json([
            'message' => 'Loyalty card created successfully.',
            'loyalty_card' => $this->serialize($loyaltyCard),
        ], Response::HTTP_CREATED);
    }

    public function update(UpdateLoyaltyCardRequest $request): JsonResponse
    {
        $business = $this->currentBusiness($request);

        $loyaltyCard = LoyaltyCard::query()
            ->where('business_id', $business->id)
            ->first();

        if (! $loyaltyCard) {
            return response()->json([
                'message' => 'Loyalty card not found for this business.',
            ], Response::HTTP_NOT_FOUND);
        }

        $loyaltyCard->update($request->validated());

        event(new BusinessCardUpdated(
            businessId: (int) $business->id,
            loyaltyCardId: (int) $loyaltyCard->id,
        ));

        return response()->json([
            'message' => 'Loyalty card updated successfully.',
            'loyalty_card' => $this->serialize($loyaltyCard->refresh()),
        ]);
    }

    private function currentBusiness(Request $request)
    {
        $business = $request->user()->load('business')->business;

        if (! $business) {
            abort(Response::HTTP_FORBIDDEN, 'A business workspace is required.');
        }

        return $business;
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(LoyaltyCard $loyaltyCard): array
    {
        return [
            'id' => (string) $loyaltyCard->id,
            'business_id' => (string) $loyaltyCard->business_id,
            'reward_name' => $loyaltyCard->reward_name,
            'required_stamps' => $loyaltyCard->required_stamps,
            'reward_description' => $loyaltyCard->reward_description,
            'created_at' => optional($loyaltyCard->created_at)->toISOString(),
            'updated_at' => optional($loyaltyCard->updated_at)->toISOString(),
        ];
    }
}
