<?php

namespace App\Services;

use App\Models\Institution;
use Spatie\Permission\Models\Role;

class ProvisionInstitutionRoles
{
    /**
     * @return array<string, list<string>>
     */
    public function definitions(): array
    {
        return [
            'institution-admin' => [
                'institution.access',
                'students.manage',
                'teachers.manage',
                'staff.manage',
                'staff.salary.view',
                'academics.manage',
                'attendance.manage',
                'finance.manage',
                'finance.collect',
                'notices.manage',
                'marks.enter',
                'marks.publish',
            ],
            'accountant' => ['institution.access', 'finance.manage', 'finance.collect', 'staff.salary.view'],
            'cashier' => ['institution.access', 'finance.collect'],
            'teacher' => ['institution.access', 'attendance.manage', 'students.manage', 'marks.enter'],
            'academic-staff' => ['institution.access', 'academics.manage', 'students.manage', 'staff.manage', 'attendance.manage', 'marks.enter', 'marks.publish'],
            'institution-staff' => ['institution.access'],
        ];
    }

    public function handle(Institution $institution): void
    {
        $previousTeamId = getPermissionsTeamId();
        setPermissionsTeamId($institution->getKey());

        try {
            foreach ($this->definitions() as $roleName => $permissions) {
                $role = Role::query()
                    ->where('name', $roleName)
                    ->where('guard_name', 'web')
                    ->where('institution_id', $institution->getKey())
                    ->first();

                if ($role === null) {
                    $role = Role::create([
                        'name' => $roleName,
                        'guard_name' => 'web',
                        'institution_id' => $institution->getKey(),
                    ]);
                }

                $role->syncPermissions($permissions);
            }
        } finally {
            setPermissionsTeamId($previousTeamId);
        }
    }
}
