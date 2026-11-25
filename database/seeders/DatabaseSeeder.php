<?php

namespace Database\Seeders;

use App\Models\Institution;
use App\Models\LedgerAccount;
use App\Models\User;
use App\Services\ProvisionInstitutionRoles;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            RolePermissionSeeder::class,
            PlanSeeder::class,
        ]);

        $platform = User::query()->firstOrCreate(
            ['email' => 'platform@campus.test'],
            [
                'name' => 'Platform Admin',
                'username' => 'platform',
                'password' => 'password',
                'is_active' => true,
            ],
        );
        setPermissionsTeamId((int) config('permission.platform_team_id'));
        $platform->assignRole('platform-super-admin');
        setPermissionsTeamId(null);

        $institution = Institution::query()->firstOrCreate(
            ['institution_code' => 'DEMO'],
            [
                'name' => 'Demo School',
                'type' => 'school',
                'status' => 'active',
                'currency' => 'NPR',
            ],
        );
        app(ProvisionInstitutionRoles::class)->handle($institution);

        foreach ([
            ['1000', 'Cash', 'asset'],
            ['1010', 'Bank', 'asset'],
            ['1100', 'Accounts receivable', 'asset'],
            ['4000', 'Fee income', 'income'],
            ['5000', 'Operating expense', 'expense'],
        ] as [$code, $name, $type]) {
            LedgerAccount::query()->firstOrCreate(
                ['institution_id' => $institution->getKey(), 'code' => $code],
                ['name' => $name, 'type' => $type],
            );
        }

        $administrator = User::query()->firstOrCreate(
            ['email' => 'school@campus.test'],
            [
                'name' => 'School Administrator',
                'username' => 'school',
                'password' => 'password',
                'institution_id' => $institution->getKey(),
                'is_active' => true,
            ],
        );
        setPermissionsTeamId($institution->getKey());
        $administrator->assignRole('institution-admin');
        setPermissionsTeamId(null);

        $accountant = User::query()->firstOrCreate(
            ['email' => 'accountant@campus.test'],
            [
                'name' => 'School Accountant',
                'username' => 'accountant',
                'password' => 'password',
                'institution_id' => $institution->getKey(),
                'is_active' => true,
            ],
        );
        setPermissionsTeamId($institution->getKey());
        $accountant->assignRole('accountant');
        setPermissionsTeamId(null);
    }
}
