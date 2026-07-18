<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class Phase7DiagMigrations extends Command
{
    protected $signature = 'phase7:diag-migrations';
    protected $description = 'Temporary diagnostics for Phase 7 migration/schema drift (read-only).';

    public function handle(): int
    {
        $migrations = [
            '2026_07_17_220000_create_visits_table',
            '2026_07_17_220100_create_reward_redemptions_table',
            '2026_07_18_000200_add_slug_to_businesses_table',
        ];

        $this->line('--- migrations table rows ---');
        foreach ($migrations as $migration) {
            $row = DB::table('migrations')->where('migration', $migration)->first();
            $this->line($migration . ' => ' . ($row ? ('batch=' . $row->batch) : 'NOT_PRESENT'));
        }

        $this->line('--- table existence (to_regclass) ---');
        $q = DB::select("select to_regclass('public.visits') as v");
        $this->line('public.visits => ' . ($q[0]->v ?? 'null'));

        $q = DB::select("select to_regclass('public.reward_redemptions') as r");
        $this->line('public.reward_redemptions => ' . ($q[0]->r ?? 'null'));

        $q = DB::select("select count(*) as c from information_schema.columns where table_name='businesses' and column_name='slug'");
        $this->line('businesses.slug column_exists_count => ' . ($q[0]->c ?? 'null'));

        return Command::SUCCESS;
    }
}
