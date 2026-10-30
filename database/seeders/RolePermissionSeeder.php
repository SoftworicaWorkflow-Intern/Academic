<?php

namespace Database\Seeders;

use App\Models\Institution;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolePermissionSeeder extends Seeder
{
    public function run(): void
    {
        foreach (['platform.access', 'institution.access'] as $permissionName) {
            Permission::firstOrCreate([
                'name' => $permissionName,
                'guard_name' => 'web',
            ]);
        }

        $platformRoles = [
            'platform-super-admin' => ['platform.access'],
            'it-administrator' => ['platform.access'],
            'it-support-staff' => ['platform.access'],
        ];
        $institutionRoles = [
            'institution-admin' => ['institution.access'],
            'accountant' => ['institution.access'],
            'cashier' => ['institution.access'],
            'teacher' => ['institution.access'],
            'academic-staff' => ['institution.access'],
            'institution-staff' => ['institution.access'],
        ];

        $this->ensureRoles((int) config('permission.platform_team_id'), $platformRoles);

        foreach (Institution::query()->cursor() as $institution) {
            $this->ensureRoles($institution->getKey(), $institutionRoles);
        }

        setPermissionsTeamId(null);
    }

    /**
     * @param  array<string, list<string>>  $roles
     */
    private function ensureRoles(int $teamId, array $roles): void
    {
        setPermissionsTeamId($teamId);

        foreach ($roles as $roleName => $permissions) {
            $role = Role::query()
                ->where('name', $roleName)
                ->where('guard_name', 'web')
                ->where('institution_id', $teamId)
                ->first();

            if ($role === null) {
                $role = Role::create([
                    'name' => $roleName,
                    'guard_name' => 'web',
                    'institution_id' => $teamId,
                ]);
            }

            $role->syncPermissions($permissions);
        }
    }
}
