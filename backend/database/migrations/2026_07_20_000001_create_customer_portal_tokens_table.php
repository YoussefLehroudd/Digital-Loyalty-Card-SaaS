<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('customer_portal_tokens', function (Blueprint $table): void {
            $table->id();

            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->foreignId('business_id')->constrained()->cascadeOnDelete();

            // Store only a hash of the token (never the raw token).
            $table->string('token_hash', 64)->unique();

            $table->boolean('enabled')->default(true);
            $table->timestamp('revoked_at')->nullable();

            $table->timestamps();

            $table->index(['customer_id', 'business_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('customer_portal_tokens');
    }
};
