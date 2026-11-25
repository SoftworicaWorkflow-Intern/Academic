<?php

namespace App\Http\Controllers\Api\Staff;

use App\Http\Controllers\Controller;
use App\Models\StaffDesignation;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StaffDesignationController extends Controller
{
    public function index(): JsonResponse
    {
        $designations = StaffDesignation::query()
            ->withCount('staff')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $designations]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150', Rule::unique('staff_designations', 'name')->where('institution_id', app(\App\Services\InstitutionContext::class)->id())],
            'code' => ['nullable', 'string', 'max:30'],
            'is_active' => ['boolean'],
        ]);

        $designation = StaffDesignation::query()->create($validated);

        return response()->json(['data' => $designation->loadCount('staff')], 201);
    }

    public function update(Request $request, StaffDesignation $designation): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150', Rule::unique('staff_designations', 'name')->where('institution_id', app(\App\Services\InstitutionContext::class)->id())->ignore($designation->getKey())],
            'code' => ['nullable', 'string', 'max:30'],
            'is_active' => ['boolean'],
        ]);

        $designation->update($validated);

        return response()->json(['data' => $designation->loadCount('staff')]);
    }

    public function destroy(StaffDesignation $designation): JsonResponse
    {
        $designation->update(['is_active' => false]);

        return response()->json(['message' => 'Designation deactivated.']);
    }
}
