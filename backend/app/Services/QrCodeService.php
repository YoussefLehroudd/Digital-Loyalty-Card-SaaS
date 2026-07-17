<?php

namespace App\Services;

use App\Models\Customer;
use RuntimeException;

class QrCodeService
{
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
}
