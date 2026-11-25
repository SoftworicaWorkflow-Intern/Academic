<?php

namespace App\Models;

use App\Models\Concerns\BelongsToInstitution;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TimetableEntry extends Model
{
    use BelongsToInstitution;

    protected $fillable = [
        'institution_id', 'academic_session_id', 'school_class_id', 'section_id', 'subject_id',
        'teacher_id', 'timetable_period_id', 'day_of_week', 'period_number', 'classroom',
        'starts_at', 'ends_at', 'timetable_type',
    ];

    public function academicSession(): BelongsTo { return $this->belongsTo(AcademicSession::class); }
    public function schoolClass(): BelongsTo { return $this->belongsTo(SchoolClass::class); }
    public function section(): BelongsTo { return $this->belongsTo(Section::class); }
    public function subject(): BelongsTo { return $this->belongsTo(Subject::class); }
    public function teacher(): BelongsTo { return $this->belongsTo(Teacher::class); }
    public function period(): BelongsTo { return $this->belongsTo(TimetablePeriod::class, 'timetable_period_id'); }
}
