<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('loyalty_cards', function (Blueprint $table) {
            $table->id();

            $table->foreignId('business_id')
                ->constrained()
                ->cascadeOnDelete();

            $table->string('reward_name');
            $table->unsignedInteger('required_stamps');
            $table->text('reward_description')->nullable();

            $table->timestamps();

            $table->unique('business_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('loyalty_cards');
    }
};
