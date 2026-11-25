<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicSession;
use App\Models\ClassSubject;
use App\Models\Examination;
use App\Models\FeeCategory;
use App\Models\FeeStructure;
use App\Models\Mark;
use App\Models\PaymentMethod;
use App\Models\Scholarship;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Student;
use App\Models\Subject;
use App\Models\Teacher;
use App\Models\User;
use App\Services\InstitutionContext;
use App\Services\MarkCalculator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
            'exam_type' => ['required', Rule::in(['terminal', 'midterm', 'final', 'practical'])],
            'school_class_id' => ['required', 'integer'],
            'academic_session_id' => ['nullable', 'integer'],
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
