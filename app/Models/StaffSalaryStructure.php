<?php

namespace App\Models;

use App\Models\Concerns\BelongsToInstitution;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'institution_id',
    'staff_id',
    'basic_salary',
    'allowances',
    'deductions',
    'payment_frequency',
    'payment_method',
    'effective_date',
    'end_date',
    'created_by',
])]
class StaffSalaryStructure extends Model
{
    use BelongsToInstitution;

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'basic_salary' => 'integer',
            'allowances' => 'integer',
            'deductions' => 'integer',
            'effective_date' => 'date',
            'end_date' => 'date',
        ];
    }

    /**
     * @return BelongsTo<Staff, $this>
     */
    public function staff(): BelongsTo
    {
        return $this->belongsTo(Staff::class);
    }
}
