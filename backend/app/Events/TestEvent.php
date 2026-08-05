<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TestEvent implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public readonly array $payload = [])
    {
    }

    public function broadcastOn(): Channel
    {
        // Public channel for isolated realtime testing.
        return new Channel('test-public');
    }

    public function broadcastAs(): string
    {
        return 'TestEvent';
    }
}
