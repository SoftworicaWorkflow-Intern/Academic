<?php

namespace App\Models;

use App\Models\Concerns\BelongsToInstitution;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['institution_id', 'currency', 'timezone'])]
class InstitutionSetting extends Model
{
    use BelongsToInstitution;
}
