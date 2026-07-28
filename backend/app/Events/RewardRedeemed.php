<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class RewardRedeemed implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public readonly int $businessId,
        public readonly int $customerId,
        public readonly int $currentStamps,
        public readonly int $requiredStamps,
    ) {
    }

    public function broadcastOn(): array
    {
        return [
            new Channel("customer.{$this->customerId}"),
            new Channel("business.{$this->businessId}"),
        ];
    }

    public function broadcastAs(): string
    {
        return 'RewardRedeemed';
    }
}
