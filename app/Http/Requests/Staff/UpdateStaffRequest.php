<?php

namespace App\Http\Requests\Staff;

use App\Models\Staff;
use App\Services\InstitutionContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateStaffRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('staff.manage') ?? false;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $institutionId = app(InstitutionContext::class)->id();
        $staffParam = $this->route('staff');
        $ignoreId = $staffParam instanceof Staff ? $staffParam->getKey() : $staffParam;

        return [
            'employee_id' => [
                'sometimes',
                'required',
                'string',
                'max:50',
                Rule::unique('staff', 'employee_id')->where('institution_id', $institutionId)->ignore($ignoreId),
            ],
            'first_name' => ['sometimes', 'required', 'string', 'max:100'],
            'middle_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['sometimes', 'required', 'string', 'max:100'],
            'photo' => ['nullable', 'image', 'max:2048'],
            'gender' => ['nullable', Rule::in(['male', 'female', 'other'])],
            'date_of_birth' => ['nullable', 'date'],
            'blood_group' => ['nullable', 'string', 'max:10'],
            'marital_status' => ['nullable', 'string', 'max:30'],
            'nationality' => ['nullable', 'string', 'max:100'],
            'citizenship_number' => ['nullable', 'string', 'max:100'],

            'personal_phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:255'],
            'province' => ['nullable', 'string', 'max:100'],
            'district' => ['nullable', 'string', 'max:100'],
            'municipality' => ['nullable', 'string', 'max:100'],
            'ward' => ['nullable', 'string', 'max:20'],
            'permanent_address' => ['nullable', 'string', 'max:500'],
            'temporary_address' => ['nullable', 'string', 'max:500'],
            'emergency_contact_number' => ['nullable', 'string', 'max:30'],
            'emergency_contact_name' => ['nullable', 'string', 'max:150'],
            'emergency_contact_relation' => ['nullable', 'string', 'max:100'],

            'department_id' => ['nullable', 'integer', 'exists:staff_departments,id'],
            'designation_id' => ['nullable', 'integer', 'exists:staff_designations,id'],
            'employment_type' => ['nullable', Rule::in(['full-time', 'part-time', 'contract', 'temporary'])],
            'joining_date' => ['nullable', 'date'],
            'probation_end_date' => ['nullable', 'date'],
            'reporting_manager_id' => ['nullable', 'integer', 'exists:staff,id'],
            'employment_status' => ['nullable', Rule::in(['active', 'on_leave', 'suspended', 'resigned', 'terminated'])],
            'job_description' => ['nullable', 'string', 'max:5000'],

            'basic_salary' => ['nullable', 'integer', 'min:0'],
            'allowances' => ['nullable', 'integer', 'min:0'],
            'deductions' => ['nullable', 'integer', 'min:0'],
            'payment_frequency' => ['nullable', Rule::in(['monthly', 'biweekly', 'weekly'])],
            'payment_method' => ['nullable', Rule::in(['cash', 'bank', 'online'])],
            'salary_effective_date' => ['nullable', 'date'],
        ];
    }
}
