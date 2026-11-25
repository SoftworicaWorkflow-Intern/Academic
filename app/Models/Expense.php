<?php

namespace App\Models;

use App\Models\Concerns\BelongsToInstitution;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['institution_id', 'spent_on', 'amount', 'paid_from', 'description'])]
class Expense extends Model
{
    use BelongsToInstitution;

    protected function casts(): array
    {
        return ['spent_on' => 'date'];
    }
}
