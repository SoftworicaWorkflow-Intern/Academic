<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\Institution;
use App\Models\InstitutionModule;
use App\Models\InstitutionSetting;
use App\Models\LedgerAccount;
use App\Models\Subscription;
use App\Models\SubscriptionPlan;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CreateInstitution
{
    public function __construct(private ProvisionInstitutionRoles $roles) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(array $data, ?User $actor): Institution
    {
        return DB::transaction(function () use ($data, $actor): Institution {
            $plan = SubscriptionPlan::query()->findOrFail($data['subscription_plan_id']);
            $modules = $data['modules'] ?? $plan->modules;

            $institution = Institution::query()->create([
                'name' => $data['name'],
                'institution_code' => $this->code(),
                'type' => $data['type'],
                'registration_number' => $data['registration_number'] ?? null,
                'email' => $data['email'] ?? null,
                'phone' => $data['phone'] ?? null,
                'website' => $data['website'] ?? null,
                'province' => $data['province'] ?? null,
                'district' => $data['district'] ?? null,
                'municipality' => $data['municipality'] ?? null,
                'ward' => $data['ward'] ?? null,
                'address' => $data['address'] ?? null,
                'currency' => 'NPR',
                'status' => $data['status'] ?? 'active',
            ]);

            InstitutionSetting::query()->create([
                'institution_id' => $institution->getKey(),
                'currency' => 'NPR',
                'timezone' => 'Asia/Kathmandu',
            ]);

            foreach ($modules as $module) {
                InstitutionModule::query()->create([
                    'institution_id' => $institution->getKey(),
                    'module' => $module,
                    'enabled' => true,
                ]);
            }

            Subscription::query()->create([
                'institution_id' => $institution->getKey(),
                'subscription_plan_id' => $plan->getKey(),
                'starts_on' => $data['starts_on'],
                'expires_on' => $data['expires_on'],
                'status' => 'active',
                'price_monthly' => $plan->price_monthly,
            ]);

            foreach ([
                ['1000', 'Cash', 'asset'],
                ['1010', 'Bank', 'asset'],
                ['1100', 'Accounts receivable', 'asset'],
                ['4000', 'Fee income', 'income'],
                ['5000', 'Operating expense', 'expense'],
            ] as [$code, $name, $type]) {
                LedgerAccount::query()->create([
                    'institution_id' => $institution->getKey(),
                    'code' => $code,
                    'name' => $name,
                    'type' => $type,
                ]);
            }

            foreach ([['Cash', 'cash'], ['Bank transfer', 'bank'], ['Digital payment', 'online']] as [$name, $code]) {
                \App\Models\PaymentMethod::query()->create([
                    'institution_id' => $institution->getKey(),
                    'name' => $name,
                    'code' => $code,
                    'enabled' => true,
                ]);
            }

            $this->roles->handle($institution);

            $admin = User::query()->create([
                'name' => $data['admin_name'],
                'username' => $this->username($data['admin_email']),
                'email' => Str::lower($data['admin_email']),
                'password' => $data['admin_password'],
                'institution_id' => $institution->getKey(),
                'is_active' => true,
            ]);

            $previousTeamId = getPermissionsTeamId();
            setPermissionsTeamId($institution->getKey());
            $admin->assignRole('institution-admin');
            setPermissionsTeamId($previousTeamId);

            AuditLog::query()->create([
                'institution_id' => $institution->getKey(),
                'user_id' => $actor?->getKey(),
                'action' => 'institution.created',
                'subject_type' => Institution::class,
                'subject_id' => $institution->getKey(),
                'metadata' => ['code' => $institution->institution_code],
            ]);

            return $institution->load(['modules', 'subscriptions.plan', 'settings']);
        });
    }

    private function code(): string
    {
        do {
            $code = 'INS-'.Str::upper(Str::random(6));
        } while (Institution::query()->where('institution_code', $code)->exists());

        return $code;
    }

    private function username(string $email): string
    {
        $base = Str::slug(Str::before($email, '@'), '_');
        $username = $base !== '' ? $base : 'admin';
        $candidate = $username;
        $suffix = 1;

        while (User::query()->where('username', $candidate)->exists()) {
            $candidate = $username.'_'.$suffix;
            $suffix++;
        }

        return $candidate;
    }
}
