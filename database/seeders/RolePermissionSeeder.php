<?php

namespace Database\Seeders;

use App\Models\Institution;
use App\Services\ProvisionInstitutionRoles;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        $provision = app(ProvisionInstitutionRoles::class);
        $names = array_merge(
            ['platform.access'],
            array_unique(array_merge(...array_values($provision->definitions()))),
        );

        foreach ($names as $permissionName) {
            Permission::firstOrCreate([
                'name' => $permissionName,
                'guard_name' => 'web',
            ]);
        }

        $this->ensurePlatformRoles();

        foreach (Institution::query()->cursor() as $institution) {
            $provision->handle($institution);
        }

        setPermissionsTeamId(null);
    }

    private function ensurePlatformRoles(): void
    {
        setPermissionsTeamId((int) config('permission.platform_team_id'));

        foreach ([
            'platform-super-admin' => ['platform.access'],
            'it-administrator' => ['platform.access'],
            'it-support-staff' => ['platform.access'],
        ] as $roleName => $permissions) {
            $role = Role::query()
                ->where('name', $roleName)
                ->where('guard_name', 'web')
                ->where('institution_id', (int) config('permission.platform_team_id'))
                ->first();

            if ($role === null) {
                $role = Role::create([
                    'name' => $roleName,
                    'guard_name' => 'web',
                    'institution_id' => (int) config('permission.platform_team_id'),
                ]);
            }

            $role->syncPermissions($permissions);
        }
    }
}
