<?php

namespace App\Services;

use App\Models\Institution;
use LogicException;

class InstitutionContext
{
    private ?Institution $institution = null;

    public function set(Institution $institution): void
    {
        $this->institution = $institution;
    }

    public function current(): Institution
    {
        return $this->institution ?? throw new LogicException('No institution context is active.');
    }

    public function clear(): void
    {
        $this->institution = null;
    }
}
