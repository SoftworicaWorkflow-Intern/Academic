<?php

namespace App\Models;

use App\Models\Concerns\BelongsToInstitution;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'institution_id', 'examination_id', 'student_id', 'subject_id', 'theory_marks', 'practical_marks',
    'workflow_status', 'entered_by', 'approved_by', 'submitted_at', 'approved_at', 'published_at', 'locked_at',
])]
class Mark extends Model
{
    use BelongsToInstitution;

    protected function casts(): array
    {
        return [
            'submitted_at' => 'datetime',
            'approved_at' => 'datetime',
            'published_at' => 'datetime',
            'locked_at' => 'datetime',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function subject(): BelongsTo
    {
        return $this->belongsTo(Subject::class);
    }

    public function examination(): BelongsTo
    {
        return $this->belongsTo(Examination::class);
    }
}
