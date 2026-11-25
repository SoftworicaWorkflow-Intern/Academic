<?php

namespace App\Models;

use App\Models\Concerns\BelongsToInstitution;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['institution_id', 'code', 'name', 'type'])]
class LedgerAccount extends Model
{
    use BelongsToInstitution;
}
