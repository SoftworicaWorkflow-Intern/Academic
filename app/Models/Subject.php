<?php

namespace App\Models;

use App\Models\Concerns\BelongsToInstitution;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['institution_id', 'name', 'code', 'subject_type', 'full_marks', 'pass_marks', 'practical_full_marks', 'practical_pass_marks'])]
class Subject extends Model
{
    use BelongsToInstitution;
}
