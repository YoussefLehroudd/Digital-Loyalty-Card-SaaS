<?php

namespace App\Models;

use Database\Factories\BusinessFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Str;

class Business extends Model
{
    /** @use HasFactory<BusinessFactory> */
    use HasFactory;

    protected static function booted(): void
    {
        static::creating(function (Business $business): void {
            if (! $business->slug) {
                $business->slug = static::generateUniqueSlug($business->name);
            }
        });
    }

    protected static function generateUniqueSlug(?string $name): string
    {
        $base = Str::slug($name ?: 'business');
        $base = $base !== '' ? $base : 'business';

        $slug = $base;
        $suffix = 1;

        while (static::query()->where('slug', $slug)->exists()) {
            $suffix++;
            $slug = $base.'-'.$suffix;
        }

        return $slug;
    }

    protected $fillable = [
        'name',
        'logo_url',
        'slug',
        'logo_public_id',
        'hero_image_url',
        'hero_image_public_id',
        'hero_image_zoom',
        'hero_image_position_x',
        'hero_image_position_y',
        'primary_color',
        'email',
        'phone',
        'address',
    ];

    protected $casts = [
        'hero_image_zoom' => 'float',
        'hero_image_position_x' => 'float',
        'hero_image_position_y' => 'float',
    ];

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    public function customers(): HasMany
    {
        return $this->hasMany(Customer::class);
    }

    public function visits(): HasMany
    {
        return $this->hasMany(Visit::class);
    }

    public function rewardRedemptions(): HasMany
    {
        return $this->hasMany(RewardRedemption::class);
    }

    public function loyaltyCard(): HasOne
    {
        return $this->hasOne(LoyaltyCard::class);
    }
}
