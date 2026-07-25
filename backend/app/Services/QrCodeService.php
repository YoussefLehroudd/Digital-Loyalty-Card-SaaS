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
     * QR shown on the loyalty card (used by business scanning/redeeming).
     * Must be unique per customer but also bound to the business they belong to.
     *
     * Format: b{businessId}:{uuid}
     */
    public function generateBusinessBoundCustomerQrCode(int $businessId, int $maxAttempts = 5): string
    {
        for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
            $uuid = (string) str()->uuid();
            $value = 'b' . $businessId . ':' . $uuid;

            $exists = Customer::query()
                ->where('qr_code', $value)
                ->exists();

            if (! $exists) {
                return $value;
            }
        }

        throw new RuntimeException('Unable to generate a unique business-bound QR code value.');
    }
}
