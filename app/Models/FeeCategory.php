<?php

namespace App\Models;

use App\Models\Concerns\BelongsToInstitution;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'institution_id',
    'name',
    'code',
    'kind',
    'billing_type',
    'default_amount',
    'fine_amount',
    'due_day',
    'description',
    'is_active',
])]
class FeeCategory extends Model
{
    use BelongsToInstitution;

    protected function casts(): array
    {
        return [
            'default_amount' => 'integer',
            'fine_amount' => 'integer',
            'due_day' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    /**
     * @return HasMany<FeeStructure, $this>
     */
    public function feeStructures(): HasMany
    {
        return $this->hasMany(FeeStructure::class);
    }
}
