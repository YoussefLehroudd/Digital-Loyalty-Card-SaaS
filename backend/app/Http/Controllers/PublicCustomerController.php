<?php

namespace App\Http\Controllers;

use App\Http\Requests\Customer\PublicRegisterCustomerRequest;
use App\Models\Business;
use App\Models\Customer;
use App\Models\CustomerLoyalty;
use App\Models\LoyaltyCard;
use App\Services\QrCodeService;
use Illuminate\Http\JsonResponse;
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
