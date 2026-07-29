<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class StampAdded implements ShouldBroadcast, ShouldQueue
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * Optional: ensure broadcasting uses the queue workers queue if configured.
     */
    public string $broadcastQueue = 'default';

    public function __construct(
        public readonly int $businessId,
        public readonly int $customerId,
        public readonly int $currentStamps,
        public readonly int $requiredStamps,
        public readonly bool $rewardUnlocked,
    ) {
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("customer.{$this->customerId}"),
            new PrivateChannel("business.{$this->businessId}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'StampAdded';
    }
}
