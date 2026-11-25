<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicSession;
use App\Models\ClassSubject;
use App\Models\Examination;
use App\Models\ExaminationSubject;
use App\Models\FeeCategory;
use App\Models\FeeStructure;
use App\Models\GradingScale;
use App\Models\Mark;
use App\Models\PaymentMethod;
use App\Models\Scholarship;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\StudentEnrollment;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\TimetableEntry;
use App\Models\TimetablePeriod;
use App\Models\User;
use App\Services\InstitutionContext;
use App\Services\MarkCalculator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AcademicRecordController extends Controller
{
    public function updateClass(Request $request, int $schoolClass): JsonResponse
    {
        $class = SchoolClass::query()->findOrFail($schoolClass);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => ['nullable', 'string', 'max:20'],
            'academic_session_id' => ['nullable', 'integer'],
            'teacher_id' => ['nullable', 'integer'],
        ]);
        $this->assertSession($validated['academic_session_id'] ?? null);
        $this->assertTeacher($validated['teacher_id'] ?? null);
        $class->update($validated);

        return response()->json(['data' => $class->load('sections')]);
    }

    public function destroyClass(int $schoolClass): JsonResponse
    {
        $class = SchoolClass::query()->findOrFail($schoolClass);
        abort_if(Student::query()->where('school_class_id', $class->getKey())->exists(), 422, 'Move enrolled students before deleting this class.');
        $class->delete();

        return response()->json(['message' => 'Class deleted.']);
    }

    public function storeSection(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'school_class_id' => ['required', 'integer'],
            'name' => ['required', 'string', 'max:20'],
            'capacity' => ['nullable', 'integer', 'min:1'],
            'teacher_id' => ['nullable', 'integer'],
        ]);
        SchoolClass::query()->findOrFail($validated['school_class_id']);
        $this->assertTeacher($validated['teacher_id'] ?? null);

        return response()->json(['data' => Section::query()->create($validated)], 201);
    }

    public function updateSubject(Request $request, int $subject): JsonResponse
    {
        $record = Subject::query()->findOrFail($subject);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => ['required', 'string', 'max:20'],
            'subject_type' => ['required', Rule::in(['compulsory', 'optional'])],
            'full_marks' => ['required', 'integer', 'min:1'],
            'pass_marks' => ['required', 'integer', 'min:0'],
            'practical_full_marks' => ['nullable', 'integer', 'min:0'],
            'practical_pass_marks' => ['nullable', 'integer', 'min:0'],
        ]);
        $record->update($validated);

        return response()->json(['data' => $record]);
    }

    public function assignSubject(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'school_class_id' => ['required', 'integer'],
            'subject_id' => ['required', 'integer'],
            'academic_session_id' => ['nullable', 'integer'],
            'teacher_id' => ['nullable', 'integer'],
            'full_marks' => ['required', 'integer', 'min:1'],
            'pass_marks' => ['required', 'integer', 'min:0', 'lte:full_marks'],
            'practical_full_marks' => ['nullable', 'integer', 'min:0'],
            'practical_pass_marks' => ['nullable', 'integer', 'min:0'],
        ]);
        SchoolClass::query()->findOrFail($validated['school_class_id']);
        Subject::query()->findOrFail($validated['subject_id']);
        $this->assertSession($validated['academic_session_id'] ?? null);
        $this->assertTeacher($validated['teacher_id'] ?? null);

        $assignment = ClassSubject::query()->updateOrCreate(
            [
                'school_class_id' => $validated['school_class_id'],
                'subject_id' => $validated['subject_id'],
                'academic_session_id' => $validated['academic_session_id'] ?? null,
            ],
            $validated,
        );

        return response()->json(['data' => $assignment->load(['subject', 'teacher'])]);
    }

    public function classStudents(int $schoolClass): JsonResponse
    {
        SchoolClass::query()->findOrFail($schoolClass);

        return response()->json([
            'data' => Student::query()->where('school_class_id', $schoolClass)->orderBy('roll_number')->get(),
        ]);
    }

    public function enroll(Request $request, int $student): JsonResponse
    {
        $record = Student::query()->findOrFail($student);
        $validated = $request->validate([
            'school_class_id' => ['required', 'integer'],
            'section_id' => ['nullable', 'integer'],
            'roll_number' => ['nullable', 'string', 'max:50'],
        ]);
        SchoolClass::query()->findOrFail($validated['school_class_id']);

        if (! empty($validated['section_id'])) {
            $section = Section::query()->findOrFail($validated['section_id']);
            if ($section->school_class_id !== (int) $validated['school_class_id']) {
                throw ValidationException::withMessages([
                    'section_id' => 'This section does not belong to the selected class.',
                ]);
            }
            if ($section->capacity !== null) {
                $count = Student::query()->where('section_id', $section->getKey())->whereKeyNot($record->getKey())->count();
                if ($count >= $section->capacity) {
                    throw ValidationException::withMessages([
                        'section_id' => 'This section is at capacity.',
                    ]);
                }
            }
        }

        $record->update($validated);

        return response()->json(['data' => $record->load('schoolClass')]);
    }

    public function feeCategories(): JsonResponse
    {
        return response()->json(['data' => FeeCategory::query()->orderBy('name')->get()]);
    }

    public function storeFeeCategory(Request $request): JsonResponse
    {
        $validated = $this->categoryRules($request);
        $category = FeeCategory::query()->create($validated);

        return response()->json(['data' => $category], 201);
    }

    public function updateFeeCategory(Request $request, int $feeCategory): JsonResponse
    {
        $category = FeeCategory::query()->findOrFail($feeCategory);
        $category->update($this->categoryRules($request));

        return response()->json(['data' => $category]);
    }

    public function scholarships(): JsonResponse
    {
        return response()->json(['data' => Scholarship::query()->latest()->get()]);
    }

    public function storeScholarship(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'discount_type' => ['required', Rule::in(['percent', 'fixed'])],
            'value' => ['required', 'integer', 'min:1'],
        ]);

        return response()->json(['data' => Scholarship::query()->create($validated)], 201);
    }

    public function paymentMethods(): JsonResponse
    {
        return response()->json(['data' => PaymentMethod::query()->orderBy('name')->get()]);
    }

    public function updatePaymentMethod(Request $request, int $paymentMethod): JsonResponse
    {
        $method = PaymentMethod::query()->findOrFail($paymentMethod);
        $validated = $request->validate(['enabled' => ['required', 'boolean']]);
        $method->update($validated);

        return response()->json(['data' => $method]);
    }

    public function storeFeePlan(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'amount' => ['required', 'integer', 'min:1'],
            'school_class_id' => ['nullable', 'integer'],
            'academic_session_id' => ['nullable', 'integer'],
            'fee_category_id' => ['nullable', 'integer'],
            'billing_type' => ['required', Rule::in(['one_time', 'recurring'])],
            'due_day' => ['nullable', 'integer', 'between:1,28'],
        ]);

        if (! empty($validated['school_class_id'])) {
            SchoolClass::query()->findOrFail($validated['school_class_id']);
        }
        $this->assertSession($validated['academic_session_id'] ?? null);
        if (! empty($validated['fee_category_id'])) {
            FeeCategory::query()->findOrFail($validated['fee_category_id']);
        }

        return response()->json(['data' => FeeStructure::query()->create($validated)], 201);
    }

    public function examinations(): JsonResponse
    {
        return response()->json(['data' => Examination::query()->with('schoolClass:id,name')->latest()->get()]);
    }

    public function storeExamination(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => ['nullable', 'string', 'max:30'],
            'exam_type' => ['required', Rule::in(['terminal', 'midterm', 'final', 'practical', 'unit_test', 'board'])],
            'school_class_id' => ['required', 'integer'],
            'academic_session_id' => ['nullable', 'integer'],
            'description' => ['nullable', 'string'],
            'starts_on' => ['nullable', 'date'],
            'ends_on' => ['nullable', 'date', 'after_or_equal:starts_on'],
            'result_publication_on' => ['nullable', 'date'],
            'status' => ['nullable', 'string', 'max:30'],
        ]);
        SchoolClass::query()->findOrFail($validated['school_class_id']);
        $this->assertSession($validated['academic_session_id'] ?? null);

        return response()->json(['data' => Examination::query()->create($validated)], 201);
    }

    public function storeMarks(Request $request, int $examination, MarkCalculator $calculator): JsonResponse
    {
        $exam = Examination::query()->findOrFail($examination);
        abort_if($exam->published_at !== null && ! $request->user()?->can('marks.publish'), 403);

        $validated = $request->validate([
            'student_id' => ['required', 'integer'],
            'subject_id' => ['required', 'integer'],
            'theory_marks' => ['required', 'integer', 'min:0'],
            'practical_marks' => ['nullable', 'integer', 'min:0'],
        ]);

        $student = Student::query()->findOrFail($validated['student_id']);
        abort_unless($student->school_class_id === $exam->school_class_id, 422, 'This student is not enrolled in the examination class.');

        $assignment = ClassSubject::query()
            ->where('school_class_id', $exam->school_class_id)
            ->where('subject_id', $validated['subject_id'])
            ->firstOrFail();

        $practical = (int) ($validated['practical_marks'] ?? 0);
        if ($validated['theory_marks'] > $assignment->full_marks || $practical > $assignment->practical_full_marks) {
            throw ValidationException::withMessages([
                'theory_marks' => 'Marks cannot exceed the configured full marks.',
            ]);
        }

        $mark = Mark::query()->updateOrCreate(
            [
                'examination_id' => $exam->getKey(),
                'student_id' => $student->getKey(),
                'subject_id' => $validated['subject_id'],
            ],
            [
                'theory_marks' => $validated['theory_marks'],
                'practical_marks' => $practical,
                'workflow_status' => 'draft',
                'entered_by' => $request->user()?->getKey(),
            ],
        );

        $score = $calculator->score([
            'theory_marks' => $mark->theory_marks,
            'practical_marks' => $mark->practical_marks,
            'full_marks' => $assignment->full_marks,
            'pass_marks' => $assignment->pass_marks,
            'practical_full_marks' => $assignment->practical_full_marks,
            'practical_pass_marks' => $assignment->practical_pass_marks,
        ]);

        return response()->json(['data' => ['mark' => $mark->load('subject'), 'result' => $score]]);
    }

    public function results(int $examination, MarkCalculator $calculator): JsonResponse
    {
        $exam = Examination::query()->with('schoolClass')->findOrFail($examination);
        $assignments = ClassSubject::query()->where('school_class_id', $exam->school_class_id)->get()->keyBy('subject_id');
        $marks = Mark::query()->with(['student', 'subject'])->where('examination_id', $exam->getKey())->get();

        $rows = $marks->groupBy('student_id')->map(function ($studentMarks) use ($calculator, $assignments) {
            $scored = $studentMarks->map(function (Mark $mark) use ($calculator, $assignments) {
                $assignment = $assignments->get($mark->subject_id);

                return [
                    'subject' => $mark->subject?->name,
                    'theory_marks' => $mark->theory_marks,
                    'practical_marks' => $mark->practical_marks,
                    'result' => $assignment === null ? null : $calculator->score([
                        'theory_marks' => $mark->theory_marks,
                        'practical_marks' => $mark->practical_marks,
                        'full_marks' => $assignment->full_marks,
                        'pass_marks' => $assignment->pass_marks,
                        'practical_full_marks' => $assignment->practical_full_marks,
                        'practical_pass_marks' => $assignment->practical_pass_marks,
                    ]),
                ];
            })->values();
            $student = $studentMarks->first()?->student;

            return [
                'student' => $student === null ? null : $student->only(['id', 'first_name', 'last_name', 'admission_number', 'roll_number']),
                'subjects' => $scored,
                'total' => $scored->sum(fn (array $row): int => (int) ($row['result']['total'] ?? 0)),
                'maximum' => $scored->sum(fn (array $row): int => (int) ($row['result']['maximum'] ?? 0)),
            ];
        })->values();

        return response()->json([
            'data' => [
                'examination' => $exam,
                'published' => $exam->published_at !== null,
                'students' => $rows,
            ],
        ]);
    }

    public function publish(Request $request, int $examination): JsonResponse
    {
        $exam = Examination::query()->findOrFail($examination);
        $exam->update(['published_at' => $request->boolean('published', true) ? now() : null]);

        return response()->json(['data' => $exam]);
    }

    public function sessions(Request $request): JsonResponse
    {
        $sessions = AcademicSession::query()
            ->withCount('studentEnrollments')
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('search'), fn ($q) => $q->where(function ($qq) use ($request): void {
                $s = $request->string('search')->toString();
                $qq->where('name', 'like', "%{$s}%")->orWhere('code', 'like', "%{$s}%");
            }))
            ->orderByDesc('is_current')->orderByDesc('starts_on')->paginate($request->integer('per_page', 10));

        return response()->json($sessions);
    }

    public function storeSession(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => ['nullable', 'string', 'max:30'],
            'starts_on' => ['required', 'date'],
            'registration_starts_on' => ['nullable', 'date'],
            'registration_ends_on' => ['nullable', 'date', 'after_or_equal:registration_starts_on'],
            'ends_on' => ['required', 'date', 'after_or_equal:starts_on'],
            'description' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['upcoming', 'active', 'completed', 'archived'])],
            'is_current' => ['sometimes', 'boolean'],
        ]);
        $validated['status'] = $validated['status'] ?? ($validated['is_current'] ?? false ? 'active' : 'upcoming');
        $session = DB::transaction(function () use ($validated) {
            if (! empty($validated['is_current'])) {
                AcademicSession::query()->update(['is_current' => false, 'status' => DB::raw("CASE WHEN status='archived' THEN status ELSE 'completed' END")]);
            }
            return AcademicSession::query()->create($validated);
        });

        return response()->json(['data' => $session], 201);
    }

    public function updateSession(Request $request, int $academicSession): JsonResponse
    {
        $session = AcademicSession::query()->findOrFail($academicSession);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => ['nullable', 'string', 'max:30'],
            'starts_on' => ['required', 'date'],
            'registration_starts_on' => ['nullable', 'date'],
            'registration_ends_on' => ['nullable', 'date', 'after_or_equal:registration_starts_on'],
            'ends_on' => ['required', 'date', 'after_or_equal:starts_on'],
            'description' => ['nullable', 'string'],
            'status' => ['nullable', Rule::in(['upcoming', 'active', 'completed', 'archived'])],
            'is_current' => ['sometimes', 'boolean'],
        ]);
        DB::transaction(function () use ($session, $validated): void {
            if (! empty($validated['is_current'])) {
                AcademicSession::query()->whereKeyNot($session->getKey())->update(['is_current' => false]);
            }
            $session->update($validated);
        });

        return response()->json(['data' => $session->fresh()]);
    }

    public function archiveSession(int $academicSession): JsonResponse
    {
        $session = AcademicSession::query()->findOrFail($academicSession);
        $session->update(['status' => 'archived', 'archived_at' => now(), 'is_current' => false]);

        return response()->json(['data' => $session]);
    }

    public function setCurrentSession(int $academicSession): JsonResponse
    {
        $session = AcademicSession::query()->findOrFail($academicSession);
        DB::transaction(function () use ($session): void {
            AcademicSession::query()->update(['is_current' => false]);
            $session->update(['is_current' => true, 'status' => 'active', 'archived_at' => null]);
        });

        return response()->json(['data' => $session->fresh()]);
    }

    public function timetablePeriods(Request $request): JsonResponse
    {
        $periods = TimetablePeriod::query()
            ->when($request->filled('academic_session_id'), fn ($q) => $q->where('academic_session_id', $request->integer('academic_session_id')))
            ->orderBy('period_number')->get();

        return response()->json(['data' => $periods]);
    }

    public function storeTimetablePeriod(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'academic_session_id' => ['nullable', 'integer'],
            'name' => ['required', 'string', 'max:100'],
            'period_number' => ['required', 'integer', 'min:1'],
            'starts_at' => ['required'],
            'ends_at' => ['required'],
            'type' => ['required', Rule::in(['class', 'break', 'lunch', 'assembly'])],
            'working_days' => ['nullable', 'array'],
        ]);
        $this->assertSession($validated['academic_session_id'] ?? null);
        $period = TimetablePeriod::query()->create($validated);

        return response()->json(['data' => $period], 201);
    }

    public function updateTimetablePeriod(Request $request, int $timetablePeriod): JsonResponse
    {
        $period = TimetablePeriod::query()->findOrFail($timetablePeriod);
        $validated = $request->validate([
            'academic_session_id' => ['nullable', 'integer'],
            'name' => ['required', 'string', 'max:100'],
            'period_number' => ['required', 'integer', 'min:1'],
            'starts_at' => ['required'],
            'ends_at' => ['required'],
            'type' => ['required', Rule::in(['class', 'break', 'lunch', 'assembly'])],
            'working_days' => ['nullable', 'array'],
        ]);
        $period->update($validated);

        return response()->json(['data' => $period]);
    }

    public function destroyTimetablePeriod(int $timetablePeriod): JsonResponse
    {
        TimetablePeriod::query()->findOrFail($timetablePeriod)->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    public function timetableEntries(Request $request): JsonResponse
    {
        $entries = TimetableEntry::query()
            ->with(['schoolClass', 'section', 'subject', 'teacher.user', 'period', 'academicSession'])
            ->when($request->filled('academic_session_id'), fn ($q) => $q->where('academic_session_id', $request->integer('academic_session_id')))
            ->when($request->filled('school_class_id'), fn ($q) => $q->where('school_class_id', $request->integer('school_class_id')))
            ->when($request->filled('section_id'), fn ($q) => $q->where('section_id', $request->integer('section_id')))
            ->when($request->filled('teacher_id'), fn ($q) => $q->where('teacher_id', $request->integer('teacher_id')))
            ->orderBy('day_of_week')->orderBy('period_number')->get();

        return response()->json(['data' => $entries]);
    }

    public function storeTimetableEntry(Request $request): JsonResponse
    {
        $validated = $this->validateTimetableEntry($request);
        $this->assertTimetableConflicts($validated);
        $entry = TimetableEntry::query()->create($validated);

        return response()->json(['data' => $entry->load(['schoolClass', 'section', 'subject', 'teacher.user', 'period'])], 201);
    }

    public function updateTimetableEntry(Request $request, int $timetableEntry): JsonResponse
    {
        $entry = TimetableEntry::query()->findOrFail($timetableEntry);
        $validated = $this->validateTimetableEntry($request);
        $this->assertTimetableConflicts($validated, $entry->getKey());
        $entry->update($validated);

        return response()->json(['data' => $entry->fresh(['schoolClass', 'section', 'subject', 'teacher.user', 'period'])]);
    }

    public function destroyTimetableEntry(int $timetableEntry): JsonResponse
    {
        TimetableEntry::query()->findOrFail($timetableEntry)->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    public function examinationSubjects(Request $request, int $examination): JsonResponse
    {
        Examination::query()->findOrFail($examination);
        $rows = ExaminationSubject::query()->with(['subject', 'schoolClass', 'section'])
            ->where('examination_id', $examination)->orderBy('exam_date')->orderBy('starts_at')->get();
        return response()->json(['data' => $rows]);
    }

    public function storeExaminationSubject(Request $request, int $examination): JsonResponse
    {
        $exam = Examination::query()->findOrFail($examination);
        $validated = $request->validate([
            'school_class_id' => ['required', 'integer'],
            'section_id' => ['nullable', 'integer'],
            'subject_id' => ['required', 'integer'],
            'exam_date' => ['nullable', 'date'],
            'starts_at' => ['nullable'],
            'ends_at' => ['nullable'],
            'full_marks' => ['required', 'integer', 'min:0'],
            'pass_marks' => ['required', 'integer', 'min:0'],
            'theory_marks' => ['required', 'integer', 'min:0'],
            'practical_marks' => ['nullable', 'integer', 'min:0'],
            'room' => ['nullable', 'string', 'max:100'],
        ]);
        SchoolClass::query()->findOrFail($validated['school_class_id']);
        Subject::query()->findOrFail($validated['subject_id']);
        if (! empty($validated['section_id'])) { Section::query()->findOrFail($validated['section_id']); }
        $validated['examination_id'] = $exam->getKey();
        $row = ExaminationSubject::query()->updateOrCreate(
            [
                'examination_id' => $exam->getKey(),
                'school_class_id' => $validated['school_class_id'],
                'section_id' => $validated['section_id'] ?? null,
                'subject_id' => $validated['subject_id'],
            ],
            $validated
        );

        return response()->json(['data' => $row->load(['subject', 'schoolClass', 'section'])], 201);
    }

    public function destroyExaminationSubject(int $examinationSubject): JsonResponse
    {
        ExaminationSubject::query()->findOrFail($examinationSubject)->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    public function gradingScales(Request $request): JsonResponse
    {
        $scales = GradingScale::query()
            ->when($request->filled('academic_session_id'), fn ($q) => $q->where('academic_session_id', $request->integer('academic_session_id')))
            ->orderByDesc('is_default')->orderBy('name')->get();
        return response()->json(['data' => $scales]);
    }

    public function storeGradingScale(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'academic_session_id' => ['nullable', 'integer'],
            'examination_id' => ['nullable', 'integer'],
            'name' => ['required', 'string', 'max:100'],
            'rules' => ['required', 'array', 'min:1'],
            'rules.*.grade' => ['required', 'string', 'max:10'],
            'rules.*.min_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'rules.*.max_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'rules.*.grade_point' => ['nullable', 'numeric', 'min:0'],
            'rules.*.remarks' => ['nullable', 'string', 'max:100'],
            'is_default' => ['sometimes', 'boolean'],
        ]);
        $this->assertSession($validated['academic_session_id'] ?? null);
        if (! empty($validated['examination_id'])) { Examination::query()->findOrFail($validated['examination_id']); }
        $scale = DB::transaction(function () use ($validated) {
            if (! empty($validated['is_default'])) {
                GradingScale::query()->update(['is_default' => false]);
            }
            return GradingScale::query()->create($validated);
        });
        return response()->json(['data' => $scale], 201);
    }

    public function updateGradingScale(Request $request, int $gradingScale): JsonResponse
    {
        $scale = GradingScale::query()->findOrFail($gradingScale);
        $validated = $request->validate([
            'academic_session_id' => ['nullable', 'integer'],
            'examination_id' => ['nullable', 'integer'],
            'name' => ['required', 'string', 'max:100'],
            'rules' => ['required', 'array', 'min:1'],
            'rules.*.grade' => ['required', 'string', 'max:10'],
            'rules.*.min_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'rules.*.max_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'rules.*.grade_point' => ['nullable', 'numeric', 'min:0'],
            'rules.*.remarks' => ['nullable', 'string', 'max:100'],
            'is_default' => ['sometimes', 'boolean'],
        ]);
        DB::transaction(function () use ($scale, $validated): void {
            if (! empty($validated['is_default'])) {
                GradingScale::query()->whereKeyNot($scale->getKey())->update(['is_default' => false]);
            }
            $scale->update($validated);
        });
        return response()->json(['data' => $scale->fresh()]);
    }

    public function destroyGradingScale(int $gradingScale): JsonResponse
    {
        GradingScale::query()->findOrFail($gradingScale)->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    public function markWorkflow(Request $request, int $examination): JsonResponse
    {
        $exam = Examination::query()->findOrFail($examination);
        $validated = $request->validate([
            'action' => ['required', Rule::in(['submit', 'approve', 'publish', 'lock', 'reopen'])],
            'student_ids' => ['nullable', 'array'],
            'student_ids.*' => ['integer'],
        ]);
        $query = Mark::query()->where('examination_id', $exam->getKey());
        if (! empty($validated['student_ids'])) {
            $query->whereIn('student_id', $validated['student_ids']);
        }
        $now = now();
        $userId = $request->user()?->getKey();
        $updates = match ($validated['action']) {
            'submit' => ['workflow_status' => 'submitted', 'submitted_at' => $now, 'entered_by' => $userId],
            'approve' => ['workflow_status' => 'approved', 'approved_at' => $now, 'approved_by' => $userId],
            'publish' => ['workflow_status' => 'published', 'published_at' => $now],
            'lock' => ['workflow_status' => 'locked', 'locked_at' => $now],
            'reopen' => ['workflow_status' => 'draft', 'submitted_at' => null, 'approved_at' => null, 'published_at' => null, 'locked_at' => null],
        };
        if ($validated['action'] === 'publish') {
            $exam->update(['published_at' => $now, 'status' => 'published']);
        }
        if ($validated['action'] === 'reopen') {
            $exam->update(['published_at' => null, 'status' => 'completed']);
        }
        $query->update($updates);

        return response()->json(['message' => 'Workflow updated.', 'data' => $exam->fresh()]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validateTimetableEntry(Request $request): array
    {
        $validated = $request->validate([
            'academic_session_id' => ['nullable', 'integer'],
            'school_class_id' => ['required', 'integer'],
            'section_id' => ['nullable', 'integer'],
            'subject_id' => ['nullable', 'integer'],
            'teacher_id' => ['nullable', 'integer'],
            'timetable_period_id' => ['nullable', 'integer'],
            'day_of_week' => ['required', Rule::in(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])],
            'period_number' => ['nullable', 'integer', 'min:1'],
            'classroom' => ['nullable', 'string', 'max:100'],
            'starts_at' => ['nullable'],
            'ends_at' => ['nullable'],
            'timetable_type' => ['nullable', Rule::in(['regular', 'exam', 'temporary'])],
        ]);
        SchoolClass::query()->findOrFail($validated['school_class_id']);
        $this->assertSession($validated['academic_session_id'] ?? null);
        if (! empty($validated['section_id'])) { Section::query()->findOrFail($validated['section_id']); }
        if (! empty($validated['subject_id'])) { Subject::query()->findOrFail($validated['subject_id']); }
        $this->assertTeacher($validated['teacher_id'] ?? null);
        if (! empty($validated['timetable_period_id'])) { TimetablePeriod::query()->findOrFail($validated['timetable_period_id']); }
        $validated['timetable_type'] = $validated['timetable_type'] ?? 'regular';
        return $validated;
    }

    /**
     * @param array<string, mixed> $validated
     */
    private function assertTimetableConflicts(array $validated, ?int $ignoreId = null): void
    {
        $base = TimetableEntry::query()
            ->when($ignoreId, fn ($q) => $q->whereKeyNot($ignoreId))
            ->where('day_of_week', $validated['day_of_week'])
            ->when(! empty($validated['timetable_period_id']), fn ($q) => $q->where('timetable_period_id', $validated['timetable_period_id']))
            ->when(empty($validated['timetable_period_id']) && ! empty($validated['period_number']), fn ($q) => $q->where('period_number', $validated['period_number']));

        $sectionConflict = (clone $base)->where('school_class_id', $validated['school_class_id'])
            ->when(! empty($validated['section_id']), fn ($q) => $q->where('section_id', $validated['section_id']))->exists();
        if ($sectionConflict) {
            throw ValidationException::withMessages(['day_of_week' => 'This class/section already has an entry for the selected period.']);
        }
        if (! empty($validated['teacher_id'])) {
            $teacherConflict = (clone $base)->where('teacher_id', $validated['teacher_id'])->exists();
            if ($teacherConflict) {
                throw ValidationException::withMessages(['teacher_id' => 'Teacher is already assigned for this period.']);
            }
        }
        if (! empty($validated['classroom'])) {
            $roomConflict = (clone $base)->where('classroom', $validated['classroom'])->exists();
            if ($roomConflict) {
                throw ValidationException::withMessages(['classroom' => 'Classroom is already booked for this period.']);
            }
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function categoryRules(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => ['required', 'string', 'max:30'],
            'kind' => ['required', Rule::in(['admission', 'tuition', 'examination', 'transport', 'hostel', 'library', 'laboratory', 'fine', 'other'])],
            'billing_type' => ['required', Rule::in(['one_time', 'recurring'])],
            'default_amount' => ['required', 'integer', 'min:0'],
            'fine_amount' => ['nullable', 'integer', 'min:0'],
            'due_day' => ['nullable', 'integer', 'between:1,28'],
        ]);
    }

    private function assertTeacher(?int $teacherId): void
    {
        if ($teacherId !== null) {
            Teacher::query()->findOrFail($teacherId);
        }
    }

    private function assertSession(?int $sessionId): void
    {
        if ($sessionId !== null) {
            AcademicSession::query()->findOrFail($sessionId);
        }
    }
}
