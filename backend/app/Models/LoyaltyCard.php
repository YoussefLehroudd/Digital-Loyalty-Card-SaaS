<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LoyaltyCard extends Model
{
    protected $fillable = [
        'business_id',
        'reward_name',
        'required_stamps',
        'reward_description',
    ];

    protected $casts = [
        'required_stamps' => 'integer',
    ];

    public function business(): BelongsTo
    {
        return $this->belongsTo(Business::class);
    }
}
