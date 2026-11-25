<?php

namespace App\Http\Controllers\Api\Staff;

use App\Http\Controllers\Controller;
use App\Http\Requests\Staff\StoreStaffRequest;
use App\Http\Requests\Staff\UpdateStaffRequest;
use App\Models\Staff;
use App\Models\StaffDocument;
use App\Models\StaffEmploymentHistory;
use App\Models\StaffSalaryStructure;
use App\Services\InstitutionContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class StaffController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = in_array((int) $request->integer('per_page', 10), [10, 25, 50, 100], true)
            ? (int) $request->integer('per_page', 10)
            : 10;

        $query = Staff::query()
            ->with(['department:id,name', 'designation:id,name'])
            ->when($request->filled('search'), function ($builder) use ($request): void {
                $search = '%'.$request->string('search')->toString().'%';
                $builder->where(function ($inner) use ($search): void {
                    $inner->where('first_name', 'like', $search)
                        ->orWhere('last_name', 'like', $search)
                        ->orWhere('middle_name', 'like', $search)
                        ->orWhere('employee_id', 'like', $search)
                        ->orWhere('personal_phone', 'like', $search)
                        ->orWhere('email', 'like', $search);
                });
            })
            ->when($request->filled('department_id'), fn ($builder) => $builder->where('department_id', $request->integer('department_id')))
            ->when($request->filled('designation_id'), fn ($builder) => $builder->where('designation_id', $request->integer('designation_id')))
            ->when($request->filled('employment_type'), fn ($builder) => $builder->where('employment_type', $request->string('employment_type')->toString()))
            ->when($request->filled('employment_status'), fn ($builder) => $builder->where('employment_status', $request->string('employment_status')->toString()))
            ->when($request->filled('joining_from'), fn ($builder) => $builder->whereDate('joining_date', '>=', $request->string('joining_from')->toString()))
            ->when($request->filled('joining_to'), fn ($builder) => $builder->whereDate('joining_date', '<=', $request->string('joining_to')->toString()))
            ->latest();

        $paginated = $query->paginate($perPage);

        $paginated->getCollection()->transform(fn (Staff $staff) => $this->formatStaff($staff, $request));

        return response()->json($paginated);
    }

    public function summary(Request $request): JsonResponse
    {
        $base = Staff::query();

        return response()->json([
            'data' => [
                'total' => (clone $base)->count(),
                'active' => (clone $base)->where('employment_status', 'active')->count(),
                'on_leave' => (clone $base)->where('employment_status', 'on_leave')->count(),
                'inactive' => (clone $base)->whereIn('employment_status', ['suspended', 'resigned', 'terminated'])->count(),
            ],
        ]);
    }

    public function store(StoreStaffRequest $request): JsonResponse
    {
        $validated = $request->validated();
        unset($validated['photo'], $validated['documents']);

        $validated['employee_id'] = $validated['employee_id'] ?? $this->nextEmployeeId();
        $validated['employment_status'] = $validated['employment_status'] ?? 'active';
        $validated['nationality'] = $validated['nationality'] ?? 'Nepali';

        $staff = Staff::query()->create($validated);
        $this->storePhoto($request, $staff);
        $this->storeDocuments($request, $staff);
        $this->recordHistory($staff, 'created', null, $staff->employment_status, $request);

        if ($this->canViewSalary($request) && $staff->basic_salary !== null) {
            $this->recordSalaryStructure($staff, $request);
        }

        return response()->json([
            'data' => $this->detail($staff->fresh(['department', 'designation', 'reportingManager']), $request),
        ], 201);
    }

    public function show(Request $request, Staff $staff): JsonResponse
    {
        $staff->load([
            'department:id,name',
            'designation:id,name',
            'reportingManager:id,first_name,middle_name,last_name,employee_id',
            'documents',
            'employmentHistories' => fn ($q) => $q->latest(),
            'salaryStructures' => fn ($q) => $q->latest('effective_date'),
            'attendanceRecords' => fn ($q) => $q->latest('attended_on')->limit(60),
            'leaveRequests' => fn ($q) => $q->latest()->limit(60),
        ]);

        return response()->json(['data' => $this->detail($staff, $request)]);
    }

    public function update(UpdateStaffRequest $request, Staff $staff): JsonResponse
    {
        $validated = $request->validated();
        unset($validated['photo']);

        $previousStatus = $staff->employment_status;
        $salaryChanged = $this->salaryChanged($staff, $validated);

        $staff->fill($validated);
        $staff->save();
        $this->storePhoto($request, $staff);

        if (($validated['employment_status'] ?? $previousStatus) !== $previousStatus) {
            $this->recordHistory($staff, 'status_changed', $previousStatus, $staff->employment_status, $request);
        } else {
            $this->recordHistory($staff, 'updated', $previousStatus, $staff->employment_status, $request);
        }

        if ($salaryChanged && $this->canViewSalary($request)) {
            $this->recordSalaryStructure($staff, $request);
        }

        return response()->json([
            'data' => $this->detail($staff->fresh(['department', 'designation', 'reportingManager']), $request),
        ]);
    }

    public function destroy(Request $request, Staff $staff): JsonResponse
    {
        $staff->update(['employment_status' => 'terminated']);
        $this->recordHistory($staff, 'archived', $staff->employment_status, 'terminated', $request);
        $staff->delete();

        return response()->json(['message' => 'Staff archived.']);
    }

    public function changeStatus(Request $request, Staff $staff): JsonResponse
    {
        $validated = $request->validate([
            'employment_status' => ['required', Rule::in(['active', 'on_leave', 'suspended', 'resigned', 'terminated'])],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $previous = $staff->employment_status;
        $staff->update(['employment_status' => $validated['employment_status']]);
        $this->recordHistory($staff, 'status_changed', $previous, $validated['employment_status'], $request, $validated['notes'] ?? null);

        return response()->json([
            'data' => $this->detail($staff->fresh(['department', 'designation', 'reportingManager']), $request),
        ]);
    }

    public function photo(Staff $staff): StreamedResponse
    {
        abort_unless($staff->photo_path && Storage::disk('local')->exists($staff->photo_path), 404);

        return Storage::disk('local')->response($staff->photo_path);
    }

    public function uploadDocument(Request $request, Staff $staff): JsonResponse
    {
        $validated = $request->validate([
            'type' => ['required', 'string', 'max:100'],
            'file' => ['required', 'file', 'max:10240'],
        ]);

        $file = $request->file('file');
        $path = $file->store('staff/'.$staff->institution_id.'/'.$staff->getKey().'/documents', 'local');

        $document = $staff->documents()->create([
            'type' => $validated['type'],
            'original_name' => $file->getClientOriginalName(),
            'file_path' => $path,
            'mime_type' => $file->getClientMimeType(),
            'file_size' => $file->getSize(),
        ]);

        return response()->json(['data' => $document], 201);
    }

    public function downloadDocument(Staff $staff, StaffDocument $document): StreamedResponse
    {
        abort_unless($document->staff_id === $staff->getKey(), 404);
        abort_unless(Storage::disk('local')->exists($document->file_path), 404);

        return Storage::disk('local')->download($document->file_path, $document->original_name);
    }

    public function destroyDocument(Staff $staff, StaffDocument $document): JsonResponse
    {
        abort_unless($document->staff_id === $staff->getKey(), 404);
        Storage::disk('local')->delete($document->file_path);
        $document->delete();

        return response()->json(['message' => 'Document deleted.']);
    }

    private function storePhoto(Request $request, Staff $staff): void
    {
        if (! $request->hasFile('photo')) {
            return;
        }

        if ($staff->photo_path) {
            Storage::disk('local')->delete($staff->photo_path);
        }

        $path = $request->file('photo')->store('staff/'.$staff->institution_id.'/'.$staff->getKey(), 'local');
        $staff->forceFill(['photo_path' => $path])->save();
    }

    private function storeDocuments(Request $request, Staff $staff): void
    {
        $documents = $request->file('documents', []);
        if (! is_array($documents)) {
            return;
        }

        foreach ($documents as $index => $entry) {
            $file = $entry['file'] ?? null;
            $type = $request->input("documents.$index.type", 'other');
            if (! $file) {
                continue;
            }
            $path = $file->store('staff/'.$staff->institution_id.'/'.$staff->getKey().'/documents', 'local');
            $staff->documents()->create([
                'type' => is_string($type) && $type !== '' ? $type : 'other',
                'original_name' => $file->getClientOriginalName(),
                'file_path' => $path,
                'mime_type' => $file->getClientMimeType(),
                'file_size' => $file->getSize(),
                'uploaded_by' => $request->user()?->getKey(),
            ]);
        }
    }

    private function recordHistory(Staff $staff, string $eventType, ?string $previousStatus, ?string $newStatus, Request $request, ?string $notes = null): void
    {
        StaffEmploymentHistory::query()->create([
            'staff_id' => $staff->getKey(),
            'event_type' => $eventType,
            'previous_status' => $previousStatus,
            'new_status' => $newStatus,
            'department_id' => $staff->department_id,
            'designation_id' => $staff->designation_id,
            'effective_date' => now()->toDateString(),
            'notes' => $notes,
            'recorded_by' => $request->user()?->getKey(),
        ]);
    }

    private function recordSalaryStructure(Staff $staff, Request $request): void
    {
        StaffSalaryStructure::query()->create([
            'staff_id' => $staff->getKey(),
            'basic_salary' => (int) ($staff->basic_salary ?? 0),
            'allowances' => (int) ($staff->allowances ?? 0),
            'deductions' => (int) ($staff->deductions ?? 0),
            'payment_frequency' => $staff->payment_frequency,
            'payment_method' => $staff->payment_method,
            'effective_date' => $staff->salary_effective_date ?? now()->toDateString(),
            'created_by' => $request->user()?->getKey(),
        ]);
    }

    private function salaryChanged(Staff $staff, array $validated): bool
    {
        foreach (['basic_salary', 'allowances', 'deductions', 'payment_frequency', 'payment_method', 'salary_effective_date'] as $field) {
            if (array_key_exists($field, $validated) && $staff->{$field} != $validated[$field]) {
                return true;
            }
        }

        return false;
    }

    private function canViewSalary(Request $request): bool
    {
        $user = $request->user();

        return $user !== null && ($user->can('staff.salary.view') || $user->can('finance.manage'));
    }

    private function nextEmployeeId(): string
    {
        $count = Staff::query()->withTrashed()->count() + 1;

        do {
            $code = 'EMP-'.str_pad((string) $count, 4, '0', STR_PAD_LEFT);
            $count++;
        } while (Staff::query()->withTrashed()->where('employee_id', $code)->exists());

        return $code;
    }

    /**
     * @return array<string, mixed>
     */
    private function formatStaff(Staff $staff, Request $request): array
    {
        $canSalary = $this->canViewSalary($request);

        return [
            'id' => $staff->getKey(),
            'employee_id' => $staff->employee_id,
            'first_name' => $staff->first_name,
            'middle_name' => $staff->middle_name,
            'last_name' => $staff->last_name,
            'photo_path' => $staff->photo_path,
            'gender' => $staff->gender,
            'personal_phone' => $staff->personal_phone,
            'email' => $staff->email,
            'department_id' => $staff->department_id,
            'designation_id' => $staff->designation_id,
            'department' => $staff->department ? ['id' => $staff->department->id, 'name' => $staff->department->name] : null,
            'designation' => $staff->designation ? ['id' => $staff->designation->id, 'name' => $staff->designation->name] : null,
            'employment_type' => $staff->employment_type,
            'employment_status' => $staff->employment_status,
            'joining_date' => optional($staff->joining_date)->toDateString(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function detail(Staff $staff, Request $request): array
    {
        $canSalary = $this->canViewSalary($request);

        $data = [
            'id' => $staff->getKey(),
            'employee_id' => $staff->employee_id,
            'first_name' => $staff->first_name,
            'middle_name' => $staff->middle_name,
            'last_name' => $staff->last_name,
            'photo_path' => $staff->photo_path,
            'gender' => $staff->gender,
            'date_of_birth' => optional($staff->date_of_birth)->toDateString(),
            'blood_group' => $staff->blood_group,
            'marital_status' => $staff->marital_status,
            'nationality' => $staff->nationality,
            'citizenship_number' => $staff->citizenship_number,
            'personal_phone' => $staff->personal_phone,
            'email' => $staff->email,
            'province' => $staff->province,
            'district' => $staff->district,
            'municipality' => $staff->municipality,
            'ward' => $staff->ward,
            'permanent_address' => $staff->permanent_address,
            'temporary_address' => $staff->temporary_address,
            'emergency_contact_number' => $staff->emergency_contact_number,
            'emergency_contact_name' => $staff->emergency_contact_name,
            'emergency_contact_relation' => $staff->emergency_contact_relation,
            'department_id' => $staff->department_id,
            'designation_id' => $staff->designation_id,
            'department' => $staff->department ? ['id' => $staff->department->id, 'name' => $staff->department->name] : null,
            'designation' => $staff->designation ? ['id' => $staff->designation->id, 'name' => $staff->designation->name] : null,
            'employment_type' => $staff->employment_type,
            'joining_date' => optional($staff->joining_date)->toDateString(),
            'probation_end_date' => optional($staff->probation_end_date)->toDateString(),
            'reporting_manager_id' => $staff->reporting_manager_id,
            'reporting_manager' => $staff->reportingManager ? [
                'id' => $staff->reportingManager->id,
                'name' => trim($staff->reportingManager->first_name.' '.($staff->reportingManager->middle_name ? $staff->reportingManager->middle_name.' ' : '').$staff->reportingManager->last_name),
                'employee_id' => $staff->reportingManager->employee_id,
            ] : null,
            'employment_status' => $staff->employment_status,
            'job_description' => $staff->job_description,
            'created_at' => optional($staff->created_at)?->toISOString(),
        ];

        if ($canSalary) {
            $data['basic_salary'] = $staff->basic_salary;
            $data['allowances'] = $staff->allowances;
            $data['deductions'] = $staff->deductions;
            $data['payment_frequency'] = $staff->payment_frequency;
            $data['payment_method'] = $staff->payment_method;
            $data['salary_effective_date'] = optional($staff->salary_effective_date)->toDateString();
            $data['salary_structures'] = $staff->relationLoaded('salaryStructures')
                ? $staff->salaryStructures->map(fn (StaffSalaryStructure $s) => [
                    'id' => $s->id,
                    'basic_salary' => $s->basic_salary,
                    'allowances' => $s->allowances,
                    'deductions' => $s->deductions,
                    'payment_frequency' => $s->payment_frequency,
                    'payment_method' => $s->payment_method,
                    'effective_date' => optional($s->effective_date)->toDateString(),
                    'end_date' => optional($s->end_date)->toDateString(),
                ])->values()
                : [];
        }

        $data['documents'] = $staff->relationLoaded('documents')
            ? $staff->documents->map(fn (StaffDocument $d) => [
                'id' => $d->id,
                'type' => $d->type,
                'original_name' => $d->original_name,
                'mime_type' => $d->mime_type,
                'file_size' => $d->file_size,
                'created_at' => optional($d->created_at)?->toISOString(),
            ])->values()
            : [];

        $data['employment_histories'] = $staff->relationLoaded('employmentHistories')
            ? $staff->employmentHistories->map(fn (StaffEmploymentHistory $h) => [
                'id' => $h->id,
                'event_type' => $h->event_type,
                'previous_status' => $h->previous_status,
                'new_status' => $h->new_status,
                'effective_date' => optional($h->effective_date)->toDateString(),
                'notes' => $h->notes,
            ])->values()
            : [];

        $data['attendance_records'] = $staff->relationLoaded('attendanceRecords')
            ? $staff->attendanceRecords->map(fn ($a) => [
                'id' => $a->id,
                'attended_on' => optional($a->attended_on)->toDateString(),
                'status' => $a->status,
                'check_in' => $a->check_in,
                'check_out' => $a->check_out,
            ])->values()
            : [];

        $data['leave_requests'] = $staff->relationLoaded('leaveRequests')
            ? $staff->leaveRequests->map(fn ($l) => [
                'id' => $l->id,
                'leave_type' => $l->leave_type,
                'starts_on' => optional($l->starts_on)->toDateString(),
                'ends_on' => optional($l->ends_on)->toDateString(),
                'days' => $l->days,
                'status' => $l->status,
                'reason' => $l->reason,
            ])->values()
            : [];

        return $data;
    }
}
