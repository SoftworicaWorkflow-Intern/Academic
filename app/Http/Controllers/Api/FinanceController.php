<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\FeeReminder;
use App\Models\AcademicSession;
use App\Models\AuditLog;
use App\Models\FeeCategory;
use App\Models\FeeStructure;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\PaymentMethod;
use App\Models\SchoolClass;
use App\Models\Student;
use App\Models\User;
use App\Services\FinanceService;
use App\Services\InstitutionContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class FinanceController extends Controller
{
    public function invoices(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(['unpaid', 'partial', 'paid', 'overdue', 'cancelled'])],
            'school_class_id' => ['nullable', 'integer'],
            'academic_session_id' => ['nullable', 'integer'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Invoice::query()->with([
            'student:id,first_name,last_name,admission_number,school_class_id',
            'schoolClass:id,name,code',
            'academicSession:id,name,code',
            'feeCategory:id,name,code',
            'feeStructure:id,name,amount',
        ]);

        $this->applyInvoiceFilters($query, $filters);

        if ($search = trim($filters['search'] ?? '')) {
            $query->where(function (Builder $builder) use ($search): void {
                $builder->where('number', 'like', "%{$search}%")
                    ->orWhereHas('student', function (Builder $studentQuery) use ($search): void {
                        $studentQuery->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%")
                            ->orWhere('admission_number', 'like', "%{$search}%");
                    });
            });
        }

        if (($filters['status'] ?? null) === 'overdue') {
            $query->whereDate('due_on', '<', today())->whereColumn('paid_amount', '<', 'amount');
        } elseif (($filters['status'] ?? null) === 'unpaid') {
            $query->where('paid_amount', 0)->where('status', '!=', 'cancelled');
        } elseif (($filters['status'] ?? null) === 'partial') {
            $query->where('paid_amount', '>', 0)->whereColumn('paid_amount', '<', 'amount');
        } elseif (($filters['status'] ?? null) === 'paid') {
            $query->whereColumn('paid_amount', '>=', 'amount');
        } elseif (($filters['status'] ?? null) === 'cancelled') {
            $query->where('status', 'cancelled');
        }

        return response()->json($query
            ->orderByDesc('issued_on')
            ->orderByDesc('id')
            ->paginate($filters['per_page'] ?? 15)
            ->withQueryString());
    }

    public function showInvoice(int $invoice): JsonResponse
    {
        return response()->json([
            'data' => Invoice::query()->with([
                'student:id,first_name,last_name,admission_number,school_class_id',
                'schoolClass:id,name,code',
                'academicSession:id,name,code',
                'feeCategory:id,name,code',
                'feeStructure:id,name,amount',
                'payments:id,institution_id,invoice_id,receipt_number,amount,paid_on,method,transaction_id,status,verified_at',
            ])->findOrFail($invoice),
        ]);
    }

    public function storeInvoice(Request $request, FinanceService $finance, InstitutionContext $context): JsonResponse
    {
        $validated = $request->validate($this->invoiceRules($context->current()->getKey()));
        $actor = $request->user();
        abort_unless($actor instanceof User, 401);

        return response()->json(['data' => $finance->issueInvoice($validated, $actor)], 201);
    }

    public function updateInvoice(Request $request, int $invoice, FinanceService $finance, InstitutionContext $context): JsonResponse
    {
        $invoice = Invoice::query()->findOrFail($invoice);
        $validated = $request->validate($this->invoiceRules($context->current()->getKey(), true));
        $validated = array_merge([
            'student_id' => $invoice->student_id,
            'amount' => $invoice->base_amount ?: $invoice->amount,
            'discount_amount' => $invoice->discount_amount,
            'late_fee_amount' => $invoice->late_fee_amount,
            'issued_on' => $invoice->issued_on->toDateString(),
            'due_on' => $invoice->due_on->toDateString(),
            'fee_structure_id' => $invoice->fee_structure_id,
            'fee_category_id' => $invoice->fee_category_id,
            'school_class_id' => $invoice->school_class_id,
            'academic_session_id' => $invoice->academic_session_id,
            'description' => $invoice->description,
        ], $validated);
        $actor = $request->user();
        abort_unless($actor instanceof User, 401);

        return response()->json(['data' => $finance->updateInvoice($invoice, $validated, $actor)]);
    }

    public function cancelInvoice(Request $request, int $invoice, FinanceService $finance): JsonResponse
    {
        $invoice = Invoice::query()->findOrFail($invoice);
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
        ]);
        $actor = $request->user();
        abort_unless($actor instanceof User, 401);

        return response()->json(['data' => $finance->cancelInvoice($invoice, $validated['reason'], $actor)]);
    }

    public function lookups(): JsonResponse
    {
        return response()->json([
            'data' => [
                'classes' => SchoolClass::query()->orderBy('name')->get(['id', 'name', 'code']),
                'academic_sessions' => AcademicSession::query()->orderByDesc('starts_on')->get(['id', 'name', 'code', 'status', 'is_current']),
                'fee_categories' => FeeCategory::query()->where('is_active', true)->orderBy('name')->get(['id', 'name']),
                'fee_structures' => FeeStructure::query()
                    ->where('is_active', true)
                    ->with([
                        'category:id,name,code',
                        'schoolClass:id,name,code',
                        'academicSession:id,name,code',
                    ])
                    ->orderBy('name')
                    ->get(['id', 'fee_category_id', 'academic_session_id', 'school_class_id', 'name', 'amount']),
                'payment_methods' => PaymentMethod::query()
                    ->where('enabled', true)
                    ->where('is_active', true)
                    ->orderBy('name')
                    ->get(['id', 'name', 'code', 'instructions']),
            ],
        ]);
    }

    public function students(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'include_all' => ['nullable', 'boolean'],
        ]);
        $search = trim($validated['search'] ?? '');

        if ($search === '') {
            return response()->json(['data' => []]);
        }

        $studentQuery = Student::query()
            ->with([
                'schoolClass:id,name,code',
                'invoices' => function (Builder $query): void {
                    $query->where('status', '!=', 'cancelled')
                        ->whereColumn('paid_amount', '<', 'amount')
                        ->with(['feeStructure:id,name', 'feeCategory:id,name', 'schoolClass:id,name'])
                        ->orderBy('due_on');
                },
            ])
            ->where(function (Builder $query) use ($search): void {
                $query->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('admission_number', 'like', "%{$search}%");
            })
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->limit(20);

        if (! ($validated['include_all'] ?? false)) {
            $studentQuery->whereHas('invoices', function (Builder $query): void {
                $query->where('status', '!=', 'cancelled')
                    ->whereColumn('paid_amount', '<', 'amount');
            });
        }

        $students = $studentQuery->get(['id', 'school_class_id', 'admission_number', 'first_name', 'last_name']);

        return response()->json([
            'data' => $students->map(fn (Student $student): array => [
                'id' => $student->getKey(),
                'name' => trim($student->first_name.' '.$student->last_name),
                'admission_number' => $student->admission_number,
                'class' => $student->schoolClass?->name,
                'invoices' => $student->invoices->map(fn (Invoice $invoice): array => [
                    'id' => $invoice->getKey(),
                    'number' => $invoice->number,
                    'description' => $invoice->description,
                    'fee_name' => $invoice->feeStructure?->name ?? $invoice->feeCategory?->name,
                    'amount' => $invoice->amount,
                    'paid_amount' => $invoice->paid_amount,
                    'balance_due' => $invoice->balance_due,
                    'due_on' => $invoice->due_on?->toDateString(),
                    'display_status' => $invoice->display_status,
                ]),
            ]),
        ]);
    }

    public function outstanding(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'school_class_id' => ['nullable', 'integer'],
            'academic_session_id' => ['nullable', 'integer'],
            'overdue' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Invoice::query()
            ->where('status', '!=', 'cancelled')
            ->whereColumn('paid_amount', '<', 'amount')
            ->with([
                'student:id,first_name,last_name,admission_number,school_class_id',
                'schoolClass:id,name,code',
                'academicSession:id,name,code',
            ]);

        $this->applyInvoiceFilters($query, $filters);

        if (isset($filters['overdue'])) {
            $query->whereDate('due_on', $filters['overdue'] ? '<' : '>=', today());
        }

        if ($search = trim($filters['search'] ?? '')) {
            $query->whereHas('student', function (Builder $studentQuery) use ($search): void {
                $studentQuery->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('admission_number', 'like', "%{$search}%");
            });
        }

        $summaryQuery = clone $query;
        $summary = [
            'count' => (int) (clone $summaryQuery)->count(),
            'balance_due' => (int) (clone $summaryQuery)
                ->selectRaw('COALESCE(SUM(amount - paid_amount), 0) as balance')
                ->value('balance'),
            'overdue_count' => (int) (clone $summaryQuery)            ->whereDate('due_on', '<', today())->count(),
        ];
        $page = $query
            ->orderBy('due_on')
            ->orderByDesc('id')
            ->paginate($filters['per_page'] ?? 15)
            ->withQueryString();

        return response()->json(array_merge($page->toArray(), ['summary' => $summary]));
    }

    public function payments(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'search' => ['nullable', 'string', 'max:100'],
            'method' => ['nullable', 'string', 'max:30'],
            'status' => ['nullable', Rule::in(['posted', 'reversed'])],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $query = Payment::query()->with([
            'invoice:id,student_id,number,school_class_id,amount,paid_amount',
            'invoice.student:id,first_name,last_name,admission_number',
            'invoice.schoolClass:id,name',
            'verifier:id,name',
        ]);

        if (! empty($filters['method'])) {
            $query->where('method', $filters['method']);
        }

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['from'])) {
            $query->whereDate('paid_on', '>=', $filters['from']);
        }

        if (! empty($filters['to'])) {
            $query->whereDate('paid_on', '<=', $filters['to']);
        }

        if ($search = trim($filters['search'] ?? '')) {
            $query->where(function (Builder $builder) use ($search): void {
                $builder->where('receipt_number', 'like', "%{$search}%")
                    ->orWhere('transaction_id', 'like', "%{$search}%")
                    ->orWhereHas('invoice', function (Builder $invoiceQuery) use ($search): void {
                        $invoiceQuery->where('number', 'like', "%{$search}%")
                            ->orWhereHas('student', function (Builder $studentQuery) use ($search): void {
                                $studentQuery->where('first_name', 'like', "%{$search}%")
                                    ->orWhere('last_name', 'like', "%{$search}%")
                                    ->orWhere('admission_number', 'like', "%{$search}%");
                            });
                    });
            });
        }

        return response()->json($query
            ->orderByDesc('paid_on')
            ->orderByDesc('id')
            ->paginate($filters['per_page'] ?? 15)
            ->withQueryString());
    }

    public function showPayment(int $payment): JsonResponse
    {
        return response()->json([
            'data' => Payment::query()->with([
                'invoice.student:id,first_name,last_name,admission_number',
                'invoice.schoolClass:id,name',
                'verifier:id,name',
            ])->findOrFail($payment),
        ]);
    }

    public function storePayment(Request $request, int $invoice, FinanceService $finance): JsonResponse
    {
        $invoice = Invoice::query()->findOrFail($invoice);
        $allowedMethods = PaymentMethod::query()
            ->where('enabled', true)
            ->where('is_active', true)
            ->pluck('code')
            ->push('cash', 'bank', 'online', 'esewa', 'khalti')
            ->unique()
            ->values()
            ->all();

        $validated = $request->validate([
            'amount' => ['required', 'integer', 'min:1'],
            'paid_on' => ['required', 'date'],
            'method' => ['required', 'string', Rule::in($allowedMethods)],
            'transaction_id' => ['nullable', 'string', 'max:120'],
            'idempotency_key' => ['nullable', 'uuid'],
        ]);

        $actor = $request->user();
        abort_unless($actor instanceof User, 401);

        $payment = $finance->collect(
            $invoice,
            $validated['amount'],
            $validated['paid_on'],
            $validated['method'],
            $actor,
            $validated['transaction_id'] ?? null,
            $validated['idempotency_key'] ?? null,
        );

        return response()->json(['data' => $payment], 201);
    }

    public function verifyPayment(Request $request, int $payment, FinanceService $finance): JsonResponse
    {
        $payment = Payment::query()->findOrFail($payment);
        $actor = $request->user();
        abort_unless($actor instanceof User, 401);

        return response()->json(['data' => $finance->verify($payment, $actor)]);
    }

    public function reversePayment(Request $request, int $payment, FinanceService $finance): JsonResponse
    {
        $payment = Payment::query()->findOrFail($payment);
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
        ]);
        $actor = $request->user();
        abort_unless($actor instanceof User, 401);

        return response()->json(['data' => $finance->reverse($payment, $validated['reason'], $actor)]);
    }

    public function sendReminder(Request $request, int $invoice): JsonResponse
    {
        $invoice = Invoice::query()->findOrFail($invoice);
        abort_if($invoice->status === 'cancelled' || $invoice->balance_due < 1, 422, 'Only invoices with an outstanding balance can receive a reminder.');

        $invoice->loadMissing('student', 'institution');
        $email = $invoice->student?->guardian_email;

        if (! is_string($email) || trim($email) === '') {
            throw ValidationException::withMessages([
                'student' => 'This student does not have a guardian email address on file.',
            ]);
        }

        Mail::to($email)->send(new FeeReminder($invoice));

        AuditLog::query()->create([
            'institution_id' => $invoice->institution_id,
            'user_id' => $request->user()?->getKey(),
            'action' => 'invoice.reminder_sent',
            'subject_type' => Invoice::class,
            'subject_id' => $invoice->getKey(),
            'metadata' => ['recipient' => $email],
        ]);

        return response()->json(['message' => 'Fee reminder sent successfully.']);
    }

    public function reports(Request $request, InstitutionContext $context): JsonResponse
    {
        $filters = $request->validate([
            'period' => ['nullable', Rule::in(['day', 'month', 'year'])],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'school_class_id' => ['nullable', 'integer'],
            'academic_session_id' => ['nullable', 'integer'],
        ]);

        $period = $filters['period'] ?? 'month';
        $from = $filters['from'] ?? match ($period) {
            'day' => today()->toDateString(),
            'year' => now()->startOfYear()->toDateString(),
            default => now()->startOfMonth()->toDateString(),
        };
        $to = $filters['to'] ?? today()->toDateString();
        $classId = $filters['school_class_id'] ?? null;
        $sessionId = $filters['academic_session_id'] ?? null;
        $invoiceFilter = function (Builder $query) use ($classId, $sessionId): void {
            if ($classId !== null) {
                $query->where('school_class_id', $classId);
            }

            if ($sessionId !== null) {
                $query->where('academic_session_id', $sessionId);
            }
        };

        $payments = Payment::query()
            ->where('status', 'posted')
            ->whereDate('paid_on', '>=', $from)
            ->whereDate('paid_on', '<=', $to)
            ->whereHas('invoice', $invoiceFilter);
        $invoices = Invoice::query()
            ->where('status', '!=', 'cancelled')
            ->where($invoiceFilter);
        $outstandingInvoices = (clone $invoices)
            ->whereColumn('paid_amount', '<', 'amount');

        $driver = DB::connection()->getDriverName();
        $groupExpression = match ($period) {
            'year' => $driver === 'sqlite' ? "strftime('%Y', paid_on)" : 'YEAR(paid_on)',
            'month' => $driver === 'sqlite' ? "strftime('%Y-%m', paid_on)" : "DATE_FORMAT(paid_on, '%Y-%m')",
            default => $driver === 'sqlite' ? "strftime('%Y-%m-%d', paid_on)" : 'DATE(paid_on)',
        };
        $trend = (clone $payments)
            ->selectRaw("{$groupExpression} as period, SUM(amount) as amount")
            ->groupByRaw($groupExpression)
            ->orderBy('period')
            ->get();

        $methodTotals = (clone $payments)
            ->selectRaw('method, SUM(amount) as amount')
            ->groupBy('method')
            ->orderByDesc('amount')
            ->get();

        $classTotals = (clone $payments)
            ->with('invoice.schoolClass:id,name')
            ->get()
            ->groupBy(fn (Payment $payment): string => $payment->invoice?->schoolClass?->name ?? 'Unassigned')
            ->map(fn ($rows, string $name): array => ['name' => $name, 'amount' => $rows->sum('amount')])
            ->sortByDesc('amount')
            ->values()
            ->take(10);

        $studentTotals = (clone $payments)
            ->with('invoice.student:id,first_name,last_name,admission_number')
            ->get()
            ->groupBy(fn (Payment $payment): int => (int) $payment->invoice?->student_id)
            ->map(function ($rows): array {
                $student = $rows->first()->invoice?->student;

                return [
                    'student_id' => $student?->getKey(),
                    'name' => trim(($student?->first_name ?? '').' '.($student?->last_name ?? '')),
                    'admission_number' => $student?->admission_number,
                    'amount' => $rows->sum('amount'),
                ];
            })
            ->sortByDesc('amount')
            ->values()
            ->take(10);

        $paidAmount = (clone $invoices)->sum('paid_amount');
        $outstandingAmount = (clone $outstandingInvoices)
            ->selectRaw('COALESCE(SUM(amount - paid_amount), 0) as balance')
            ->value('balance');

        return response()->json([
            'data' => [
                'currency' => $context->current()->currency ?? 'NPR',
                'period' => $period,
                'from' => $from,
                'to' => $to,
                'summary' => [
                    'collection_total' => (int) (clone $payments)->sum('amount'),
                    'invoiced_total' => (int) (clone $invoices)->whereDate('issued_on', '>=', $from)->whereDate('issued_on', '<=', $to)->sum('amount'),
                    'paid_total' => (int) $paidAmount,
                    'outstanding_total' => (int) $outstandingAmount,
                    'invoice_count' => (int) (clone $invoices)->whereDate('issued_on', '>=', $from)->whereDate('issued_on', '<=', $to)->count(),
                ],
                'trend' => $trend,
                'payment_methods' => $methodTotals,
                'class_collections' => $classTotals,
                'student_collections' => $studentTotals,
                'outstanding_count' => (int) $outstandingInvoices->count(),
            ],
        ]);
    }

    public function exportReport(Request $request, InstitutionContext $context): StreamedResponse
    {
        $filters = $request->validate([
            'report' => ['nullable', Rule::in(['payments', 'outstanding'])],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'school_class_id' => ['nullable', 'integer'],
            'academic_session_id' => ['nullable', 'integer'],
        ]);

        $report = $filters['report'] ?? 'payments';
        $from = $filters['from'] ?? now()->startOfMonth()->toDateString();
        $to = $filters['to'] ?? today()->toDateString();
        $institutionId = $context->current()->getKey();

        return response()->streamDownload(function () use ($report, $from, $to, $filters): void {
            $output = fopen('php://output', 'w');

            if ($output === false) {
                throw new \RuntimeException('Unable to open the report output stream.');
            }

            if ($report === 'outstanding') {
                fputcsv($output, ['Invoice', 'Student', 'Admission number', 'Class', 'Invoice amount', 'Paid amount', 'Balance due', 'Due date']);
                $query = Invoice::query()
                    ->where('status', '!=', 'cancelled')
                    ->whereColumn('paid_amount', '<', 'amount')
                    ->with(['student:id,first_name,last_name,admission_number', 'schoolClass:id,name']);
                $this->applyInvoiceFilters($query, $filters);
                $query->chunkById(500, function ($invoices) use ($output): void {
                    foreach ($invoices as $invoice) {
                        fputcsv($output, [
                            $this->spreadsheetSafe($invoice->number),
                            $this->spreadsheetSafe(trim($invoice->student?->first_name.' '.$invoice->student?->last_name)),
                            $this->spreadsheetSafe($invoice->student?->admission_number),
                            $this->spreadsheetSafe($invoice->schoolClass?->name),
                            $invoice->amount,
                            $invoice->paid_amount,
                            $invoice->balance_due,
                            $invoice->due_on?->toDateString(),
                        ]);
                    }
                });
            } else {
                fputcsv($output, ['Payment ID', 'Receipt number', 'Student', 'Admission number', 'Invoice number', 'Payment date', 'Method', 'Transaction ID', 'Amount', 'Status']);
                $query = Payment::query()
                    ->where('status', 'posted')
                    ->whereDate('paid_on', '>=', $from)
                    ->whereDate('paid_on', '<=', $to)
                    ->with(['invoice.student:id,first_name,last_name,admission_number']);
                if (! empty($filters['school_class_id']) || ! empty($filters['academic_session_id'])) {
                    $query->whereHas('invoice', function (Builder $invoiceQuery) use ($filters): void {
                        if (! empty($filters['school_class_id'])) {
                            $invoiceQuery->where('school_class_id', $filters['school_class_id']);
                        }
                        if (! empty($filters['academic_session_id'])) {
                            $invoiceQuery->where('academic_session_id', $filters['academic_session_id']);
                        }
                    });
                }

                $query->chunkById(500, function ($payments) use ($output): void {
                    foreach ($payments as $payment) {
                        fputcsv($output, [
                            $payment->getKey(),
                            $this->spreadsheetSafe($payment->receipt_number),
                            $this->spreadsheetSafe(trim($payment->invoice?->student?->first_name.' '.$payment->invoice?->student?->last_name)),
                            $this->spreadsheetSafe($payment->invoice?->student?->admission_number),
                            $this->spreadsheetSafe($payment->invoice?->number),
                            $payment->paid_on?->toDateString(),
                            $this->spreadsheetSafe($payment->method),
                            $this->spreadsheetSafe($payment->transaction_id),
                            $payment->amount,
                            $payment->status,
                        ]);
                    }
                });
            }

            fclose($output);
        }, "financial-{$report}-{$institutionId}-{$from}-{$to}.csv", [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    private function invoiceRules(int $institutionId, bool $partial = false): array
    {
        $required = $partial ? ['sometimes', 'required'] : ['required'];
        $optional = $partial ? ['sometimes', 'nullable'] : ['nullable'];

        return [
            'student_id' => [...$required, 'integer', Rule::exists('students', 'id')->where('institution_id', $institutionId)],
            'amount' => [...$required, 'integer', 'min:1'],
            'issued_on' => [...$required, 'date'],
            'due_on' => [...$required, 'date', 'after_or_equal:issued_on'],
            'fee_structure_id' => [...$optional, 'integer', Rule::exists('fee_structures', 'id')->where('institution_id', $institutionId)],
            'fee_category_id' => [...$optional, 'integer', Rule::exists('fee_categories', 'id')->where('institution_id', $institutionId)],
            'school_class_id' => [...$optional, 'integer', Rule::exists('school_classes', 'id')->where('institution_id', $institutionId)],
            'academic_session_id' => [...$optional, 'integer', Rule::exists('academic_sessions', 'id')->where('institution_id', $institutionId)],
            'discount_amount' => $partial ? ['sometimes', 'integer', 'min:0'] : ['nullable', 'integer', 'min:0'],
            'late_fee_amount' => $partial ? ['sometimes', 'integer', 'min:0'] : ['nullable', 'integer', 'min:0'],
            'description' => [...$optional, 'string', 'max:255'],
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function applyInvoiceFilters(Builder $query, array $filters): void
    {
        if (! empty($filters['school_class_id'])) {
            $query->where('school_class_id', $filters['school_class_id']);
        }

        if (! empty($filters['academic_session_id'])) {
            $query->where('academic_session_id', $filters['academic_session_id']);
        }
    }

    private function spreadsheetSafe(?string $value): ?string
    {
        if ($value !== null && preg_match('/^[=+\-@]/', $value) === 1) {
            return "'".$value;
        }

        return $value;
    }
}
