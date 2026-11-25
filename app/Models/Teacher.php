<?php

namespace App\Models;

use App\Models\Concerns\BelongsToInstitution;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'institution_id',
    'employee_code',
    'first_name',
    'last_name',
    'email',
    'phone',
    'department',
    'qualification',
    'status',
])]
class Teacher extends Model
{
    use BelongsToInstitution;
}
