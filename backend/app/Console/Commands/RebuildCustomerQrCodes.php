<?php

namespace App\Console\Commands;

use App\Models\Customer;
use App\Services\QrCodeService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class RebuildCustomerQrCodes extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:rebuild-customer-qr-codes {--chunk=500}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Regenerate customer qr_code values to a unique business-bound format.';

    public function __construct(
        private readonly QrCodeService $qrCodeService
    ) {
        parent::__construct();
    }

    public function handle(): int
    {
        $chunkSize = (int) $this->option('chunk');
        if ($chunkSize <= 0) {
            $chunkSize = 500;
        }

        $total = Customer::query()->count();

        if ($total === 0) {
            $this->info('No customers found.');
            return self::SUCCESS;
        }

        $this->info('Regenerating qr_code for ' . $total . ' customers...');

        Customer::query()
            ->orderBy('id')
            ->chunkById($chunkSize, function ($customers): void {
                DB::transaction(function () use ($customers): void {
                    foreach ($customers as $customer) {
                        $businessId = (int) $customer->business_id;

                        if ($businessId <= 0) {
                            continue;
                        }

                        $customer->qr_code = $this->qrCodeService
                            ->generateBusinessBoundCustomerQrCode($businessId);

                        $customer->save();
                    }
                });
            });

        $this->info('Done.');

        return self::SUCCESS;
    }
}
