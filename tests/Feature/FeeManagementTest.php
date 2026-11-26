<?php

namespace Tests\Feature;

use App\Models\AcademicSession;
use App\Models\FeeCategory;
use App\Models\FeeStructure;
use App\Models\Institution;
use App\Models\LedgerAccount;
use App\Models\PaymentMethod;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\User;
use App\Services\ProvisionInstitutionRoles;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FeeManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
        $this->withHeader('Origin', (string) config('app.url'));
        $this->seed(RolePermissionSeeder::class);
    }

    public function test_fee_summary_returns_metrics_for_institution(): void
    {
        $institution = $this->createInstitution('Greenwood High', 'GWH-101');
        $user = $this->createAdminUser($institution);
        Sanctum::actingAs($user);

        $this->getJson('/api/institution/fee-summary')
            ->assertOk()
            ->assertJsonPath('data.total_categories', 0)
            ->assertJsonPath('data.active_fee_structures', 0)
            ->assertJsonPath('data.currency', 'NPR');
    }

    public function test_fee_category_crud_operations_with_multi_tenant_isolation(): void
    {
        $instA = $this->createInstitution('School A', 'SCH-A');
        $userA = $this->createAdminUser($instA);

        $instB = $this->createInstitution('School B', 'SCH-B');
        $userB = $this->createAdminUser($instB);

        // 1. User A creates Tuition fee category
        Sanctum::actingAs($userA);
        $createRes = $this->postJson('/api/institution/fee-categories', [
            'name' => 'Monthly Tuition Fee',
            'code' => 'TUITION',
            'kind' => 'tuition',
            'billing_type' => 'recurring',
            'default_amount' => 4500,
            'fine_amount' => 150,
            'due_day' => 10,
            'description' => 'Standard monthly schooling fee',
            'is_active' => true,
        ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Monthly Tuition Fee')
            ->assertJsonPath('data.code', 'TUITION')
            ->assertJsonPath('data.default_amount', 4500);

        $categoryId = $createRes->json('data.id');

        // 2. User A lists categories and finds it
        $this->getJson('/api/institution/fee-categories')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.code', 'TUITION');

        // 3. User B cannot see User A's category
        Sanctum::actingAs($userB);
        $this->getJson('/api/institution/fee-categories')
            ->assertOk()
            ->assertJsonCount(0, 'data');

        // User B cannot update User A's category
        $this->patchJson("/api/institution/fee-categories/{$categoryId}", [
            'name' => 'Hacked Name',
            'code' => 'HACK',
            'kind' => 'tuition',
            'billing_type' => 'recurring',
            'default_amount' => 100,
        ])->assertNotFound();

        // 4. User A updates the category
        Sanctum::actingAs($userA);
        $this->patchJson("/api/institution/fee-categories/{$categoryId}", [
            'name' => 'Monthly Tuition (Revised)',
            'code' => 'TUITION',
            'kind' => 'tuition',
            'billing_type' => 'recurring',
            'default_amount' => 5000,
            'fine_amount' => 200,
            'due_day' => 12,
            'description' => 'Updated terms',
            'is_active' => true,
        ])
            ->assertOk()
            ->assertJsonPath('data.default_amount', 5000)
            ->assertJsonPath('data.name', 'Monthly Tuition (Revised)');

        // 5. User A deletes the category
        $this->deleteJson("/api/institution/fee-categories/{$categoryId}")
            ->assertOk();

        $this->assertDatabaseMissing('fee_categories', ['id' => $categoryId]);
    }

    public function test_fee_structure_creation_assignment_and_validation(): void
    {
        $institution = $this->createInstitution('Alpine Academy', 'ALP-01');
        $user = $this->createAdminUser($institution);
        Sanctum::actingAs($user);

        // Setup session, class, section, category
        $session = AcademicSession::query()->create([
            'institution_id' => $institution->id,
            'name' => '2026/2027 Academic Year',
            'code' => '2026-27',
            'starts_on' => '2026-04-01',
            'ends_on' => '2027-03-31',
            'status' => 'active',
            'is_current' => true,
        ]);

        $class = SchoolClass::query()->create([
            'institution_id' => $institution->id,
            'name' => 'Grade 10',
            'code' => 'G10',
        ]);

        $sectionA = Section::query()->create([
            'institution_id' => $institution->id,
            'school_class_id' => $class->id,
            'name' => 'A',
        ]);

        $category = FeeCategory::query()->create([
            'institution_id' => $institution->id,
            'name' => 'Computer Lab Fee',
            'code' => 'COMP_LAB',
            'kind' => 'computer_lab',
            'billing_type' => 'recurring',
            'default_amount' => 1200,
            'is_active' => true,
        ]);

        // Create fee structure with optional flag and quarterly schedule
        $res = $this->postJson('/api/institution/fee-structures', [
            'name' => 'Grade 10 Practical Lab Fee',
            'amount' => 1200,
            'fee_category_id' => $category->id,
            'academic_session_id' => $session->id,
            'school_class_id' => $class->id,
            'section_id' => $sectionA->id,
            'fee_type' => 'optional',
            'payment_schedule' => 'quarterly',
            'due_day' => 15,
            'description' => 'Optional advanced robotics and lab access',
            'is_active' => true,
        ])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Grade 10 Practical Lab Fee')
            ->assertJsonPath('data.fee_type', 'optional')
            ->assertJsonPath('data.payment_schedule', 'quarterly')
            ->assertJsonPath('data.amount', 1200)
            ->assertJsonPath('data.school_class.name', 'Grade 10')
            ->assertJsonPath('data.section.name', 'A');

        $structureId = $res->json('data.id');

        // Cannot delete category when fee structure is attached
        $this->deleteJson("/api/institution/fee-categories/{$category->id}")
            ->assertUnprocessable();

        // Update fee structure
        $this->patchJson("/api/institution/fee-structures/{$structureId}", [
            'name' => 'Grade 10 Practical Lab Fee - Termly',
            'amount' => 1500,
            'fee_type' => 'compulsory',
            'payment_schedule' => 'quarterly',
            'due_day' => 15,
            'is_active' => true,
        ])
            ->assertOk()
            ->assertJsonPath('data.amount', 1500)
            ->assertJsonPath('data.fee_type', 'compulsory');

        // Delete fee structure
        $this->deleteJson("/api/institution/fee-structures/{$structureId}")
            ->assertOk();

        $this->assertDatabaseMissing('fee_structures', ['id' => $structureId]);

        // Category can now be safely removed
        $this->deleteJson("/api/institution/fee-categories/{$category->id}")
            ->assertOk();
    }

    public function test_scholarships_and_sibling_discount_configuration(): void
    {
        $institution = $this->createInstitution('Apex School', 'APX-99');
        $user = $this->createAdminUser($institution);
        Sanctum::actingAs($user);

        // 1. Create Sibling Discount
        $res = $this->postJson('/api/institution/scholarships', [
            'name' => 'Second Sibling 25% Discount',
            'code' => 'SIBLING25',
            'category' => 'sibling',
            'discount_type' => 'percent',
            'value' => 25,
            'eligibility_rules' => 'Applicable for 2nd and subsequent siblings enrolled in same school.',
            'is_active' => true,
        ])
            ->assertCreated()
            ->assertJsonPath('data.category', 'sibling')
            ->assertJsonPath('data.value', 25)
            ->assertJsonPath('data.discount_type', 'percent');

        $discountId = $res->json('data.id');

        // 2. Create Merit Fixed Scholarship
        $this->postJson('/api/institution/scholarships', [
            'name' => 'Chairman Merit Award',
            'code' => 'MERIT_1000',
            'category' => 'merit',
            'discount_type' => 'fixed',
            'value' => 1000,
            'eligibility_rules' => 'Awarded to students scoring GPA 3.8 and above.',
            'is_active' => true,
        ])->assertCreated();

        // 3. List discounts with category filter
        $this->getJson('/api/institution/scholarships?category=sibling')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Second Sibling 25% Discount');

        // 4. Update discount
        $this->patchJson("/api/institution/scholarships/{$discountId}", [
            'name' => 'Second Sibling 30% Discount',
            'category' => 'sibling',
            'discount_type' => 'percent',
            'value' => 30,
            'eligibility_rules' => 'Updated sibling rebate',
            'is_active' => true,
        ])
            ->assertOk()
            ->assertJsonPath('data.value', 30);

        // 5. Delete discount
        $this->deleteJson("/api/institution/scholarships/{$discountId}")
            ->assertOk();

        $this->assertDatabaseMissing('scholarships', ['id' => $discountId]);
    }

    public function test_late_fee_settings_configuration(): void
    {
        $institution = $this->createInstitution('Valley High', 'VAL-10');
        $user = $this->createAdminUser($institution);
        Sanctum::actingAs($user);

        // Fetch initial default setting
        $this->getJson('/api/institution/late-fee-settings')
            ->assertOk()
            ->assertJsonPath('data.enabled', false);

        // Enable and configure late fee penalty
        $this->postJson('/api/institution/late-fee-settings', [
            'enabled' => true,
            'penalty_type' => 'percentage',
            'penalty_value' => 5,
            'grace_days' => 10,
            'penalty_start_date' => '2026-12-01',
            'description' => '5% late fee charged 10 days after monthly due date.',
        ])
            ->assertOk()
            ->assertJsonPath('data.enabled', true)
            ->assertJsonPath('data.penalty_type', 'percentage')
            ->assertJsonPath('data.penalty_value', 5)
            ->assertJsonPath('data.grace_days', 10);
    }

    public function test_payment_methods_and_fee_collection_integration(): void
    {
        $institution = $this->createInstitution('Beacon Academy', 'BCN-20');
        $this->seedLedgerAccounts($institution);
        $user = $this->createAdminUser($institution);
        Sanctum::actingAs($user);

        // Default payment methods should include Cash, Bank, eSewa, Khalti
        $methodsRes = $this->getJson('/api/institution/payment-methods')
            ->assertOk();

        $codes = collect($methodsRes->json('data'))->pluck('code')->all();
        $this->assertContains('cash', $codes);
        $this->assertContains('bank', $codes);
        $this->assertContains('esewa', $codes);
        $this->assertContains('khalti', $codes);

        // Update eSewa instructions
        $esewaMethod = collect($methodsRes->json('data'))->firstWhere('code', 'esewa');
        $this->patchJson("/api/institution/payment-methods/{$esewaMethod['id']}", [
            'name' => 'eSewa Pay',
            'instructions' => 'Scan eSewa QR on invoice or transfer to 9801234567',
            'account_details' => 'Merchant ID: BEACON_SCHOOL',
            'enabled' => true,
        ])
            ->assertOk()
            ->assertJsonPath('data.name', 'eSewa Pay')
            ->assertJsonPath('data.instructions', 'Scan eSewa QR on invoice or transfer to 9801234567');

        // Create student & fee structure
        $student = Student::query()->create([
            'institution_id' => $institution->id,
            'first_name' => 'Aarav',
            'last_name' => 'Sharma',
            'admission_number' => 'ADM-2026-001',
            'status' => 'active',
        ]);

        $structure = FeeStructure::query()->create([
            'institution_id' => $institution->id,
            'name' => 'Grade 8 Annual Fee',
            'amount' => 12000,
            'fee_type' => 'compulsory',
            'payment_schedule' => 'yearly',
            'is_active' => true,
        ]);

        // Issue invoice linked to fee structure
        $invoiceRes = $this->postJson('/api/institution/invoices', [
            'student_id' => $student->id,
            'amount' => 12000,
            'fee_structure_id' => $structure->id,
            'description' => 'Grade 8 Annual Admission & Term Fee',
            'issued_on' => '2026-11-01',
            'due_on' => '2026-11-20',
        ])
            ->assertCreated()
            ->assertJsonPath('data.amount', 12000)
            ->assertJsonPath('data.fee_structure_id', $structure->id)
            ->assertJsonPath('data.status', 'open');

        $invoiceId = $invoiceRes->json('data.id');

        // Collect fee payment using eSewa
        $this->postJson("/api/institution/invoices/{$invoiceId}/payments", [
            'amount' => 6000,
            'paid_on' => '2026-11-05',
            'method' => 'esewa',
        ])
            ->assertCreated()
            ->assertJsonPath('data.amount', 6000)
            ->assertJsonPath('data.method', 'esewa');

        // Collect remaining balance using Khalti
        $this->postJson("/api/institution/invoices/{$invoiceId}/payments", [
            'amount' => 6000,
            'paid_on' => '2026-11-10',
            'method' => 'khalti',
        ])
            ->assertCreated()
            ->assertJsonPath('data.amount', 6000)
            ->assertJsonPath('data.method', 'khalti');

        // Invoice should now be fully paid
        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'paid_amount' => 12000,
            'status' => 'paid',
        ]);
    }

    private function createInstitution(string $name, string $code): Institution
    {
        $institution = Institution::query()->create([
            'name' => $name,
            'institution_code' => $code,
            'type' => 'school',
            'status' => 'active',
            'currency' => 'NPR',
        ]);

        app(ProvisionInstitutionRoles::class)->handle($institution);

        return $institution;
    }

    private function createAdminUser(Institution $institution): User
    {
        $user = User::factory()->create([
            'institution_id' => $institution->id,
            'is_active' => true,
        ]);

        setPermissionsTeamId($institution->id);
        $user->assignRole('institution-admin');
        setPermissionsTeamId(null);

        return $user;
    }

    private function seedLedgerAccounts(Institution $institution): void
    {
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
    }
}
