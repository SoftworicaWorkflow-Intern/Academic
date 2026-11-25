<?php

namespace App\Models;

use App\Models\Concerns\BelongsToInstitution;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['institution_id', 'name', 'code', 'kind', 'billing_type', 'default_amount', 'fine_amount', 'due_day'])]
class FeeCategory extends Model
{
    use BelongsToInstitution;
}
