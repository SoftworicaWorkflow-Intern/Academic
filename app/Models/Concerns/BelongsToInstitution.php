<?php

namespace App\Models\Concerns;

use App\Models\Institution;
use App\Services\InstitutionContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

trait BelongsToInstitution
{
    public static function bootBelongsToInstitution(): void
    {
        static::addGlobalScope('institution', function (Builder $builder): void {
            $institutionId = app(InstitutionContext::class)->id();

            if ($institutionId !== null) {
                $builder->where($builder->getModel()->getTable().'.institution_id', $institutionId);
            }
        });

        static::creating(function (Model $model): void {
            $institutionId = app(InstitutionContext::class)->id();

            if ($institutionId !== null) {
                $model->setAttribute('institution_id', $institutionId);
            }
        });
    }

    /**
     * @return BelongsTo<Institution, $this>
     */
    public function institution(): BelongsTo
    {
        return $this->belongsTo(Institution::class);
    }
}
