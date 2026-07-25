<?php

namespace App\Http\Controllers;

use App\Enums\UserRole;
use App\Http\Requests\Customer\PublicRegisterCustomerRequest;
use App\Models\Business;
use App\Models\Customer;
use App\Models\CustomerLoyalty;
use App\Models\LoyaltyCard;
use App\Services\QrCodeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class PublicCustomerController extends Controller
{
    public function showBusiness(string $slug): JsonResponse
    {
        $business = Business::query()
            ->where('slug', $slug)
            ->first();

        if (! $business) {
            return response()->json([
                'message' => 'Business not found.',
            ], Response::HTTP_NOT_FOUND);
        }

        $loyaltyCard = LoyaltyCard::query()
            ->where('business_id', $business->id)
            ->first();

        return response()->json([
            'business' => [
                'id' => (string) $business->id,
                'name' => $business->name,
                'slug' => $business->slug,
                'logo_url' => $business->logo_url,
                'primary_color' => $business->primary_color,

                'hero_image_url' => $business->hero_image_url,
                'hero_image_zoom' => $business->hero_image_zoom,
                'hero_image_position_x' => $business->hero_image_position_x,
                'hero_image_position_y' => $business->hero_image_position_y,
            ],
            'loyalty_card' => $loyaltyCard ? $this->serializeLoyaltyCard($loyaltyCard) : null,
        ]);
    }

    public function register(
        string $slug,
        PublicRegisterCustomerRequest $request,
        QrCodeService $qrCodeService
    ): JsonResponse
    {
        $business = Business::query()
            ->where('slug', $slug)
            ->first();

        if (! $business) {
            return response()->json([
                'message' => 'Business not found.',
            ], Response::HTTP_NOT_FOUND);
        }

        // This endpoint is "public" in routing, so $request->user() may be null even if a Bearer token is provided.
        // Authenticate manually via Sanctum so we can implement Case 1/Case 2 without changing route middleware.
        $authenticatedUser = Auth::guard('sanctum')->user();

        // Case 1: authenticated customer links to this business membership.
        if ($authenticatedUser && $authenticatedUser->role === UserRole::Customer) {
            $validated = $request->validated();

            $customer = Customer::query()
                ->where('user_id', $authenticatedUser->id)
                ->where('business_id', $business->id)
                ->first();

            if (! $customer) {
                $customer = Customer::query()->create([
                    // preserve backward compatibility fields
                    ...$validated,
                    'user_id' => $authenticatedUser->id,
                    'business_id' => $business->id,
                    'qr_code' => $qrCodeService->generateUniqueCustomerQrCode(),
                ]);
            }

            $loyaltyCard = LoyaltyCard::query()
                ->where('business_id', $business->id)
                ->first();

            $customerLoyalty = null;
            if ($loyaltyCard) {
                $customerLoyalty = CustomerLoyalty::query()
                    ->firstOrCreate(
                        [
                            'customer_id' => $customer->id,
                            'loyalty_card_id' => $loyaltyCard->id,
                        ],
                        [
                            'current_stamps' => 0,
                        ]
                    );
            }

            return response()->json([
                'message' => 'Customer registered successfully.',
                'customer' => $this->serializeCustomer($customer),
                'loyalty_card' => $loyaltyCard ? $this->serializeLoyaltyCard($loyaltyCard) : null,
                'loyalty' => $customerLoyalty ? [
                    'id' => (string) $customerLoyalty->id,
                    'customer_id' => (string) $customerLoyalty->customer_id,
                    'loyalty_card_id' => (string) $customerLoyalty->loyalty_card_id,
                    'current_stamps' => $customerLoyalty->current_stamps,
                    'created_at' => optional($customerLoyalty->created_at)->toISOString(),
                    'updated_at' => optional($customerLoyalty->updated_at)->toISOString(),
                ] : null,
            ], Response::HTTP_CREATED);
        }

        // Case 2: authenticated but NOT a customer => forbidden.
        if ($authenticatedUser && $authenticatedUser->role !== UserRole::Customer) {
            return response()->json([
                'message' => 'Forbidden.',
            ], Response::HTTP_FORBIDDEN);
        }

        // Case 2: guest flow (unchanged behavior).
        $customer = Customer::query()->create([
            ...$request->validated(),
            'business_id' => $business->id,
            'qr_code' => $qrCodeService->generateUniqueCustomerQrCode(),
        ]);

        $loyaltyCard = LoyaltyCard::query()
            ->where('business_id', $business->id)
            ->first();

        if ($loyaltyCard) {
            CustomerLoyalty::query()->create([
                'customer_id' => $customer->id,
                'loyalty_card_id' => $loyaltyCard->id,
                'current_stamps' => 0,
            ]);
        }

        return response()->json([
            'message' => 'Customer registered successfully.',
            'customer' => $this->serializeCustomer($customer),
        ], Response::HTTP_CREATED);
    }

    public function wallet(string $qrCode): JsonResponse
    {
        $customer = Customer::query()
            ->where('qr_code', $qrCode)
            ->first();

        if (! $customer) {
            return response()->json([
                'message' => 'Customer wallet not found.',
            ], Response::HTTP_NOT_FOUND);
        }

        $business = Business::query()
            ->whereKey($customer->business_id)
            ->first();

        if (! $business) {
            return response()->json([
                'message' => 'Business not found.',
            ], Response::HTTP_NOT_FOUND);
        }

        $loyaltyCard = LoyaltyCard::query()
            ->where('business_id', $business->id)
            ->first();

        $customerLoyalty = CustomerLoyalty::query()
            ->where('customer_id', $customer->id)
            ->first();

        return response()->json([
            'business' => [
                'id' => (string) $business->id,
                'name' => $business->name,
                'slug' => $business->slug,
                'logo_url' => $business->logo_url,
                'primary_color' => $business->primary_color,
            ],
            'customer' => $this->serializeCustomer($customer),
            'loyalty_card' => $loyaltyCard ? $this->serializeLoyaltyCard($loyaltyCard) : null,
            'loyalty' => $customerLoyalty ? [
                'id' => (string) $customerLoyalty->id,
                'customer_id' => (string) $customerLoyalty->customer_id,
                'loyalty_card_id' => (string) $customerLoyalty->loyalty_card_id,
                'current_stamps' => $customerLoyalty->current_stamps,
                'created_at' => optional($customerLoyalty->created_at)->toISOString(),
                'updated_at' => optional($customerLoyalty->updated_at)->toISOString(),
            ] : null,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeCustomer(Customer $customer): array
    {
        return [
            'id' => (string) $customer->id,
            'user_id' => $customer->user_id ? (string) $customer->user_id : null,
            'business_id' => (string) $customer->business_id,
            'first_name' => $customer->first_name,
            'last_name' => $customer->last_name,
            'email' => $customer->email,
            'phone' => $customer->phone,
            'qr_code' => $customer->qr_code,
            'created_at' => optional($customer->created_at)->toISOString(),
            'updated_at' => optional($customer->updated_at)->toISOString(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeLoyaltyCard(LoyaltyCard $loyaltyCard): array
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
