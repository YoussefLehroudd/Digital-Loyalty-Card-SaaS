<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_loyalties', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('loyalty_card_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('current_stamps')->default(0);
            $table->timestamps();

            $table->unique('customer_id');
            $table->index(['loyalty_card_id', 'current_stamps']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_loyalties');
    }
};
