<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('visits', function (Blueprint $table): void {
            // Speeds up metric queries filtering by business_id and date.
            $table->index(['business_id', 'date'], 'visits_business_date_idx');
        });

        Schema::table('reward_redemptions', function (Blueprint $table): void {
            // Speeds up rewards metric queries filtering by business_id and date.
            $table->index(['business_id', 'date'], 'reward_redemptions_business_date_idx');
        });

        Schema::table('customers', function (Blueprint $table): void {
            $table->index(['business_id'], 'customers_business_id_idx');
        });
    }

    public function down(): void
    {
        Schema::table('visits', function (Blueprint $table): void {
            $table->dropIndex('visits_business_date_idx');
        });

        Schema::table('reward_redemptions', function (Blueprint $table): void {
            $table->dropIndex('reward_redemptions_business_date_idx');
        });

        Schema::table('customers', function (Blueprint $table): void {
            $table->dropIndex('customers_business_id_idx');
        });
    }
};
