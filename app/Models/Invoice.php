<?php

namespace App\Models;

use App\Models\Concerns\BelongsToInstitution;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'institution_id',
    'student_id',
    'fee_structure_id',
    'fee_category_id',
    'school_class_id',
    'academic_session_id',
    'number',
    'description',
    'issued_on',
    'due_on',
    'period_on',
    'amount',
    'base_amount',
    'discount_amount',
    'late_fee_amount',
    'paid_amount',
    'status',
    'cancelled_at',
    'cancellation_reason',
])]
class Invoice extends Model
{
    use BelongsToInstitution;

    protected $appends = ['balance_due', 'display_status'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'issued_on' => 'date',
            'due_on' => 'date',
            'cancelled_at' => 'datetime',
        ];
    }

    public function getBalanceDueAttribute(): int
    {
        return max(0, $this->amount - $this->paid_amount);
    }

    public function getDisplayStatusAttribute(): string
    {
        if ($this->status === 'cancelled') {
            return 'cancelled';
        }

        if ($this->paid_amount >= $this->amount) {
            return 'paid';
        }

        if ($this->paid_amount > 0) {
            return 'partial';
        }

        if ($this->due_on !== null && $this->due_on->isPast() && ! $this->due_on->isToday()) {
            return 'overdue';
        }

        return 'unpaid';
    }

    /**
     * @return BelongsTo<Student, $this>
     */
    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    /**
     * @return BelongsTo<FeeStructure, $this>
     */
    public function feeStructure(): BelongsTo
    {
        return $this->belongsTo(FeeStructure::class);
    }

    /**
     * @return BelongsTo<FeeCategory, $this>
     */
    public function feeCategory(): BelongsTo
    {
        return $this->belongsTo(FeeCategory::class);
    }

    /**
     * @return BelongsTo<SchoolClass, $this>
     */
    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class);
    }

    /**
     * @return BelongsTo<AcademicSession, $this>
     */
    public function academicSession(): BelongsTo
    {
        return $this->belongsTo(AcademicSession::class);
    }

    /**
     * @return HasMany<Payment, $this>
     */
    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }
}
