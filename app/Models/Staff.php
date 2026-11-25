<?php

namespace App\Models;

use App\Models\Concerns\BelongsToInstitution;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'institution_id',
    'employee_id',
    'first_name',
    'middle_name',
    'last_name',
    'photo_path',
    'gender',
    'date_of_birth',
    'blood_group',
    'marital_status',
    'nationality',
    'citizenship_number',
    'personal_phone',
    'email',
    'province',
    'district',
    'municipality',
    'ward',
    'permanent_address',
    'temporary_address',
    'emergency_contact_number',
    'emergency_contact_name',
    'emergency_contact_relation',
    'department_id',
    'designation_id',
    'employment_type',
    'joining_date',
    'probation_end_date',
    'reporting_manager_id',
    'employment_status',
    'job_description',
    'basic_salary',
    'allowances',
    'deductions',
    'payment_frequency',
    'payment_method',
    'salary_effective_date',
])]
class Staff extends Model
{
    use BelongsToInstitution, SoftDeletes;

    protected $table = 'staff';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'joining_date' => 'date',
            'probation_end_date' => 'date',
            'salary_effective_date' => 'date',
            'basic_salary' => 'integer',
            'allowances' => 'integer',
            'deductions' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<StaffDepartment, $this>
     */
    public function department(): BelongsTo
    {
        return $this->belongsTo(StaffDepartment::class, 'department_id');
    }

    /**
     * @return BelongsTo<StaffDesignation, $this>
     */
    public function designation(): BelongsTo
    {
        return $this->belongsTo(StaffDesignation::class, 'designation_id');
    }

    /**
     * @return BelongsTo<Staff, $this>
     */
    public function reportingManager(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reporting_manager_id');
    }

    /**
     * @return HasMany<StaffDocument, $this>
     */
    public function documents(): HasMany
    {
        return $this->hasMany(StaffDocument::class);
    }

    /**
     * @return HasMany<StaffEmergencyContact, $this>
     */
    public function emergencyContacts(): HasMany
    {
        return $this->hasMany(StaffEmergencyContact::class);
    }

    /**
     * @return HasMany<StaffEmploymentHistory, $this>
     */
    public function employmentHistories(): HasMany
    {
        return $this->hasMany(StaffEmploymentHistory::class);
    }

    /**
     * @return HasMany<StaffSalaryStructure, $this>
     */
    public function salaryStructures(): HasMany
    {
        return $this->hasMany(StaffSalaryStructure::class);
    }

    /**
     * @return HasMany<StaffAttendanceRecord, $this>
     */
    public function attendanceRecords(): HasMany
    {
        return $this->hasMany(StaffAttendanceRecord::class);
    }

    /**
     * @return HasMany<StaffLeaveRequest, $this>
     */
    public function leaveRequests(): HasMany
    {
        return $this->hasMany(StaffLeaveRequest::class);
    }
}
