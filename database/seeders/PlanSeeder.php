<?php

namespace Database\Seeders;

use App\Models\SubscriptionPlan;
use Illuminate\Database\Seeder;

class PlanSeeder extends Seeder
{
    public function run(): void
    {
        $plans = [
            ['name' => 'Campus', 'code' => 'campus', 'price_monthly' => 8000, 'modules' => ['students', 'teachers', 'academics', 'attendance', 'notices']],
            ['name' => 'Academic Plus', 'code' => 'academic-plus', 'price_monthly' => 15000, 'modules' => ['students', 'teachers', 'academics', 'attendance', 'examinations', 'finance', 'notices']],
        ];

        foreach ($plans as $plan) {
            SubscriptionPlan::query()->updateOrCreate(
                ['code' => $plan['code']],
                $plan + ['currency' => 'NPR', 'is_active' => true],
            );
        }
    }
}
