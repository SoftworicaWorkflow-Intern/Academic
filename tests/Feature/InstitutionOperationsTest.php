<?php

namespace Tests\Feature;

use App\Models\Institution;
use App\Models\Invoice;
use App\Models\JournalLine;
use App\Models\Student;
use App\Models\SubscriptionPlan;
use App\Models\User;
use App\Services\ProvisionInstitutionRoles;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class InstitutionOperationsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
        $this->withoutHeader('Origin');
    }

    public function test_platform_admin_creates_an_institution_and_its_administrator(): void
    {
        $plan = SubscriptionPlan::query()->create([
            'name' => 'Campus',
            'code' => 'campus',
            'price_monthly' => 8000,
            'currency' => 'NPR',
            'modules' => ['students', 'finance'],
            'is_active' => true,
        ]);
        $platform = User::factory()->create(['is_active' => true]);
        setPermissionsTeamId((int) config('permission.platform_team_id'));
        $platform->assignRole('platform-super-admin');
        setPermissionsTeamId(null);
        Sanctum::actingAs($platform);

        $response = $this->postJson('/api/admin/institutions', [
            'name' => 'Lakeside School',
            'type' => 'school',
            'admin_name' => 'Asha Admin',
            'admin_email' => 'asha@lakeside.test',
            'admin_password' => 'password1',
            'subscription_plan_id' => $plan->id,
            'starts_on' => '2026-01-01',
            'expires_on' => '2026-12-31',
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.name', 'Lakeside School');

        $this->assertDatabaseHas('users', [
            'email' => 'asha@lakeside.test',
            'institution_id' => $response->json('data.id'),
        ]);
        $this->assertDatabaseHas('ledger_accounts', [
            'institution_id' => $response->json('data.id'),
            'code' => '1000',
        ]);
    }

    public function test_students_and_payments_stay_inside_the_institution(): void
    {
        $first = $this->campus('North');
        $second = $this->campus('South');

        Sanctum::actingAs($first['user']);
        $this->postJson('/api/institution/students', [
            'first_name' => 'Maya',
            'last_name' => 'Shrestha',
            'admission_number' => 'A-1',
        ])->assertCreated();

        $student = Student::query()->firstOrFail();
        $this->postJson('/api/institution/invoices', [
            'student_id' => $student->id,
            'amount' => 5000,
            'issued_on' => '2026-04-01',
            'due_on' => '2026-04-15',
        ])->assertCreated();

        $invoice = Invoice::query()->firstOrFail();
        $this->postJson('/api/institution/invoices/'.$invoice->id.'/payments', [
            'amount' => 2000,
            'paid_on' => '2026-04-02',
            'method' => 'cash',
        ])->assertCreated();

        $this->assertSame(2000, $invoice->fresh()->paid_amount);
        $this->assertSame(7000, (int) JournalLine::query()->sum('debit'));
        $this->assertSame(7000, (int) JournalLine::query()->sum('credit'));

        Sanctum::actingAs($second['user']);
        $this->getJson('/api/institution/students')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/institution/students/'.$student->id)->assertNotFound();
    }

    /**
     * @return array{user: User, institution: Institution}
     */
    private function campus(string $name): array
    {
        $institution = Institution::query()->create([
            'name' => $name,
            'institution_code' => strtoupper($name),
            'type' => 'school',
            'status' => 'active',
        ]);
        app(ProvisionInstitutionRoles::class)->handle($institution);

        foreach ([
            ['1000', 'Cash', 'asset'],
            ['1100', 'Accounts receivable', 'asset'],
            ['4000', 'Fee income', 'income'],
        ] as [$code, $account, $type]) {
            \App\Models\LedgerAccount::query()->create([
                'institution_id' => $institution->id,
                'code' => $code,
                'name' => $account,
                'type' => $type,
            ]);
        }

        $user = User::factory()->create([
            'institution_id' => $institution->id,
            'is_active' => true,
        ]);
        $user->refresh();
        setPermissionsTeamId($institution->id);
        $user->assignRole('institution-admin');
        setPermissionsTeamId(null);

        return ['user' => $user, 'institution' => $institution];
    }
}
