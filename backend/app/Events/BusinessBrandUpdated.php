<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class BusinessBrandUpdated implements ShouldBroadcast, ShouldQueue
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public string $broadcastQueue = 'default';

    public function __construct(
        public readonly int $businessId,
    ) {
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("business.{$this->businessId}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'BusinessBrandUpdated';
    }
}
