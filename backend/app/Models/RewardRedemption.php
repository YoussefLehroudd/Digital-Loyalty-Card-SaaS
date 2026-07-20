<?php

namespace App\Models;

use Database\Factories\RewardRedemptionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RewardRedemption extends Model
{
    /** @use HasFactory<RewardRedemptionFactory> */
    use HasFactory;

    protected $fillable = [
        'customer_id',
        'business_id',
        'date',
        'status',
        'earned_at',
        'redeemed_at',
        'idempotency_key',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'datetime',
            'earned_at' => 'datetime',
            'redeemed_at' => 'datetime',
        ];
    }

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(Customer::class);
    }
}
