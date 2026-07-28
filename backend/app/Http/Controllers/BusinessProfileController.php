<?php

namespace App\Http\Controllers;

use App\Events\BusinessBrandUpdated;
use App\Http\Requests\Business\UpdateBusinessProfileRequest;
use App\Http\Requests\Business\UploadBusinessLogoRequest;
use App\Models\Business;
use App\Services\CloudinaryService;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;

class BusinessProfileController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        return response()->json([
            'business' => $this->serializeBusiness($this->currentBusiness($request)),
        ]);
    }

    public function update(UpdateBusinessProfileRequest $request): JsonResponse
    {
        $business = $this->currentBusiness($request);
        $business->update($request->validated());

        event(new BusinessBrandUpdated(
            businessId: (int) $business->id,
        ));

        return response()->json([
            'message' => 'Business profile updated successfully.',
            'business' => $this->serializeBusiness($business->refresh()),
        ]);
    }

    public function uploadLogo(
        UploadBusinessLogoRequest $request,
        CloudinaryService $cloudinary,
    ): JsonResponse {
        return $this->uploadImage($request, $cloudinary, 'logo');
    }

    public function uploadHeroImage(
        UploadBusinessLogoRequest $request,
        CloudinaryService $cloudinary,
    ): JsonResponse {
        return $this->uploadImage($request, $cloudinary, 'hero');
    }

    private function uploadImage(
        UploadBusinessLogoRequest $request,
        CloudinaryService $cloudinary,
        string $type,
    ): JsonResponse {
        $business = $this->currentBusiness($request);

        try {
            $upload = $cloudinary->uploadBusinessLogo($request->file('logo'));
        } catch (RuntimeException $exception) {
            report($exception);

            return response()->json([
                'message' => 'Logo upload is not configured.',
            ], Response::HTTP_SERVICE_UNAVAILABLE);
        } catch (RequestException $exception) {
            report($exception);

            return response()->json([
                'message' => 'Logo upload failed. Please try again.',
            ], Response::HTTP_BAD_GATEWAY);
        }

        if ($type === 'hero') {
            $business->update([
                'hero_image_url' => $upload['secure_url'],
                'hero_image_public_id' => $upload['public_id'],
            ]);

            event(new BusinessBrandUpdated(
                businessId: (int) $business->id,
            ));

            return response()->json([
                'message' => 'Business hero image uploaded successfully.',
                'secure_url' => $upload['secure_url'],
                'public_id' => $upload['public_id'],
                'business' => $this->serializeBusiness($business->refresh()),
            ]);
        }

        $business->update([
            'logo_url' => $upload['secure_url'],
            'logo_public_id' => $upload['public_id'],
        ]);

        event(new BusinessBrandUpdated(
            businessId: (int) $business->id,
        ));

        return response()->json([
            'message' => 'Business logo uploaded successfully.',
            'secure_url' => $upload['secure_url'],
            'public_id' => $upload['public_id'],
            'business' => $this->serializeBusiness($business->refresh()),
        ]);
    }

    private function currentBusiness(Request $request): Business
    {
        $business = $request->user()->load('business')->business;

        if (! $business) {
            abort(Response::HTTP_FORBIDDEN, 'A business workspace is required.');
        }

        return $business;
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeBusiness(Business $business): array
    {
        return [
            'id' => (string) $business->id,
            'name' => $business->name,
            'email' => $business->email,
            'logo_url' => $business->logo_url,
            'logo_public_id' => $business->logo_public_id,
            'primary_color' => $business->primary_color,
            'phone' => $business->phone,
            'address' => $business->address,
            'hero_image_url' => $business->hero_image_url,
            'hero_image_public_id' => $business->hero_image_public_id,
            'hero_image_zoom' => $business->hero_image_zoom,
            'hero_image_position_x' => $business->hero_image_position_x,
            'hero_image_position_y' => $business->hero_image_position_y,
        ];
    }
}
