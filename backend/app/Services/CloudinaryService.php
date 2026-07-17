<?php

namespace App\Services;

use Illuminate\Http\Client\RequestException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class CloudinaryService
{
    /**
     * @return array{secure_url: string, public_id: string}
     *
     * @throws RequestException
     */
    public function uploadBusinessLogo(UploadedFile $file): array
    {
        $cloudName = config('services.cloudinary.cloud_name');
        $apiKey = config('services.cloudinary.api_key');
        $apiSecret = config('services.cloudinary.api_secret');
        $folder = config('services.cloudinary.folder');

        if (! $cloudName || ! $apiKey || ! $apiSecret) {
            throw new RuntimeException('Cloudinary credentials are not configured.');
        }

        $timestamp = time();
        $signature = $this->signature([
            'folder' => $folder,
            'timestamp' => $timestamp,
        ], $apiSecret);

        $response = Http::attach(
            'file',
            fopen($file->getRealPath(), 'r'),
            $file->getClientOriginalName()
        )->post("https://api.cloudinary.com/v1_1/{$cloudName}/image/upload", [
            'api_key' => $apiKey,
            'folder' => $folder,
            'timestamp' => $timestamp,
            'signature' => $signature,
        ])->throw()->json();

        return [
            'secure_url' => $response['secure_url'],
            'public_id' => $response['public_id'],
        ];
    }

    /**
     * @param  array<string, mixed>  $params
     */
    private function signature(array $params, string $apiSecret): string
    {
        ksort($params);

        $payload = collect($params)
            ->map(fn ($value, $key) => "{$key}={$value}")
            ->implode('&');

        return sha1($payload.$apiSecret);
    }
}
