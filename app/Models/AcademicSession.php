<?php

namespace App\Models;

use App\Models\Concerns\BelongsToInstitution;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['institution_id', 'name', 'code', 'starts_on', 'registration_starts_on', 'registration_ends_on', 'ends_on', 'description', 'status', 'is_current', 'archived_at'])]
class AcademicSession extends Model
{
    use BelongsToInstitution;

    protected function casts(): array
    {
        return [
            'starts_on' => 'date',
            'registration_starts_on' => 'date',
            'registration_ends_on' => 'date',
            'ends_on' => 'date',
            'is_current' => 'boolean',
            'archived_at' => 'datetime',
        ];
    }

    public function studentEnrollments(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(StudentEnrollment::class);
    }
}
