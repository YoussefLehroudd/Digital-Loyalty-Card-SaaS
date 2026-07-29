<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CustomerCardsEventsController extends Controller
{
    public function events(Request $request)
    {
        $user = $request->user();

        if (! $user) {
            return response()->json([
                'message' => 'Unauthenticated.',
            ], 401);
        }

        $customerId = (int) $user->id;

        $cacheKey = "customer:{$customerId}:card.updated";

        return new StreamedResponse(function () use ($cacheKey): void {
            echo "event: connected\n";
            echo "data: {}\n\n";

            if (ob_get_level()) {
                ob_flush();
            }
            flush();

            $lastUpdatedAt = null;

            while (true) {
                $payload = Cache::get($cacheKey);

                if (is_array($payload)) {
                    $updatedAt = $payload['updated_at'] ?? null;

                    if ($updatedAt && $updatedAt !== $lastUpdatedAt) {
                        $lastUpdatedAt = $updatedAt;

                        echo "event: card.updated\n";
                        echo "data: " . json_encode($payload) . "\n\n";

                        if (ob_get_level()) {
                            ob_flush();
                        }
                        flush();
                    }
                }

                sleep(1);
            }
        }, 200, [
            'Content-Type' => 'text/event-stream',
            'Cache-Control' => 'no-cache, no-transform',
            'Connection' => 'keep-alive',
            'X-Accel-Buffering' => 'no',
        ]);
    }
}
