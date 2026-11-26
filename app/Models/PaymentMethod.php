<?php

namespace App\Models;

use App\Models\Concerns\BelongsToInstitution;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'institution_id',
    'name',
    'code',
    'enabled',
    'instructions',
    'account_details',
    'is_active',
])]
class PaymentMethod extends Model
{
    use BelongsToInstitution;

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'is_active' => 'boolean',
        ];
    }
}
