<?php

namespace App\Http\Controllers;

use App\Http\Requests\Customer\CreateCustomerRequest;
use App\Models\Business;
use App\Models\Customer;
use App\Models\LoyaltyCard;
use App\Models\RewardRedemption;
use App\Models\Visit;
use App\Services\QrCodeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class BusinessCustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $business = $this->currentBusiness($request);

        $q = trim((string) $request->query('q', ''));
        $page = max(1, (int) $request->query('page', 1));
        $perPage = max(1, min(100, (int) $request->query('per_page', 10)));

        $baseQuery = Customer::query()
            ->where('business_id', $business->id);

        if ($q !== '') {
            $baseQuery->where(function ($innerQuery) use ($q): void {
                $innerQuery
                    ->where('first_name', 'like', "%{$q}%")
                    ->orWhere('last_name', 'like', "%{$q}%")
                    ->orWhere('email', 'like', "%{$q}%")
                    ->orWhere('phone', 'like', "%{$q}%")
                    ->orWhereRaw("CONCAT(first_name, ' ', last_name) like ?", ["%{$q}%"]);
            });
        }

        // Latest first (newest joined).
        $baseQuery->orderBy('created_at', 'desc');

        // Aggregate counts for summary (ignore pagination/search filters).
        $summary = $this->computeCustomerSummary($business->id);

        $paginator = $baseQuery->paginate($perPage, ['*'], 'page', $page);
        $customers = $paginator->getCollection();

        $customerIds = $customers->pluck('id')->values();

        // Fetch business-level loyalty card once.
        $loyaltyCard = \App\Models\LoyaltyCard::query()
            ->where('business_id', $business->id)
            ->first();

        $requiredStamps = (int) ($loyaltyCard?->required_stamps ?? 0);

        // Bulk aggregate visits count + last visit per customer (avoid N+1).
        $visitsAgg = [];
        if ($customerIds->isNotEmpty()) {
            $visitsAgg = Visit::query()
                ->select([
                    'customer_id',
                    DB::raw('COUNT(*) as total_visits'),
                    DB::raw('MAX(date) as last_visit'),
                ])
                ->where('business_id', $business->id)
                ->whereIn('customer_id', $customerIds)
                ->groupBy('customer_id')
                ->get()
                ->keyBy('customer_id')
                ->toArray();
        }

        // Bulk reward status per customer (avoid N+1).
        // We only need two checks:
        // - rewards_ready: earned with redeemed_at null
        // - redeemed: redeemed or redeemed_at set
        $rewardAgg = [];
        if ($customerIds->isNotEmpty()) {
            $rewardAgg = RewardRedemption::query()
                ->select(['customer_id', 'status', 'redeemed_at'])
                ->where('business_id', $business->id)
                ->whereIn('customer_id', $customerIds)
                ->get()
                ->groupBy('customer_id')
                ->map(function ($rows) {
                    $earnedReady = false;
                    $hasRedeemed = false;

                    foreach ($rows as $row) {
                        if ($row->status === 'earned' && empty($row->redeemed_at)) {
                            $earnedReady = true;
                        }

                        if ($row->status === 'redeemed' || ! empty($row->redeemed_at)) {
                            $hasRedeemed = true;
                            $hasRedeemed = true;
                        }
                    }

                    if ($earnedReady) {
                        return ['reward_status' => 'ready'];
                    }

                    if ($hasRedeemed ?? false) {
                        return ['reward_status' => 'redeemed'];
                    }

                    return ['reward_status' => 'collecting'];
                })
                ->toArray();
        }

        // Bulk fetch customer loyalty (customer-specific) to avoid N+1.
        $loyalties = [];
        if ($customerIds->isNotEmpty()) {
            $loyalties = \App\Models\CustomerLoyalty::query()
                ->whereIn('customer_id', $customerIds)
                ->get()
                ->keyBy('customer_id')
                ->toArray();
        }

        $data = $customers->map(function (Customer $customer) use ($requiredStamps, $visitsAgg, $rewardAgg, $loyalties): array {
            $loyalty = $loyalties[(string) $customer->id] ?? null;
            // CustomerLoyalty model fields used by the legacy code:
            $currentStamps = (int) (($loyalty['current_stamps'] ?? 0) ?? 0);

            $rewardStatus = $rewardAgg[(string) $customer->id]['reward_status']
                ?? 'collecting';

            $vis = $visitsAgg[(string) $customer->id] ?? null;
            $totalVisits = (int) ($vis['total_visits'] ?? 0);
            $lastVisit = $vis['last_visit'] ?? null;

            return [
                'id' => (string) $customer->id,
                'business_id' => (string) $customer->business_id,
                'first_name' => $customer->first_name,
                'last_name' => $customer->last_name,
                'email' => $customer->email,
                'phone' => $customer->phone,
                'qr_code' => $customer->qr_code,
                'joined_at' => optional($customer->created_at)->toISOString(),
                'current_stamps' => $currentStamps,
                'required_stamps' => $requiredStamps,
                'reward_status' => $rewardStatus,
                'total_visits' => $totalVisits,
                'last_visit' => $lastVisit ? optional($lastVisit)->toISOString() : null,
            ];
        });

        $payload = [
            // UI expects `data`
            'data' => $data->values(),
            // Existing backend tests expect `customers`
            'customers' => $data->values(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
                'q' => $q,
                'page' => $page,
                'per_page' => $perPage,
            ],
            'summary' => $summary,
            'query' => $q,
        ];

        return response()->json($payload);
    }

    public function search(Request $request): JsonResponse
    {
        // Keep endpoint compatible: it now delegates to `index()` with `q` support.
        return $this->index($request);
    }

    public function show(Request $request, string $customer): JsonResponse
    {
        $business = $this->currentBusiness($request);

        $customerRecord = Customer::query()
            ->where('business_id', $business->id)
            ->whereKey($customer)
            ->first();

        if (! $customerRecord) {
            return response()->json([
                'message' => 'Customer not found.',
            ], Response::HTTP_NOT_FOUND);
        }

        $loyalty = $customerRecord->loyalty()->first();
        $loyaltyCard = LoyaltyCard::query()
            ->where('business_id', $business->id)
            ->first();

        $requiredStamps = (int) ($loyaltyCard?->required_stamps ?? 0);
        $currentStamps = (int) ($loyalty?->current_stamps ?? 0);

        $totalVisits = $customerRecord->visits()
            ->where('business_id', $business->id)
            ->count();

        $lastVisit = $customerRecord->visits()
            ->where('business_id', $business->id)
            ->orderBy('date', 'desc')
            ->value('date');

        // Reward history
        $rewardRedemptions = RewardRedemption::query()
            ->where('business_id', $business->id)
            ->where('customer_id', $customerRecord->id)
            ->orderBy('earned_at', 'desc')
            ->get(['id', 'status', 'earned_at', 'redeemed_at']);

        $rewardHistory = $rewardRedemptions->map(function (RewardRedemption $r): array {
            $computed = 'collecting';

            if ($r->status === 'redeemed' || $r->redeemed_at) {
                $computed = 'redeemed';
            } elseif ($r->status === 'earned') {
                $computed = 'ready';
            }

            return [
                'id' => (string) $r->id,
                'reward_name' => $r->customer?->loyalty?->loyaltyCard?->reward_name,
                'earned_at' => $r->earned_at?->toISOString(),
                'redeemed_at' => $r->redeemed_at?->toISOString(),
                'status' => $computed,
            ];
        })->values();

        // Current reward status from most recent redemption
        $rewardStatus = 'collecting';
        $latestRedemption = $rewardRedemptions->first();

        if ($latestRedemption) {
            if ($latestRedemption->status === 'redeemed' || $latestRedemption->redeemed_at) {
                $rewardStatus = 'redeemed';
            } elseif ($latestRedemption->status === 'earned') {
                $rewardStatus = 'ready';
            }
        }

        // Visit history
        $visits = $customerRecord->visits()
            ->where('business_id', $business->id)
            ->orderBy('date', 'desc')
            ->get(['id', 'date']);

        $visitHistory = $visits->map(function ($v): array {
            return [
                'id' => (string) $v->id,
                'date' => $v->date?->toISOString(),
            ];
        })->values();

        return response()->json([
            'customer' => [
                ...$this->serializeCustomer($customerRecord),
                'current_stamps' => $currentStamps,
                'required_stamps' => $requiredStamps,
                'reward_status' => $rewardStatus,
                'total_visits' => (int) $totalVisits,
                'last_visit' => $lastVisit ? optional($lastVisit)->toISOString() : null,
                'visit_history' => $visitHistory,
                'reward_history' => $rewardHistory,
            ],
        ]);
    }

    public function store(CreateCustomerRequest $request, QrCodeService $qrCodeService): JsonResponse
    {
        $business = $this->currentBusiness($request);

        $customer = Customer::query()->create([
            ...$request->validated(),
            'business_id' => $business->id,
            'qr_code' => $qrCodeService->generateUniqueCustomerQrCode(),
        ]);

        return response()->json([
            'message' => 'Customer created successfully.',
            'customer' => $this->serializeCustomer($customer),
        ], Response::HTTP_CREATED);
    }

    public function destroy(Request $request, string $customer): JsonResponse
    {
        $business = $this->currentBusiness($request);

        $customerRecord = Customer::query()
            ->where('business_id', $business->id)
            ->whereKey($customer)
            ->first();

        if (! $customerRecord) {
            return response()->json([
                'message' => 'Customer not found.',
            ], Response::HTTP_NOT_FOUND);
        }

        $customerRecord->delete();

        return response()->json([], Response::HTTP_NO_CONTENT);
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
    private function computeCustomerSummary(int $businessId): array
    {
        $activeSince = now()->subDays(30);

        $totalCustomers = Customer::query()
            ->where('business_id', $businessId)
            ->count();

        $activeCustomers = Customer::query()
            ->where('business_id', $businessId)
            ->whereHas('visits', function ($query) use ($businessId, $activeSince): void {
                $query->where('business_id', $businessId)
                    ->where('date', '>=', $activeSince);
            })
            ->count();

        // Rewards ready: there exists an earned reward not yet redeemed.
        $rewardsReady = Customer::query()
            ->where('business_id', $businessId)
            ->whereHas('rewardRedemptions', function ($query) use ($businessId): void {
                $query->where('business_id', $businessId)
                    ->where('status', 'earned')
                    ->whereNull('redeemed_at');
            })
            ->count();

        return [
            'total_customers' => (int) $totalCustomers,
            'active_customers' => (int) $activeCustomers,
            'rewards_ready' => (int) $rewardsReady,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeCustomerWithLoyaltyAndVisits(Customer $customer, int $businessId): array
    {
        $loyalty = $customer->loyalty()->first();

        $loyaltyCard = \App\Models\LoyaltyCard::query()
            ->where('business_id', $businessId)
            ->first();

        $requiredStamps = (int) ($loyaltyCard?->required_stamps ?? 0);
        $currentStamps = (int) ($loyalty?->current_stamps ?? 0);

        $rewardStatus = 'collecting';

        $earnedReward = RewardRedemption::query()
            ->where('business_id', $businessId)
            ->where('customer_id', $customer->id)
            ->where('status', 'earned')
            ->whereNull('redeemed_at')
            ->exists();

        if ($earnedReward) {
            $rewardStatus = 'ready';
        } else {
            $redeemedReward = RewardRedemption::query()
                ->where('business_id', $businessId)
                ->where('customer_id', $customer->id)
                ->where('status', 'redeemed')
                ->exists();

            if ($redeemedReward) {
                $rewardStatus = 'redeemed';
            }
        }

        $totalVisits = $customer->visits()
            ->where('business_id', $businessId)
            ->count();

        $lastVisit = $customer->visits()
            ->where('business_id', $businessId)
            ->orderBy('date', 'desc')
            ->value('date');

        return [
            'id' => (string) $customer->id,
            'business_id' => (string) $customer->business_id,
            'first_name' => $customer->first_name,
            'last_name' => $customer->last_name,
            'email' => $customer->email,
            'phone' => $customer->phone,
            'qr_code' => $customer->qr_code,
            'joined_at' => optional($customer->created_at)->toISOString(),
            'current_stamps' => $currentStamps,
            'required_stamps' => $requiredStamps,
            'reward_status' => $rewardStatus,
            'total_visits' => (int) $totalVisits,
            'last_visit' => $lastVisit ? optional($lastVisit)->toISOString() : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeCustomer(Customer $customer): array
    {
        return [
            'id' => (string) $customer->id,
            'business_id' => (string) $customer->business_id,
            'first_name' => $customer->first_name,
            'last_name' => $customer->last_name,
            'email' => $customer->email,
            'phone' => $customer->phone,
            'qr_code' => $customer->qr_code,
            'created_at' => optional($customer->created_at)->toISOString(),
            'updated_at' => optional($customer->updated_at)->toISOString(),
        ];
    }
}
