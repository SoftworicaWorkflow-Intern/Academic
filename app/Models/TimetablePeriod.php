<?php

namespace App\Models;

use App\Models\Concerns\BelongsToInstitution;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TimetablePeriod extends Model
{
    use BelongsToInstitution;

    protected $fillable = ['institution_id', 'academic_session_id', 'name', 'period_number', 'starts_at', 'ends_at', 'type', 'working_days'];

    protected function casts(): array
    {
        return ['working_days' => 'array'];
    }

    public function academicSession(): BelongsTo { return $this->belongsTo(AcademicSession::class); }
    public function entries(): HasMany { return $this->hasMany(TimetableEntry::class); }
}
