<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('reward_redemptions', function (Blueprint $table): void {
            $table->string('status')->default('earned')->after('date');
            $table->dateTime('earned_at')->nullable()->after('status');
            $table->dateTime('redeemed_at')->nullable()->after('earned_at');

            // Helpful uniqueness for idempotency (optional but safe)
            $table->string('idempotency_key')->nullable()->after('redeemed_at');
            $table->unique(['business_id', 'customer_id', 'idempotency_key'], 'reward_redemptions_idemp_unique');
        });
    }

    public function down(): void
    {
        Schema::table('reward_redemptions', function (Blueprint $table): void {
            $table->dropUnique('reward_redemptions_idemp_unique');
            $table->dropColumn(['idempotency_key', 'redeemed_at', 'earned_at', 'status']);
        });
    }
};
