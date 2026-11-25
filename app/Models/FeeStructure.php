<?php

namespace App\Models;

use App\Models\Concerns\BelongsToInstitution;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['institution_id', 'fee_category_id', 'academic_session_id', 'school_class_id', 'name', 'amount', 'billing_type', 'due_day'])]
class FeeStructure extends Model
{
    use BelongsToInstitution;
}
