<?php

namespace App\Models;

use App\Models\Concerns\BelongsToInstitution;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'institution_id',
    'name',
    'code',
    'category',
    'discount_type',
    'value',
    'eligibility_rules',
    'is_active',
])]
class Scholarship extends Model
{
    use BelongsToInstitution;

    protected function casts(): array
    {
        return [
            'value' => 'integer',
            'is_active' => 'boolean',
        ];
    }
}
