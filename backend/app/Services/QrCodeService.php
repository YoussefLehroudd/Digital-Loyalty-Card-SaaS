<?php

namespace App\Services;

use App\Models\Customer;
use RuntimeException;

class QrCodeService
{
    /**
     * Legacy: random per-customer QR used for membership identity.
     */
    public function generateUniqueCustomerQrCode(int $maxAttempts = 5): string
    {
        for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
            $value = (string) str()->uuid();

            $exists = Customer::query()
                ->where('qr_code', $value)
                ->exists();

            if (! $exists) {
                return $value;
            }
        }

        throw new RuntimeException('Unable to generate a unique QR code value.');
    }

    /**
     * QR that the frontend/customer can scan to join/unlock a specific business.
     * Kept as a relative path so we don't hardcode the frontend domain.
     */
    public function generateBusinessJoinQrCode(int $businessId): string
    {
        return '/user/login?join_business_id=' . $businessId;
    }
}
