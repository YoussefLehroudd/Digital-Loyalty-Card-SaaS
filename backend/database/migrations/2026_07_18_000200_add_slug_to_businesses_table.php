<?php

use App\Models\Business;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('businesses', function (Blueprint $table): void {
            $table->string('slug')->nullable()->after('name');
        });

        Business::query()->select('id', 'name')->orderBy('id')->chunkById(100, function ($businesses): void {
            foreach ($businesses as $business) {
                $base = Str::slug($business->name ?: 'business');
                $base = $base !== '' ? $base : 'business';

                $slug = $base;
                $suffix = 1;

                while (Business::query()->where('slug', $slug)->where('id', '!=', $business->id)->exists()) {
                    $suffix++;
                    $slug = $base.'-'.$suffix;
                }

                Business::query()
                    ->where('id', $business->id)
                    ->update(['slug' => $slug]);
            }
        });

        Schema::table('businesses', function (Blueprint $table): void {
            $table->string('slug')->nullable(false)->change();
            $table->unique('slug');
        });
    }

    public function down(): void
    {
        Schema::table('businesses', function (Blueprint $table): void {
            $table->dropUnique(['slug']);
            $table->dropColumn('slug');
        });
    }
};
