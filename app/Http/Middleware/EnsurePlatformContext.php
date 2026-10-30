<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsurePlatformContext
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        abort_unless($user instanceof User && $user->is_active && $user->institution_id === null, 403);

        $previousTeamId = getPermissionsTeamId();
        setPermissionsTeamId((int) config('permission.platform_team_id'));
        $user->unsetRelation('roles');

        try {
            abort_unless($user->hasRole([
                'platform-super-admin',
                'it-administrator',
                'it-support-staff',
            ]), 403);

            return $next($request);
        } finally {
            setPermissionsTeamId($previousTeamId);
            $user->unsetRelation('roles');
        }
    }
}
