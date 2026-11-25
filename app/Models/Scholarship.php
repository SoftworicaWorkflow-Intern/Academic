<?php

namespace App\Models;

use App\Models\Concerns\BelongsToInstitution;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['institution_id', 'name', 'discount_type', 'value'])]
class Scholarship extends Model
{
    use BelongsToInstitution;
}
