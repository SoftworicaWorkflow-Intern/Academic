<?php

namespace Tests\Feature;

use App\Mail\FeeReminder;
use App\Models\AcademicSession;
use App\Models\FeeCategory;
use App\Models\Institution;
use App\Models\Invoice;
use App\Models\LedgerAccount;
use App\Models\Payment;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\User;
use App\Services\ProvisionInstitutionRoles;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class FinanceModulesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->withoutVite();
        $this->withHeader('Origin', (string) config('app.url'));
        $this->seed(RolePermissionSeeder::class);
    }

    public function test_invoice_totals_update_the_ledger_and_can_be_cancelled_before_collection(): void
    {
        $campus = $this->campus('Northstar');
        Sanctum::actingAs($campus['user']);
        $session = AcademicSession::query()->create([
            'institution_id' => $campus['institution']->id,
            'name' => '2026/2027',
            'code' => '2026-27',
            'starts_on' => '2026-04-01',
            'ends_on' => '2027-03-31',
            'status' => 'active',
            'is_current' => true,
        ]);
        $schoolClass = SchoolClass::query()->create([
            'institution_id' => $campus['institution']->id,
            'name' => 'Grade 7',
            'code' => 'G7',
        ]);
        $category = FeeCategory::query()->create([
            'institution_id' => $campus['institution']->id,
            'name' => 'Tuition',
            'code' => 'TUITION',
            'kind' => 'tuition',
            'billing_type' => 'recurring',
            'default_amount' => 1000,
            'is_active' => true,
        ]);
        $student = $this->student($campus['institution'], 'INV-001');

        $response = $this->postJson('/api/institution/invoices', [
            'student_id' => $student->id,
            'amount' => 1000,
            'discount_amount' => 150,
            'late_fee_amount' => 50,
            'fee_category_id' => $category->id,
            'school_class_id' => $schoolClass->id,
            'academic_session_id' => $session->id,
            'description' => 'Term tuition',
            'issued_on' => today()->toDateString(),
            'due_on' => today()->addDays(10)->toDateString(),
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('data.base_amount', 1000)
            ->assertJsonPath('data.discount_amount', 150)
            ->assertJsonPath('data.late_fee_amount', 50)
            ->assertJsonPath('data.amount', 900)
            ->assertJsonPath('data.school_class.id', $schoolClass->id)
            ->assertJsonPath('data.academic_session.id', $session->id)
            ->assertJsonPath('data.display_status', 'unpaid');
        $invoiceId = $response->json('data.id');

        $this->patchJson("/api/institution/invoices/{$invoiceId}", [
            'amount' => 1600,
            'discount_amount' => 200,
            'late_fee_amount' => 100,
            'issued_on' => today()->toDateString(),
            'due_on' => today()->addDays(12)->toDateString(),
        ])->assertOk()->assertJsonPath('data.amount', 1500);

        $this->assertDatabaseHas('invoices', [
            'id' => $invoiceId,
            'base_amount' => 1600,
            'discount_amount' => 200,
            'late_fee_amount' => 100,
            'amount' => 1500,
        ]);
        $this->assertDatabaseCount('journal_entries', 2);

        $this->postJson("/api/institution/invoices/{$invoiceId}/cancel", [
            'reason' => 'Invoice entered in error',
        ])->assertOk()->assertJsonPath('data.display_status', 'cancelled');

        $this->assertDatabaseHas('invoices', ['id' => $invoiceId, 'status' => 'cancelled']);
        $this->assertDatabaseCount('journal_entries', 3);
    }

    public function test_duplicate_collection_requests_do_not_post_a_second_payment(): void
    {
        $campus = $this->campus('Evergreen');
        Sanctum::actingAs($campus['user']);
        $student = $this->student($campus['institution'], 'PAY-001');
        $invoice = $this->issueInvoice($student, 1000);
        $payload = [
            'amount' => 400,
            'paid_on' => today()->toDateString(),
            'method' => 'bank',
            'transaction_id' => 'BANK-REF-001',
            'idempotency_key' => 'c5c6e227-75d2-4b3b-b971-953e39f109a4',
        ];

        $first = $this->postJson("/api/institution/invoices/{$invoice->id}/payments", $payload)->assertCreated();
        $repeat = $this->postJson("/api/institution/invoices/{$invoice->id}/payments", $payload)->assertCreated();

        $this->assertSame($first->json('data.id'), $repeat->json('data.id'));
        $this->assertDatabaseCount('payments', 1);
        $this->assertDatabaseCount('journal_entries', 2);

        $this->postJson("/api/institution/invoices/{$invoice->id}/payments", [
            ...$payload,
            'amount' => 100,
            'idempotency_key' => 'b5c6e227-75d2-4b3b-b971-953e39f109a4',
        ])->assertUnprocessable()->assertInvalid('transaction_id');

        $paymentId = $first->json('data.id');
        $this->postJson("/api/institution/payments/{$paymentId}/verify")
            ->assertOk()
            ->assertJsonPath('data.verified_by', $campus['user']->id);
        $this->postJson("/api/institution/payments/{$paymentId}/reverse", [
            'reason' => 'Duplicate bank entry',
        ])->assertOk()->assertJsonPath('data.status', 'reversed');

        $this->assertDatabaseHas('payments', ['id' => $paymentId, 'status' => 'reversed']);
        $this->assertDatabaseHas('invoices', ['id' => $invoice->id, 'paid_amount' => 0, 'status' => 'open']);
        $this->assertDatabaseCount('journal_entries', 3);
    }

    public function test_reports_and_exports_are_limited_to_the_active_institution(): void
    {
        $firstCampus = $this->campus('Cedar');
        $firstStudent = $this->student($firstCampus['institution'], 'CED-001');
        Sanctum::actingAs($firstCampus['user']);
        $firstInvoice = $this->issueInvoice($firstStudent, 1000);
        $firstPayment = $this->collect($firstInvoice, 400, 'CASH-001');
        fwrite(STDERR, json_encode($firstPayment->getAttributes()));

        $otherCampus = $this->campus('Maple');
        $otherStudent = $this->student($otherCampus['institution'], 'MAP-001');
        Sanctum::actingAs($otherCampus['user']);
        $otherInvoice = $this->issueInvoice($otherStudent, 2000);
        $this->collect($otherInvoice, 800, 'CASH-002');

        Sanctum::actingAs($firstCampus['user']);
        $this->getJson("/api/institution/invoices/{$otherInvoice->id}")->assertNotFound();

        $from = today()->toDateString();
        $reportResponse = $this->getJson("/api/institution/financial-reports?period=day&from={$from}&to={$from}");
        fwrite(STDERR, json_encode($reportResponse->json()));
        $reportResponse
            ->assertOk()
            ->assertJsonPath('data.summary.collection_total', 400)
            ->assertJsonPath('data.summary.paid_total', 400)
            ->assertJsonPath('data.summary.outstanding_total', 600);

        $this->get("/api/institution/financial-reports/export?report=payments&from={$from}&to={$from}")
            ->assertOk()
            ->assertDownload()
            ->assertStreamed();

        $this->assertSame($firstCampus['institution']->id, $firstPayment->institution_id);
        $this->assertSame(1, Payment::query()->count());
    }

    public function test_outstanding_reminders_email_the_guardian_and_reject_missing_addresses(): void
    {
        $campus = $this->campus('Summit');
        Sanctum::actingAs($campus['user']);
        $student = $this->student($campus['institution'], 'SUM-001', 'guardian@example.test');
        $invoice = $this->issueInvoice($student, 1000);
        Mail::fake();

        $this->postJson("/api/institution/outstanding-fees/{$invoice->id}/reminders")
            ->assertOk()
            ->assertJsonPath('message', 'Fee reminder sent successfully.');

        Mail::assertSent(FeeReminder::class, function (FeeReminder $mail) use ($invoice): bool {
            return $mail->hasTo('guardian@example.test')
                && $mail->invoice->is($invoice);
        });

        $studentWithoutEmail = $this->student($campus['institution'], 'SUM-002');
        $invoiceWithoutEmail = $this->issueInvoice($studentWithoutEmail, 500);

        $this->postJson("/api/institution/outstanding-fees/{$invoiceWithoutEmail->id}/reminders")
            ->assertUnprocessable()
            ->assertInvalid(['student' => 'does not have a guardian email address']);

        Mail::assertSentCount(1);
    }

    /**
     * @return array{institution: Institution, user: User}
     */
    private function campus(string $name): array
    {
        $institution = Institution::query()->create([
            'name' => $name.' Academy',
            'institution_code' => strtoupper($name).'-'.fake()->unique()->numerify('###'),
            'type' => 'school',
            'status' => 'active',
            'currency' => 'NPR',
        ]);
        app(ProvisionInstitutionRoles::class)->handle($institution);

        foreach ([
            ['1000', 'Cash', 'asset'],
            ['1010', 'Bank', 'asset'],
            ['1100', 'Accounts receivable', 'asset'],
            ['4000', 'Fee income', 'income'],
            ['5000', 'Operating expense', 'expense'],
        ] as [$code, $accountName, $type]) {
            LedgerAccount::query()->create([
                'institution_id' => $institution->id,
                'code' => $code,
                'name' => $accountName,
                'type' => $type,
            ]);
        }

        $user = User::factory()->create([
            'institution_id' => $institution->id,
            'is_active' => true,
        ]);
        setPermissionsTeamId($institution->id);
        $user->assignRole('institution-admin');
        setPermissionsTeamId(null);

        return ['institution' => $institution, 'user' => $user];
    }

    private function student(Institution $institution, string $admissionNumber, ?string $guardianEmail = null): Student
    {
        return Student::query()->create([
            'institution_id' => $institution->id,
            'first_name' => 'Asha',
            'last_name' => 'Rai',
            'admission_number' => $admissionNumber,
            'guardian_name' => 'Maya Rai',
            'guardian_email' => $guardianEmail,
            'status' => 'active',
        ]);
    }

    private function issueInvoice(Student $student, int $amount): Invoice
    {
        $response = $this->postJson('/api/institution/invoices', [
            'student_id' => $student->id,
            'amount' => $amount,
            'issued_on' => today()->toDateString(),
            'due_on' => today()->addDays(10)->toDateString(),
        ])->assertCreated();

        return Invoice::query()->findOrFail($response->json('data.id'));
    }

    private function collect(Invoice $invoice, int $amount, string $transactionId): Payment
    {
        $response = $this->postJson("/api/institution/invoices/{$invoice->id}/payments", [
            'amount' => $amount,
            'paid_on' => today()->toDateString(),
            'method' => 'cash',
            'transaction_id' => $transactionId,
        ])->assertCreated();

        return Payment::query()->findOrFail($response->json('data.id'));
    }
}
