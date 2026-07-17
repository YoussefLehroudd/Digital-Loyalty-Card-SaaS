<?php

namespace App\Http\Controllers;

use App\Http\Requests\Customer\CreateCustomerRequest;
use App\Models\Business;
use App\Models\Customer;
use App\Services\QrCodeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class BusinessCustomerController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $business = $this->currentBusiness($request);

        $customers = Customer::query()
            ->where('business_id', $business->id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'customers' => $customers->map(fn (Customer $customer) => $this->serializeCustomer($customer))->values(),
        ]);
    }

    public function search(Request $request): JsonResponse
    {
        $business = $this->currentBusiness($request);
        $term = trim((string) $request->query('q', ''));

        $customers = Customer::query()
            ->where('business_id', $business->id)
            ->when($term !== '', function ($query) use ($term): void {
                $query->where(function ($innerQuery) use ($term): void {
                    $innerQuery
                        ->where('first_name', 'like', "%{$term}%")
                        ->orWhere('last_name', 'like', "%{$term}%")
                        ->orWhere('email', 'like', "%{$term}%")
                        ->orWhere('phone', 'like', "%{$term}%")
                        ->orWhereRaw("CONCAT(first_name, ' ', last_name) like ?", ["%{$term}%"]);
                });
            })
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'customers' => $customers->map(fn (Customer $customer) => $this->serializeCustomer($customer))->values(),
            'query' => $term,
        ]);
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

        return response()->json([
            'customer' => $this->serializeCustomer($customerRecord),
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
