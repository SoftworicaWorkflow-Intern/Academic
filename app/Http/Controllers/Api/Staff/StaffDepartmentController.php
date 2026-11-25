<?php

namespace App\Http\Controllers\Api\Staff;

use App\Http\Controllers\Controller;
use App\Models\Staff;
use App\Models\StaffDepartment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StaffDepartmentController extends Controller
{
    public function index(): JsonResponse
    {
        $departments = StaffDepartment::query()
            ->withCount('staff')
            ->with('head:id,first_name,middle_name,last_name,employee_id')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $departments]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150', Rule::unique('staff_departments', 'name')->where('institution_id', app(\App\Services\InstitutionContext::class)->id())],
            'code' => ['nullable', 'string', 'max:30'],
            'head_staff_id' => ['nullable', 'integer'],
            'is_active' => ['boolean'],
        ]);

        if (! empty($validated['head_staff_id'])) {
            Staff::query()->findOrFail($validated['head_staff_id']);
        }

        $department = StaffDepartment::query()->create($validated);

        return response()->json(['data' => $department->load('head:id,first_name,middle_name,last_name,employee_id')->loadCount('staff')], 201);
    }

    public function update(Request $request, StaffDepartment $department): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150', Rule::unique('staff_departments', 'name')->where('institution_id', app(\App\Services\InstitutionContext::class)->id())->ignore($department->getKey())],
            'code' => ['nullable', 'string', 'max:30'],
            'head_staff_id' => ['nullable', 'integer'],
            'is_active' => ['boolean'],
        ]);

        if (! empty($validated['head_staff_id'])) {
            Staff::query()->findOrFail($validated['head_staff_id']);
        }

        $department->update($validated);

        return response()->json(['data' => $department->load('head:id,first_name,middle_name,last_name,employee_id')->loadCount('staff')]);
    }

    public function destroy(StaffDepartment $department): JsonResponse
    {
        $department->update(['is_active' => false]);

        return response()->json(['message' => 'Department deactivated.']);
    }
}
