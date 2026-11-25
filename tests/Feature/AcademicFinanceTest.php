<?php

namespace Tests\Feature;

use App\Models\ClassSubject;
use App\Models\Examination;
use App\Models\Institution;
use App\Models\Invoice;
use App\Models\LedgerAccount;
use App\Models\Payment;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\Subject;
use App\Models\User;
use App\Services\MarkCalculator;
use App\Services\ProvisionInstitutionRoles;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AcademicFinanceTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolePermissionSeeder::class);
        $this->withHeader('Origin', (string) config('app.url'));
    }

    public function test_mark_totals_percentage_and_grade(): void
    {
        $result = app(MarkCalculator::class)->score([
            'theory_marks' => 70,
            'practical_marks' => 20,
            'full_marks' => 80,
            'pass_marks' => 32,
            'practical_full_marks' => 20,
            'practical_pass_marks' => 8,
        ]);

        $this->assertSame(90, $result['total']);
        $this->assertSame(90.0, $result['percentage']);
        $this->assertSame('A+', $result['grade']);
        $this->assertTrue($result['passed']);
    }

    public function test_accountant_is_redirected_to_the_finance_dashboard(): void
    {
        $campus = $this->campus('accountant');

        $this->postJson('/api/login', [
            'login' => $campus['user']->email,
            'password' => 'password',
        ])->assertOk()->assertJsonPath('user.redirect_to', '/accountant/dashboard');
    }

    public function test_refund_reverses_a_posted_receipt_and_marks_stay_inside_the_institution(): void
    {
        $first = $this->campus('institution-admin');
        $second = $this->campus('institution-admin');
        Sanctum::actingAs($first['user']);

        $class = SchoolClass::query()->create(['institution_id' => $first['institution']->id, 'name' => 'Grade 8', 'code' => 'G8']);
        $section = Section::query()->create(['institution_id' => $first['institution']->id, 'school_class_id' => $class->id, 'name' => 'A', 'capacity' => 1]);
        $otherClass = SchoolClass::query()->create(['institution_id' => $first['institution']->id, 'name' => 'Grade 9']);
        $student = Student::query()->create([
            'institution_id' => $first['institution']->id,
            'school_class_id' => $class->id,
            'admission_number' => 'A-9',
            'first_name' => 'Nima',
            'last_name' => 'Gurung',
            'status' => 'active',
        ]);

        $this->patchJson('/api/institution/students/'.$student->id.'/enrollment', [
            'school_class_id' => $otherClass->id,
            'section_id' => $section->id,
        ])->assertUnprocessable();

        $this->postJson('/api/institution/invoices', [
            'student_id' => $student->id,
            'amount' => 1000,
            'issued_on' => '2026-05-01',
            'due_on' => '2026-05-10',
        ])->assertCreated();

        $invoice = Invoice::query()->firstOrFail();
        $this->postJson('/api/institution/invoices/'.$invoice->id.'/payments', [
            'amount' => 1000,
            'paid_on' => '2026-05-02',
            'method' => 'cash',
        ])->assertCreated();

        $payment = Payment::query()->firstOrFail();
        $this->postJson('/api/institution/payments/'.$payment->id.'/reverse', [
            'reason' => 'Duplicate receipt',
        ])->assertOk();

        $this->assertSame('reversed', $payment->fresh()->status);
        $this->assertSame(0, $invoice->fresh()->paid_amount);

        $subject = Subject::query()->create([
            'institution_id' => $first['institution']->id,
            'name' => 'Science',
            'code' => 'SCI',
        ]);
        ClassSubject::query()->create([
            'institution_id' => $first['institution']->id,
            'school_class_id' => $class->id,
            'subject_id' => $subject->id,
            'full_marks' => 100,
            'pass_marks' => 40,
            'practical_full_marks' => 0,
            'practical_pass_marks' => 0,
        ]);
        $exam = Examination::query()->create([
            'institution_id' => $first['institution']->id,
            'school_class_id' => $class->id,
            'name' => 'Terminal',
            'exam_type' => 'terminal',
        ]);
        $student->update(['school_class_id' => $class->id]);

        $this->postJson('/api/institution/examinations/'.$exam->id.'/marks', [
            'student_id' => $student->id,
            'subject_id' => $subject->id,
            'theory_marks' => 80,
            'practical_marks' => 0,
        ])->assertOk()->assertJsonPath('data.result.grade', 'A');

        Sanctum::actingAs($second['user']);
        $this->getJson('/api/institution/examinations/'.$exam->id.'/results')->assertNotFound();
    }

    public function test_cashier_cannot_reverse_a_payment(): void
    {
        $cashier = $this->campus('cashier');
        Sanctum::actingAs($cashier['user']);

        $this->postJson('/api/institution/payments/1/reverse', ['reason' => 'No'])->assertForbidden();
    }

    /**
     * @return array{user: User, institution: Institution}
     */
    private function campus(string $role): array
    {
        $institution = Institution::query()->create([
            'name' => $role.' campus '.fake()->unique()->numerify(),
            'institution_code' => strtoupper(fake()->unique()->bothify('??###')),
            'type' => 'school',
            'status' => 'active',
        ]);
        app(ProvisionInstitutionRoles::class)->handle($institution);

        foreach ([
            ['1000', 'Cash', 'asset'],
            ['1010', 'Bank', 'asset'],
            ['1100', 'Accounts receivable', 'asset'],
            ['4000', 'Fee income', 'income'],
            ['5000', 'Operating expense', 'expense'],
        ] as [$code, $name, $type]) {
            LedgerAccount::query()->create([
                'institution_id' => $institution->id,
                'code' => $code,
                'name' => $name,
                'type' => $type,
            ]);
        }

        $user = User::factory()->create([
            'institution_id' => $institution->id,
            'is_active' => true,
        ]);
        setPermissionsTeamId($institution->id);
        $user->assignRole($role);
        setPermissionsTeamId(null);

        return ['user' => $user, 'institution' => $institution];
    }
}
