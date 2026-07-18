<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('reward_redemptions', function (Blueprint $table): void {
            $table->id();

            $table->foreignId('customer_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->foreignId('business_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->dateTime('date');

            $table->timestamps();

            $table->index(['business_id', 'customer_id', 'date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reward_redemptions');
    }
};
