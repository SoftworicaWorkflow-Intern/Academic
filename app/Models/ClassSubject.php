<?php

namespace App\Models;

use App\Models\Concerns\BelongsToInstitution;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'institution_id',
    'school_class_id',
    'subject_id',
    'academic_session_id',
    'teacher_id',
    'applicable_section_ids',
    'full_marks',
    'pass_marks',
    'practical_full_marks',
    'practical_pass_marks',
])]
class ClassSubject extends Model
{
    use BelongsToInstitution;

    protected function casts(): array
    {
        return ['applicable_section_ids' => 'array'];
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function teacher(): BelongsTo
    {
        return $this->belongsTo(Teacher::class);
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class);
    }
}
