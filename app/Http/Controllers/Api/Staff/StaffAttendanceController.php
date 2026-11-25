<?php

namespace App\Http\Controllers\Api\Staff;

use App\Http\Controllers\Controller;
use App\Models\Staff;
use App\Models\StaffAttendanceRecord;
use App\Models\StaffLeaveRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StaffAttendanceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $records = StaffAttendanceRecord::query()
            ->with('staff:id,employee_id,first_name,last_name')
            ->when($request->filled('date'), fn ($q) => $q->whereDate('attended_on', $request->string('date')->toString()))
            ->when($request->filled('staff_id'), fn ($q) => $q->where('staff_id', $request->integer('staff_id')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')->toString()))
            ->latest('attended_on')
            ->paginate(30);

        return response()->json($records);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'staff_id' => ['required', 'integer'],
            'attended_on' => ['required', 'date'],
            'status' => ['required', Rule::in(['present', 'absent', 'late', 'half_day'])],
            'check_in' => ['nullable', 'date_format:H:i,H:i:s'],
            'check_out' => ['nullable', 'date_format:H:i,H:i:s'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        Staff::query()->findOrFail($validated['staff_id']);

        $record = StaffAttendanceRecord::query()->updateOrCreate(
            ['staff_id' => $validated['staff_id'], 'attended_on' => $validated['attended_on']],
            [
                'status' => $validated['status'],
                'check_in' => $validated['check_in'] ?? null,
                'check_out' => $validated['check_out'] ?? null,
                'notes' => $validated['notes'] ?? null,
            ],
        );

        return response()->json(['data' => $record->load('staff:id,employee_id,first_name,last_name')]);
    }

    public function leaves(Request $request): JsonResponse
    {
        $leaves = StaffLeaveRequest::query()
            ->with('staff:id,employee_id,first_name,last_name')
            ->when($request->filled('staff_id'), fn ($q) => $q->where('staff_id', $request->integer('staff_id')))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')->toString()))
            ->latest()
            ->paginate(30);

        return response()->json($leaves);
    }

    public function storeLeave(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'staff_id' => ['required', 'integer'],
            'leave_type' => ['nullable', 'string', 'max:100'],
            'starts_on' => ['required', 'date'],
            'ends_on' => ['required', 'date', 'after_or_equal:starts_on'],
            'reason' => ['nullable', 'string', 'max:2000'],
        ]);

        Staff::query()->findOrFail($validated['staff_id']);

        $days = (int) \Carbon\Carbon::parse($validated['starts_on'])->diffInDays(\Carbon\Carbon::parse($validated['ends_on'])) + 1;

        $leave = StaffLeaveRequest::query()->create([
            ...$validated,
            'days' => $days,
            'status' => 'pending',
        ]);

        return response()->json(['data' => $leave->load('staff:id,employee_id,first_name,last_name')], 201);
    }

    public function reviewLeave(Request $request, StaffLeaveRequest $leave): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(['approved', 'rejected'])],
            'review_notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $leave->update([
            'status' => $validated['status'],
            'review_notes' => $validated['review_notes'] ?? null,
            'approved_by' => $request->user()?->getKey(),
            'approved_at' => now(),
        ]);

        if ($validated['status'] === 'approved') {
            $leave->staff?->update(['employment_status' => 'on_leave']);
        }

        return response()->json(['data' => $leave->fresh('staff:id,employee_id,first_name,last_name')]);
    }
}
