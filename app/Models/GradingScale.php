<?php

namespace App\Models;

use App\Models\Concerns\BelongsToInstitution;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GradingScale extends Model
{
    use BelongsToInstitution;

    protected $fillable = ['institution_id', 'academic_session_id', 'examination_id', 'name', 'rules', 'is_default'];

    protected function casts(): array
    {
        return ['rules' => 'array', 'is_default' => 'boolean'];
    }

    public function academicSession(): BelongsTo { return $this->belongsTo(AcademicSession::class); }
    public function examination(): BelongsTo { return $this->belongsTo(Examination::class); }
}
