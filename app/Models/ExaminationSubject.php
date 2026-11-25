<?php

namespace App\Models;

use App\Models\Concerns\BelongsToInstitution;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExaminationSubject extends Model
{
    use BelongsToInstitution;

    protected $fillable = [
        'institution_id', 'examination_id', 'school_class_id', 'section_id', 'subject_id',
        'exam_date', 'starts_at', 'ends_at', 'full_marks', 'pass_marks', 'theory_marks', 'practical_marks', 'room',
    ];

    protected function casts(): array
    {
        return ['exam_date' => 'date'];
    }

    public function examination(): BelongsTo { return $this->belongsTo(Examination::class); }
    public function schoolClass(): BelongsTo { return $this->belongsTo(SchoolClass::class); }
    public function section(): BelongsTo { return $this->belongsTo(Section::class); }
    public function subject(): BelongsTo { return $this->belongsTo(Subject::class); }
}
