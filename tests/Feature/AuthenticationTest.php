<?php

namespace Tests\Feature;

use App\Models\Institution;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
        $this->withHeader('Origin', (string) config('app.url'));
        $this->seed(RolePermissionSeeder::class);
    }

    public function test_root_route_displays_the_public_login_application(): void
    {
        $this->get('/')
            ->assertOk()
            ->assertSee('id="app"', false);
    }

    public function test_platform_user_signs_in_and_is_redirected_by_server_role(): void
    {
        $user = User::factory()->create([
            'email' => 'platform@example.test',
            'username' => 'platform-admin',
        ]);
        setPermissionsTeamId((int) config('permission.platform_team_id'));
        $user->assignRole('platform-super-admin');
        setPermissionsTeamId(null);

        $this->postJson('/api/login', [
            'login' => 'platform-admin',
            'password' => 'password',
            'remember' => true,
        ])
            ->assertOk()
            ->assertJsonPath('user.audience', 'platform')
            ->assertJsonPath('user.redirect_to', '/admin/dashboard')
            ->assertJsonPath('user.roles.0', 'platform-super-admin')
            ->assertJsonPath('user.permissions.0', 'platform.access')
            ->assertJsonPath('user.institution', null);

        $this->assertAuthenticatedAs($user);
    }

    public function test_institution_user_signs_in_with_their_institution_context(): void
    {
        $institution = Institution::query()->create([
            'name' => 'North Campus',
            'institution_code' => 'NC-001',
            'type' => 'school',
            'status' => 'active',
        ]);
        $user = $this->createInstitutionUser($institution);

        $this->postJson('/api/login', [
            'login' => $user->email,
            'password' => 'password',
        ])
            ->assertOk()
            ->assertJsonPath('user.audience', 'institution')
            ->assertJsonPath('user.redirect_to', '/dashboard')
            ->assertJsonPath('user.institution.id', $institution->id)
            ->assertJsonPath('user.institution.institution_code', 'NC-001');
    }

    public function test_login_rejects_invalid_credentials_without_disclosing_the_account(): void
    {
        $this->postJson('/api/login', [
            'login' => 'unknown@example.test',
            'password' => 'incorrect',
        ])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'The provided credentials are incorrect.')
            ->assertJsonValidationErrors('login');

        $this->assertGuest();
    }

    public function test_api_identity_requires_authentication(): void
    {
        $this->getJson('/api/user')->assertUnauthorized();
    }

    public function test_logout_invalidates_the_authenticated_session(): void
    {
        $user = User::factory()->create();
        setPermissionsTeamId((int) config('permission.platform_team_id'));
        $user->assignRole('platform-super-admin');
        setPermissionsTeamId(null);

        $this->postJson('/api/login', [
            'login' => $user->email,
            'password' => 'password',
        ])->assertOk();

        $this->postJson('/api/logout')->assertOk();
        $this->getJson('/api/user')->assertUnauthorized();
    }

    public function test_platform_dashboard_uses_live_database_counts(): void
    {
        Institution::query()->create([
            'name' => 'Active Campus',
            'institution_code' => 'ACT-001',
            'type' => 'school',
            'status' => 'active',
        ]);
        Institution::query()->create([
            'name' => 'Inactive Campus',
            'institution_code' => 'INACT-001',
            'type' => 'college',
            'status' => 'suspended',
        ]);
        $platformUser = User::factory()->create([
            'is_active' => true,
        ]);
        setPermissionsTeamId((int) config('permission.platform_team_id'));
        $platformUser->assignRole('platform-super-admin');
        setPermissionsTeamId(null);

        Sanctum::actingAs($platformUser);
        $this->withoutHeader('Origin');

        $this->getJson('/api/admin/dashboard')
            ->assertOk()
            ->assertJsonPath('data.institutions_total', 2)
            ->assertJsonPath('data.institutions_active', 1)
            ->assertJsonPath('data.users_total', 1)
            ->assertJsonPath('data.users_active', 1);
    }

    public function test_platform_user_can_open_the_platform_dashboard(): void
    {
        $platformUser = User::factory()->create([
            'is_active' => true,
        ]);
        setPermissionsTeamId((int) config('permission.platform_team_id'));
        $platformUser->assignRole('platform-super-admin');
        setPermissionsTeamId(null);

        $this->actingAs($platformUser)->get('/admin/dashboard')->assertOk();
    }

    public function test_institution_user_cannot_open_platform_routes(): void
    {
        $institution = Institution::query()->create([
            'name' => 'East Campus',
            'institution_code' => 'EC-001',
            'type' => 'college',
            'status' => 'active',
        ]);
        $institutionUser = $this->createInstitutionUser($institution);

        $this->actingAs($institutionUser)->get('/admin/dashboard')->assertForbidden();
    }

    public function test_platform_user_cannot_open_institution_routes(): void
    {
        $platformUser = User::factory()->create();
        setPermissionsTeamId((int) config('permission.platform_team_id'));
        $platformUser->assignRole('platform-super-admin');
        setPermissionsTeamId(null);

        $this->actingAs($platformUser)->get('/dashboard')->assertForbidden();
    }

    public function test_institution_dashboard_uses_authenticated_tenant_not_submitted_id(): void
    {
        $institution = Institution::query()->create([
            'name' => 'West Campus',
            'institution_code' => 'WC-001',
            'type' => 'school',
            'status' => 'active',
        ]);
        $otherInstitution = Institution::query()->create([
            'name' => 'South Campus',
            'institution_code' => 'SC-001',
            'type' => 'college',
            'status' => 'active',
        ]);
        $user = $this->createInstitutionUser($institution);

        Sanctum::actingAs($user);
        $this->withoutHeader('Origin');

        $this->getJson('/api/institution/dashboard?institution_id='.$otherInstitution->id)
            ->assertOk()
            ->assertJsonPath('data.institution.id', $institution->id)
            ->assertJsonPath('data.institution.name', 'West Campus');
    }

    public function test_inactive_institutions_cannot_access_their_workspace(): void
    {
        $institution = Institution::query()->create([
            'name' => 'Suspended Campus',
            'institution_code' => 'SUS-001',
            'type' => 'school',
            'status' => 'suspended',
        ]);
        $user = $this->createInstitutionUser($institution);

        $this->actingAs($user)->get('/dashboard')->assertForbidden();

        $this->postJson('/api/login', [
            'login' => $user->email,
            'password' => 'password',
        ])->assertForbidden();
    }

    private function createInstitutionUser(Institution $institution): User
    {
        $user = User::factory()->create([
            'institution_id' => $institution->id,
            'is_active' => true,
        ]);

        setPermissionsTeamId($institution->id);
        $role = Role::create([
            'name' => 'institution-admin',
            'guard_name' => 'web',
            'institution_id' => $institution->id,
        ]);
        $role->givePermissionTo('institution.access');
        $user->assignRole($role);
        setPermissionsTeamId(null);

        return $user;
    }
}
