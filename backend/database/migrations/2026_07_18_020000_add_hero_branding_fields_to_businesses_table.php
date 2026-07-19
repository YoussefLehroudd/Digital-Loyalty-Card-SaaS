<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->string('hero_image_url')->nullable()->after('logo_public_id');
            $table->string('hero_image_public_id')->nullable()->after('hero_image_url');
            $table->decimal('hero_image_zoom', 4, 2)->default(1.2)->after('hero_image_public_id');
            $table->decimal('hero_image_position_x', 5, 2)->default(0)->after('hero_image_zoom');
            $table->decimal('hero_image_position_y', 5, 2)->default(0)->after('hero_image_position_x');
        });
    }

    public function down(): void
    {
        Schema::table('businesses', function (Blueprint $table) {
            $table->dropColumn([
                'hero_image_url',
                'hero_image_public_id',
                'hero_image_zoom',
                'hero_image_position_x',
                'hero_image_position_y',
            ]);
        });
    }
};
