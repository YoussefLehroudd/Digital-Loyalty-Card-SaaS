<?php

namespace App\Http\Controllers;

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

        return response()->json([
            'message' => 'Business profile updated successfully.',
            'business' => $this->serializeBusiness($business->refresh()),
        ]);
    }

    public function uploadLogo(
        UploadBusinessLogoRequest $request,
        CloudinaryService $cloudinary,
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

        $business->update([
            'logo_url' => $upload['secure_url'],
            'logo_public_id' => $upload['public_id'],
        ]);

        return response()->json([
            'message' => 'Business logo uploaded successfully.',
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
        ];
    }
}
