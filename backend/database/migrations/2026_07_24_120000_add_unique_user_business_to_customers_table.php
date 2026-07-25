<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            // Prevent duplicate memberships for the same authenticated user + business.
            // Multiple NULL user_id values are allowed (backward compatible with guest customers).
            $table->unique(['user_id', 'business_id'], 'customers_user_id_business_id_unique');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            $table->dropUnique('customers_user_id_business_id_unique');
        });
    }
};
