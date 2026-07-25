<?php

namespace App\Http\Controllers;

use App\Models\Business;
use App\Models\Customer;
use App\Models\LoyaltyCard;
use App\Models\RewardRedemption;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class BusinessRewardsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $business = $this->currentBusiness($request);

        $q = trim((string) $request->query('q', ''));
        $page = max(1, (int) $request->query('page', 1));
        $perPage = max(1, min(100, (int) $request->query('per_page', 10)));

        // status filter maps to RewardRedemption statuses.
        // - ready -> earned (not redeemed)
        // - redeemed -> redeemed
        $status = $request->query('status', null);
        $status = is_string($status) ? $status : null;

        $baseQuery = RewardRedemption::query()
            ->where('business_id', $business->id)
            ->orderBy('earned_at', 'desc');

        if ($q !== '') {
            $baseQuery->whereHas('customer', function ($innerQuery) use ($q): void {
                $innerQuery
                    ->where('business_id', $innerQuery->getModel()->business_id ?? null)
                    ->where(function ($nameQuery) use ($q): void {
                        $nameQuery
                            ->where('first_name', 'like', "%{$q}%")
                            ->orWhere('last_name', 'like', "%{$q}%")
                            ->orWhere('email', 'like', "%{$q}%")
                            ->orWhere('phone', 'like', "%{$q}%")
                            ->orWhereRaw("CONCAT(first_name, ' ', last_name) like ?", ["%{$q}%"]);
                    });
            });
        }

        if ($status === 'ready') {
            $baseQuery->where('status', 'earned')->whereNull('redeemed_at');
        } elseif ($status === 'redeemed') {
            $baseQuery->where('status', 'redeemed');
        }

        $summary = $this->computeRewardSummary($business->id);

        $paginator = $baseQuery->paginate($perPage, ['*'], 'page', $page);

        $data = $paginator->getCollection()->map(function (RewardRedemption $redemption) use ($business): array {
            $customer = $redemption->customer;

            $loyaltyCard = $customer?->loyalty()->first()
                ?->loyaltyCard;

            // Fallback: the reward name might also be accessible via loyalty card through loyalty relation.
            $rewardName = $loyaltyCard?->reward_name ?? null;

            $computedStatus = $this->computeRewardStatus($redemption);

            return [
                'customer' => $customer ? [
                    'id' => (string) $customer->id,
                    'first_name' => $customer->first_name,
                    'last_name' => $customer->last_name,
                    'email' => $customer->email,
                    'phone' => $customer->phone,
                    'qr_code' => $customer->qr_code,
                ] : null,
                'reward_name' => $rewardName,
                'earned_at' => $redemption->earned_at?->toISOString(),
                'redeemed_at' => $redemption->redeemed_at?->toISOString(),
                'status' => $computedStatus,
            ];
        });

        return response()->json([
            'data' => $data->values(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
            ],
            'summary' => $summary,
            'query' => [
                'q' => $q,
                'page' => $page,
                'per_page' => $perPage,
                'status' => $status,
            ],
        ]);
    }

    private function computeRewardStatus(RewardRedemption $redemption): string
    {
        // Status values required:
        // - ready: earned (not redeemed)
        // - redeemed: redeemed_at exists
        if ($redemption->status === 'redeemed' || $redemption->redeemed_at) {
            return 'redeemed';
        }

        return 'ready';
    }

    /**
     * @return array<string, mixed>
     */
    private function computeRewardSummary(int $businessId): array
    {
        $totalRewards = RewardRedemption::query()
            ->where('business_id', $businessId)
            ->count();

        $rewardsReady = RewardRedemption::query()
            ->where('business_id', $businessId)
            ->where('status', 'earned')
            ->whereNull('redeemed_at')
            ->count();

        $rewardsRedeemed = RewardRedemption::query()
            ->where('business_id', $businessId)
            ->where('status', 'redeemed')
            ->count();

        return [
            'total_rewards' => (int) $totalRewards,
            'rewards_ready' => (int) $rewardsReady,
            'rewards_redeemed' => (int) $rewardsRedeemed,
        ];
    }

    private function currentBusiness(Request $request): Business
    {
        $business = $request->user()->load('business')->business;

        if (! $business) {
            abort(Response::HTTP_FORBIDDEN, 'A business workspace is required.');
        }

        return $business;
    }
}
