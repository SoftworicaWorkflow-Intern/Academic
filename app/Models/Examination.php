<?php

namespace App\Models;

use App\Models\Concerns\BelongsToInstitution;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['institution_id', 'academic_session_id', 'school_class_id', 'name', 'exam_type', 'published_at'])]
class Examination extends Model
{
    use BelongsToInstitution;

    protected function casts(): array
    {
        return ['published_at' => 'datetime'];
    }

    public function schoolClass(): BelongsTo
    {
        return $this->belongsTo(SchoolClass::class);
    }

    public function marks(): HasMany
    {
        return $this->hasMany(Mark::class);
    }
}
