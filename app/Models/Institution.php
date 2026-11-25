<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable([
    'name',
    'institution_code',
    'type',
    'registration_number',
    'email',
    'phone',
    'website',
    'province',
    'district',
    'municipality',
    'ward',
    'address',
    'currency',
    'status',
])]
class Institution extends Model
{
    /**
     * @return HasMany<User, $this>
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }

    /**
     * @return HasMany<Subscription, $this>
     */
    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    /**
     * @return HasMany<InstitutionModule, $this>
     */
    public function modules(): HasMany
    {
        return $this->hasMany(InstitutionModule::class);
    }

    /**
     * @return HasOne<InstitutionSetting, $this>
     */
    public function settings(): HasOne
    {
        return $this->hasOne(InstitutionSetting::class);
    }
}
