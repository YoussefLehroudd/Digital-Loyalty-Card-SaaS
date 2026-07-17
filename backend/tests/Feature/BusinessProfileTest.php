<?php

namespace Tests\Feature;

use App\Models\Business;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BusinessProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_business_owner_can_get_current_business_profile(): void
    {
        $business = Business::factory()->create([
            'name' => 'Star Coffee',
            'email' => 'hello@star.test',
            'primary_color' => '#123456',
        ]);
        $user = User::factory()->businessOwner($business)->create();

        Sanctum::actingAs($user);

        $this
            ->getJson('/api/business/profile')
            ->assertOk()
            ->assertJsonPath('business.id', (string) $business->id)
            ->assertJsonPath('business.name', 'Star Coffee')
            ->assertJsonPath('business.email', 'hello@star.test')
            ->assertJsonPath('business.primary_color', '#123456');
    }

    public function test_business_owner_can_update_only_their_business_profile(): void
    {
        $business = Business::factory()->create();
        $otherBusiness = Business::factory()->create([
            'name' => 'Other Tenant',
        ]);
        $user = User::factory()->businessOwner($business)->create();

        Sanctum::actingAs($user);

        $this
            ->patchJson('/api/business/profile', [
                'name' => 'Star Coffee Roasters',
                'email' => 'owner@star.test',
                'phone' => '+1 555 0100',
                'address' => '12 Market Street',
                'primary_color' => '#24A37A',
            ])
            ->assertOk()
            ->assertJsonPath('business.name', 'Star Coffee Roasters')
            ->assertJsonPath('business.primary_color', '#24A37A');

        $this->assertDatabaseHas('businesses', [
            'id' => $business->id,
            'name' => 'Star Coffee Roasters',
        ]);

        $this->assertDatabaseHas('businesses', [
            'id' => $otherBusiness->id,
            'name' => 'Other Tenant',
        ]);
    }

    public function test_business_profile_update_validates_primary_color(): void
    {
        $business = Business::factory()->create();
        $user = User::factory()->businessOwner($business)->create();

        Sanctum::actingAs($user);

        $this
            ->patchJson('/api/business/profile', [
                'name' => 'Star Coffee',
                'email' => 'hello@star.test',
                'primary_color' => 'green',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('primary_color');
    }

    public function test_business_owner_can_upload_logo_to_cloudinary(): void
    {
        Config::set('services.cloudinary.cloud_name', 'demo-cloud');
        Config::set('services.cloudinary.api_key', 'demo-key');
        Config::set('services.cloudinary.api_secret', 'demo-secret');
        Config::set('services.cloudinary.folder', 'digital-loyalty/test');

        Http::fake([
            'api.cloudinary.com/*' => Http::response([
                'secure_url' => 'https://res.cloudinary.com/demo/image/upload/logo.png',
                'public_id' => 'digital-loyalty/test/logo',
            ]),
        ]);

        $business = Business::factory()->create();
        $user = User::factory()->businessOwner($business)->create();

        Sanctum::actingAs($user);

        $this
            ->post('/api/business/profile/logo', [
                'logo' => $this->pngUpload(),
            ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJsonPath('business.logo_url', 'https://res.cloudinary.com/demo/image/upload/logo.png')
            ->assertJsonPath('business.logo_public_id', 'digital-loyalty/test/logo');

        $this->assertDatabaseHas('businesses', [
            'id' => $business->id,
            'logo_url' => 'https://res.cloudinary.com/demo/image/upload/logo.png',
            'logo_public_id' => 'digital-loyalty/test/logo',
        ]);
    }

    public function test_business_profile_routes_require_authentication(): void
    {
        $this->getJson('/api/business/profile')->assertUnauthorized();
        $this->patchJson('/api/business/profile')->assertUnauthorized();
        $this->postJson('/api/business/profile/logo')->assertUnauthorized();
    }

    private function pngUpload(): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'logo');

        file_put_contents(
            $path,
            base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=')
        );

        return new UploadedFile($path, 'logo.png', 'image/png', null, true);
    }
}
