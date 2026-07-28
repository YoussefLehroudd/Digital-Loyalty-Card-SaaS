<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('customer.{customerId}', function ($user, $customerId) {
    // Customer user can only listen to their own customer model via the related user_id.
    return (int) $customerId === (int) ($user->id ?? 0);
});

Broadcast::channel('business.{businessId}', function ($user, $businessId) {
    // Business users (role: business_owner) should listen to their business workspace.
    // If the user model has a business relation loaded elsewhere, access via $user->business->id.
    // Fall back to comparing directly if available.
    if (isset($user->business) && $user->business) {
        return (int) $businessId === (int) $user->business->id;
    }

    // If auth guard doesn't provide business relation, deny by default.
    return false;
});
