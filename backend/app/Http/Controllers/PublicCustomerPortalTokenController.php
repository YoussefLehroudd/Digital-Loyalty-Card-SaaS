<?php

namespace App\Http\Controllers;

use App\Models\Business;
use App\Models\Customer;
use App\Models\CustomerPortalToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class PublicCustomerPortalTokenController extends Controller
{
    public function portalTokenFromQr(Request $request, string $qrCode): JsonResponse
    {
        $customer = Customer::query()
            ->where('qr_code', $qrCode)
            ->first();

        if (! $customer) {
            return response()->json([
                'message' => 'Customer not found.',
            ], Response::HTTP_NOT_FOUND);
        }

        /** @var Business|null $business */
        $business = $customer->business()->first();
        if (! $business) {
            return response()->json([
                'message' => 'Business not found.',
            ], Response::HTTP_NOT_FOUND);
        }

        // One active token per (customer, business) — reuse existing mechanism semantics.
        $rawToken = bin2hex(random_bytes(32)); // 64 hex chars
        $tokenHash = hash('sha256', $rawToken);

        $existing = CustomerPortalToken::query()
            ->where('customer_id', $customer->id)
            ->where('business_id', $business->id)
            ->first();

        if ($existing) {
            $existing->update([
                'token_hash' => $tokenHash,
                'enabled' => true,
                'revoked_at' => null,
            ]);
        } else {
            CustomerPortalToken::query()->create([
                'customer_id' => $customer->id,
                'business_id' => $business->id,
                'token_hash' => $tokenHash,
                'enabled' => true,
                'revoked_at' => null,
            ]);
        }

        return response()->json([
            'data' => [
                'token' => $rawToken,
            ],
            'meta' => [],
            'summary' => [],
        ], Response::HTTP_OK);
    }
}
