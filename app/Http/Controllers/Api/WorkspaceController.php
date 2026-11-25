<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicSession;
use App\Models\AttendanceRecord;
use App\Models\FeeStructure;
use App\Models\Invoice;
use App\Models\JournalEntry;
use App\Models\Notice;
use App\Models\Payment;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\User;
use App\Services\FinanceService;
use App\Services\InstitutionContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class WorkspaceController extends Controller
{
    public function students(Request $request): JsonResponse
    {
        $perPage = in_array((int) $request->input('per_page'), [10, 25, 50, 100], true) ? (int) $request->input('per_page') : 10;
        $students = Student::query()
            ->with(['schoolClass:id,name', 'section:id,name,school_class_id', 'academicSession:id,name'])
            ->when($request->filled('search'), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->toString().'%';
                $query->where(function ($inner) use ($search): void {
                    $inner->where('first_name', 'like', $search)
                        ->orWhere('last_name', 'like', $search)
                        ->orWhere('admission_number', 'like', $search)
                        ->orWhere('guardian_name', 'like', $search);
                });
            })
            ->when($request->filled('school_class_id'), fn ($query) => $query->where('school_class_id', $request->integer('school_class_id')))
            ->when($request->filled('section_id'), fn ($query) => $query->where('section_id', $request->integer('section_id')))
            ->when($request->filled('academic_session_id'), fn ($query) => $query->where('academic_session_id', $request->integer('academic_session_id')))
            ->when($request->filled('gender'), fn ($query) => $query->where('gender', $request->string('gender')->toString()))
            ->when($request->filled('status'), fn ($query) => $query->where('status', $request->string('status')->toString()))
            ->latest()
            ->paginate($perPage);

        return response()->json($students);
    }

    public function storeStudent(Request $request, InstitutionContext $context): JsonResponse
    {
        $validated = $this->validateStudent($request, $context->id());
        $validated['admission_number'] = $validated['admission_number'] ?: $this->nextAdmissionNumber();
        $validated['status'] = $validated['status'] ?? 'active';
        $student = Student::query()->create($validated);
        $this->storePhoto($request, $student);

        return response()->json(['data' => $student->fresh(['schoolClass:id,name', 'section:id,name', 'academicSession:id,name'])], 201);
    }

    public function updateStudent(Request $request, int $student, InstitutionContext $context): JsonResponse
    {
        $record = Student::query()->findOrFail($student);
        $validated = $this->validateStudent($request, $context->id(), $record->getKey());
        $record->update($validated);
        $this->storePhoto($request, $record);

        return response()->json(['data' => $record->fresh(['schoolClass:id,name', 'section:id,name', 'academicSession:id,name'])]);
    }

    public function destroyStudent(int $student): JsonResponse
    {
        $record = Student::query()->findOrFail($student);
        $record->update(['status' => 'archived']);
        $record->delete();

        return response()->json(['message' => 'Student archived.']);
    }

    public function showStudent(int $student): JsonResponse
    {
        $record = Student::query()->with([
            'schoolClass:id,name',
            'section:id,name',
            'academicSession:id,name',
            'invoices.payments',
            'attendanceRecords' => fn ($query) => $query->latest('attended_on')->limit(10),
            'marks.subject:id,name',
        ])->findOrFail($student);

        return response()->json(['data' => $record]);
    }

    public function studentPhoto(int $student): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $record = Student::query()->findOrFail($student);
        abort_unless($record->photo_path && Storage::disk('local')->exists($record->photo_path), 404);

        return Storage::disk('local')->response($record->photo_path);
    }

    /**
     * @return array<string, mixed>
     */
    private function validateStudent(Request $request, ?int $institutionId, ?int $ignoreId = null): array
    {
        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'admission_number' => ['nullable', 'string', 'max:50', Rule::unique('students', 'admission_number')->where('institution_id', $institutionId)->ignore($ignoreId)],
            'gender' => ['nullable', Rule::in(['female', 'male', 'other'])],
            'date_of_birth' => ['nullable', 'date'],
            'email' => ['nullable', 'email'],
            'guardian_name' => ['nullable', 'string', 'max:255'],
            'guardian_relationship' => ['nullable', 'string', 'max:50'],
            'guardian_phone' => ['nullable', 'string', 'max:30'],
            'guardian_email' => ['nullable', 'email'],
            'academic_session_id' => ['nullable', 'integer'],
            'school_class_id' => ['nullable', 'integer'],
            'section_id' => ['nullable', 'integer'],
            'admission_date' => ['nullable', 'date'],
            'previous_school' => ['nullable', 'string', 'max:255'],
            'province' => ['nullable', 'string', 'max:100'],
            'district' => ['nullable', 'string', 'max:100'],
            'municipality' => ['nullable', 'string', 'max:100'],
            'ward' => ['nullable', 'string', 'max:20'],
            'street' => ['nullable', 'string', 'max:255'],
            'permanent_address' => ['nullable', 'string', 'max:500'],
            'status' => ['nullable', Rule::in(['active', 'graduated', 'transferred', 'archived'])],
            'photo' => ['nullable', 'image', 'max:2048'],
        ]);

        unset($validated['photo']);

        if (! empty($validated['academic_session_id'])) {
            AcademicSession::query()->findOrFail($validated['academic_session_id']);
        }

        if (! empty($validated['school_class_id'])) {
            SchoolClass::query()->findOrFail($validated['school_class_id']);
        }

        if (! empty($validated['section_id'])) {
            $section = Section::query()->findOrFail($validated['section_id']);
            if (! empty($validated['school_class_id']) && $section->school_class_id !== (int) $validated['school_class_id']) {
                throw ValidationException::withMessages(['section_id' => 'This section does not belong to the selected class.']);
            }
        }

        return $validated;
    }

    private function nextAdmissionNumber(): string
    {
        $number = Student::query()->withTrashed()->count() + 1;

        do {
            $code = 'ADM-'.str_pad((string) $number, 4, '0', STR_PAD_LEFT);
            $number++;
        } while (Student::query()->withTrashed()->where('admission_number', $code)->exists());

        return $code;
    }

    private function storePhoto(Request $request, Student $student): void
    {
        if (! $request->hasFile('photo')) {
            return;
        }

        if ($student->photo_path) {
            Storage::disk('local')->delete($student->photo_path);
        }

        $path = $request->file('photo')?->store('students/'.$student->institution_id, 'local');
        $student->update(['photo_path' => $path]);
    }

    public function teachers(): JsonResponse
    {
        return response()->json(Teacher::query()->latest()->paginate(15));
    }

    public function storeTeacher(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'employee_code' => ['required', 'string', 'max:50'],
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => ['nullable', 'email'],
            'phone' => ['nullable', 'string', 'max:30'],
            'department' => ['nullable', 'string', 'max:100'],
            'qualification' => ['nullable', 'string', 'max:255'],
        ]);

        return response()->json(['data' => Teacher::query()->create($validated)], 201);
    }

    public function sessions(): JsonResponse
    {
        return response()->json(['data' => AcademicSession::query()->orderByDesc('starts_on')->get()]);
    }

    public function storeSession(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'starts_on' => ['required', 'date'],
            'ends_on' => ['required', 'date', 'after:starts_on'],
            'is_current' => ['boolean'],
        ]);

        if ($request->boolean('is_current')) {
            AcademicSession::query()->update(['is_current' => false]);
        }

        return response()->json(['data' => AcademicSession::query()->create($validated)], 201);
    }

    public function classes(): JsonResponse
    {
        return response()->json(['data' => SchoolClass::query()->with('sections')->orderBy('name')->get()]);
    }

    public function storeClass(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => ['nullable', 'string', 'max:20'],
            'section' => ['nullable', 'string', 'max:50'],
        ]);

        $class = SchoolClass::query()->create([
            'name' => $validated['name'],
            'code' => $validated['code'] ?? null,
        ]);

        if (! empty($validated['section'])) {
            Section::query()->create([
                'school_class_id' => $class->getKey(),
                'name' => $validated['section'],
            ]);
        }

        return response()->json(['data' => $class->load('sections')], 201);
    }

    public function subjects(): JsonResponse
    {
        return response()->json(['data' => Subject::query()->orderBy('name')->get()]);
    }

    public function storeSubject(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => ['required', 'string', 'max:20'],
        ]);

        return response()->json(['data' => Subject::query()->create($validated)], 201);
    }

    public function attendance(Request $request): JsonResponse
    {
        $records = AttendanceRecord::query()
            ->with('student:id,first_name,last_name,admission_number')
            ->when($request->filled('date'), fn ($query) => $query->whereDate('attended_on', $request->string('date')))
            ->latest('attended_on')
            ->paginate(30);

        return response()->json($records);
    }

    public function storeAttendance(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'student_id' => ['required', 'integer'],
            'attended_on' => ['required', 'date'],
            'status' => ['required', Rule::in(['present', 'absent', 'late'])],
        ]);

        Student::query()->findOrFail($validated['student_id']);

        $record = AttendanceRecord::query()->updateOrCreate(
            [
                'student_id' => $validated['student_id'],
                'attended_on' => $validated['attended_on'],
            ],
            ['status' => $validated['status']],
        );

        return response()->json(['data' => $record->load('student:id,first_name,last_name,admission_number')]);
    }

    public function feeStructures(): JsonResponse
    {
        return response()->json(['data' => FeeStructure::query()->latest()->get()]);
    }

    public function storeFeeStructure(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'amount' => ['required', 'integer', 'min:1'],
            'school_class_id' => ['nullable', 'integer'],
        ]);

        return response()->json(['data' => FeeStructure::query()->create($validated)], 201);
    }

    public function invoices(): JsonResponse
    {
        return response()->json(
            Invoice::query()->with('student:id,first_name,last_name,admission_number')->latest()->paginate(15),
        );
    }

    public function storeInvoice(Request $request, FinanceService $finance): JsonResponse
    {
        $validated = $request->validate([
            'student_id' => ['required', 'integer'],
            'amount' => ['required', 'integer', 'min:1'],
            'issued_on' => ['required', 'date'],
            'due_on' => ['required', 'date', 'after_or_equal:issued_on'],
        ]);

        $actor = $request->user();
        abort_unless($actor instanceof User, 401);

        return response()->json(['data' => $finance->issueInvoice($validated, $actor)], 201);
    }

    public function storePayment(Request $request, int $invoice, FinanceService $finance): JsonResponse
    {
        $invoiceModel = Invoice::query()->findOrFail($invoice);
        $validated = $request->validate([
            'amount' => ['required', 'integer', 'min:1'],
            'paid_on' => ['required', 'date'],
            'method' => ['required', Rule::in(['cash', 'bank', 'online'])],
        ]);

        $actor = $request->user();
        abort_unless($actor instanceof User, 401);

        $payment = $finance->collect($invoiceModel, $validated['amount'], $validated['paid_on'], $validated['method'], $actor);

        return response()->json(['data' => $payment], 201);
    }

    public function reversePayment(Request $request, int $payment, FinanceService $finance): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:255'],
        ]);
        $record = \App\Models\Payment::query()->findOrFail($payment);
        $actor = $request->user();
        abort_unless($actor instanceof User, 401);

        return response()->json(['data' => $finance->reverse($record, $validated['reason'], $actor)]);
    }

    public function storeExpense(Request $request, FinanceService $finance): JsonResponse
    {
        $validated = $request->validate([
            'amount' => ['required', 'integer', 'min:1'],
            'spent_on' => ['required', 'date'],
            'paid_from' => ['required', \Illuminate\Validation\Rule::in(['cash', 'bank'])],
            'description' => ['required', 'string', 'max:255'],
        ]);
        $actor = $request->user();
        abort_unless($actor instanceof User, 401);
        $institutionId = app(\App\Services\InstitutionContext::class)->id();
        abort_if($institutionId === null, 403);

        return response()->json([
            'data' => $finance->recordExpense($institutionId, $validated['amount'], $validated['spent_on'], $validated['paid_from'], $validated['description'], $actor),
        ], 201);
    }

    public function payments(): JsonResponse
    {
        return response()->json(
            Payment::query()->with('invoice.student:id,first_name,last_name')->latest()->paginate(15),
        );
    }

    public function ledger(): JsonResponse
    {
        $entries = JournalEntry::query()->with('lines.account')->latest('entry_date')->limit(50)->get();

        return response()->json(['data' => $entries]);
    }

    public function institutionUsers(Request $request): JsonResponse
    {
        abort_unless($request->user()?->hasRole('institution-admin'), 403);
        $institutionId = app(\App\Services\InstitutionContext::class)->id();

        return response()->json([
            'data' => \App\Models\User::query()->where('institution_id', $institutionId)->get(['id', 'name', 'email', 'username']),
        ]);
    }

    public function institutionRoles(Request $request): JsonResponse
    {
        abort_unless($request->user()?->hasRole('institution-admin'), 403);
        $institutionId = app(\App\Services\InstitutionContext::class)->id();
        $roles = \Spatie\Permission\Models\Role::query()
            ->where('institution_id', $institutionId)
            ->with('permissions:id,name')
            ->get(['id', 'name', 'institution_id']);

        return response()->json(['data' => $roles]);
    }

    public function notices(): JsonResponse
    {
        return response()->json(['data' => Notice::query()->latest()->get()]);
    }

    public function storeNotice(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $notice = Notice::query()->create($validated + ['published_at' => now()]);

        return response()->json(['data' => $notice], 201);
    }
}
