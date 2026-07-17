<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            $table->string('first_name')->nullable()->after('business_id');
            $table->string('last_name')->nullable()->after('first_name');
        });

        DB::table('customers')->select('id', 'name')->orderBy('id')->chunkById(100, function ($customers): void {
            foreach ($customers as $customer) {
                $name = trim((string) ($customer->name ?? ''));
                $parts = preg_split('/\s+/', $name) ?: [];
                $firstName = $parts[0] ?? 'Customer';
                $lastName = count($parts) > 1 ? implode(' ', array_slice($parts, 1)) : '-';

                DB::table('customers')
                    ->where('id', $customer->id)
                    ->update([
                        'first_name' => $firstName,
                        'last_name' => $lastName,
                    ]);
            }
        });

        Schema::table('customers', function (Blueprint $table): void {
            $table->string('first_name')->nullable(false)->change();
            $table->string('last_name')->nullable(false)->change();
            $table->dropColumn('name');
        });
    }

    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table): void {
            $table->string('name')->nullable()->after('business_id');
        });

        DB::table('customers')->select('id', 'first_name', 'last_name')->orderBy('id')->chunkById(100, function ($customers): void {
            foreach ($customers as $customer) {
                $name = trim(sprintf('%s %s', (string) $customer->first_name, (string) $customer->last_name));

                DB::table('customers')
                    ->where('id', $customer->id)
                    ->update([
                        'name' => $name !== '' ? $name : 'Customer',
                    ]);
            }
        });

        Schema::table('customers', function (Blueprint $table): void {
            $table->string('name')->nullable(false)->change();
            $table->dropColumn(['first_name', 'last_name']);
        });
    }
};
