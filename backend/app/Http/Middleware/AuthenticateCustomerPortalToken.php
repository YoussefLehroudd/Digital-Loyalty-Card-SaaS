<?php

namespace App\Http\Middleware;

use App\Models\CustomerPortalToken;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateCustomerPortalToken
{
    /**
     * Attach portal scope to request:
     * - $request->attributes->set('portal_customer_id', ...)
     * - $request->attributes->set('portal_business_id', ...)
     */
    public function handle(Request $request, Closure $next): Response
    {
        $header = $request->header('Authorization', '');

        if (! is_string($header) || ! Str::startsWith($header, 'Bearer ')) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $rawToken = trim(substr($header, 7));
        if ($rawToken === '') {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $tokenHash = hash('sha256', $rawToken);

        $token = CustomerPortalToken::query()
            ->where('token_hash', $tokenHash)
            ->where('enabled', true)
            ->whereNull('revoked_at')
            ->first();

        if (! $token) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $request->attributes->set('portal_customer_id', (int) $token->customer_id);
        $request->attributes->set('portal_business_id', (int) $token->business_id);

        return $next($request);
    }
}
