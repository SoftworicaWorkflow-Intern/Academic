<?php

namespace App\Models;

use App\Models\Concerns\BelongsToInstitution;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'institution_id',
    'enabled',
    'penalty_type',
    'penalty_value',
    'grace_days',
    'penalty_start_date',
    'description',
])]
class LateFeeSetting extends Model
{
    use BelongsToInstitution;

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'penalty_value' => 'integer',
            'grace_days' => 'integer',
            'penalty_start_date' => 'date',
        ];
    }
}
