<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CustomerCardsEventsController extends Controller
{
    public function events(Request $request): StreamedResponse
    {
        $customerId = (int) $request->user()->id;

        // Cache key: store latest payload + updated_at marker
        // payload shape:
        // { card_id, customer_id, updated_at }
        $cacheKey = "customer:{$customerId}:card.updated";

        $headers = [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache, no-transform',
            'X-Accel-Buffering' => 'no',
        ];

        $intervalSeconds = 1; // server-side polling interval

        return new StreamedResponse(function () use ($cacheKey, $intervalSeconds): void {
            // SSE "handshake"
            echo "event: connected\n";
            echo "data: {}\n\n";
            @ob_flush();
            @flush();

            $lastUpdatedAt = null;

            while (true) {
                $payload = Cache::get($cacheKey);

                $updatedAt = is_array($payload) ? ($payload['updated_at'] ?? null) : null;

                if ($updatedAt && $updatedAt !== $lastUpdatedAt) {
                    $lastUpdatedAt = $updatedAt;

                    $data = is_array($payload) ? $payload : [];

                    // SSE event
                    echo "event: card.updated\n";
                    echo 'data: ' . json_encode($data, JSON_UNESCAPED_SLASHES) . "\n\n";

                    @ob_flush();
                    @flush();
                }

                // Avoid busy loop
                sleep($intervalSeconds);
            }
        }, 200, $headers);
    }
}
