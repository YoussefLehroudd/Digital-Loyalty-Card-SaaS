<?php

namespace App\Services;

use App\Models\Business;
use App\Models\Customer;
use App\Models\CustomerLoyalty;
use App\Models\LoyaltyCard;
use App\Models\User;

class CustomerMembershipService
{
    public function __construct(
        private readonly QrCodeService $qrCodeService
    ) {
    }

    /**
     * @param array<string, mixed> $payload
     * @return array{customer: Customer, loyalty_card: LoyaltyCard|null, loyalty: CustomerLoyalty|null}
     */
    public function registerForBusiness(Business $business, array $payload, ?User $authenticatedCustomerUser = null): array
    {
        $customer = null;

        if ($authenticatedCustomerUser) {
            $customer = Customer::query()
                ->where('user_id', $authenticatedCustomerUser->id)
                ->where('business_id', $business->id)
                ->first();
        }

        if (! $customer) {
            $customer = Customer::query()->create([
                ...$payload,
                'user_id' => $authenticatedCustomerUser?->id,
                'business_id' => $business->id,
                'qr_code' => $this->qrCodeService->generateBusinessBoundCustomerQrCode($business->id),
            ]);
        } elseif ($authenticatedCustomerUser && ! $customer->user_id) {
            $customer->user_id = $authenticatedCustomerUser->id;
            $customer->save();
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

        return [
            'customer' => $customer,
            'loyalty_card' => $loyaltyCard,
            'loyalty' => $customerLoyalty,
        ];
    }
}
