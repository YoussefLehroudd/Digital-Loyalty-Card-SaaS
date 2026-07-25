<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerPortalToken extends Model
{
    protected $fillable = [
        'customer_id',
        'business_id',
        'token_hash',
        'enabled',
        'revoked_at',
    ];

    protected $casts = [
        'enabled' => 'boolean',
    ];

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }
}
