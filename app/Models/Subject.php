<?php

namespace App\Models;

use App\Models\Concerns\BelongsToInstitution;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['institution_id', 'name', 'code', 'description', 'category', 'subject_type', 'credit_hours', 'full_marks', 'pass_marks', 'practical_full_marks', 'practical_pass_marks', 'status'])]
class Subject extends Model
{
    use BelongsToInstitution;

    public function classSubjects(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(ClassSubject::class);
    }
}
