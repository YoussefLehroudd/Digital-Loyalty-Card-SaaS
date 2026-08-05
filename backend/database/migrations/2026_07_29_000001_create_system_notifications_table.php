<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('system_notifications', function (Blueprint $table) {
            $table->id();

            // Recipient is always an authenticated User.
            $table->foreignId('recipient_user_id')->constrained('users')->cascadeOnDelete();

            // Optional context for scoping / rendering.
            $table->foreignId('business_id')->nullable()->constrained('businesses')->nullOnDelete();
            $table->foreignId('customer_id')->nullable()->constrained('customers')->nullOnDelete();

            $table->string('type'); // notification type key, e.g. reward_earned
            $table->string('title')->nullable();
            $table->text('body')->nullable();

            // For reusable UI rendering.
            $table->json('data')->nullable();

            // Unread/read tracking
            $table->timestamp('read_at')->nullable();

            $table->timestamps();

            $table->index(['recipient_user_id', 'read_at']);
            $table->index(['recipient_user_id', 'created_at']);
            $table->index(['business_id', 'created_at']);
            $table->index(['customer_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_notifications');
    }
};
