<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\InstitutionContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureInstitutionContext
{
    public function __construct(private InstitutionContext $institutionContext) {}

    /**
     * Handle an incoming request.
     *
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        abort_unless(
            $user instanceof User && $user->is_active && $user->institution_id !== null,
            403,
        );

        $institution = $user->institution;

        abort_unless($institution !== null && $institution->status === 'active', 403);

        $previousTeamId = getPermissionsTeamId();
        setPermissionsTeamId($institution->getKey());
        $user->unsetRelation('roles');
        $this->institutionContext->set($institution);

        try {
            abort_unless($user->hasRole([
                'institution-admin',
                'accountant',
                'cashier',
                'teacher',
                'academic-staff',
                'institution-staff',
            ]), 403);

            return $next($request);
        } finally {
            setPermissionsTeamId($previousTeamId);
            $user->unsetRelation('roles');
            $this->institutionContext->clear();
        }
    }
}
