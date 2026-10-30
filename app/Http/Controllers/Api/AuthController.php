<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function login(LoginRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $login = trim($validated['login']);
        $field = filter_var($login, FILTER_VALIDATE_EMAIL) ? 'email' : 'username';
        $identifier = $field === 'email' ? Str::lower($login) : $login;

        if (! Auth::guard('web')->attempt([
            $field => $identifier,
            'password' => $validated['password'],
            'is_active' => true,
        ], $request->boolean('remember'))) {
            return response()->json([
                'message' => 'The provided credentials are incorrect.',
                'errors' => ['login' => ['The provided credentials are incorrect.']],
            ], 422);
        }

        $request->session()->regenerate();
        $user = Auth::guard('web')->user();

        if (! $user instanceof User) {
            Auth::guard('web')->logout();

            return response()->json(['message' => 'Unable to authenticate this account.'], 401);
        }

        $identity = $this->identity($user);

        if ($identity['redirect_to'] === null) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            return response()->json([
                'message' => 'This account does not have access to an application workspace.',
            ], 403);
        }

        return response()->json(['user' => $identity]);
    }

    public function user(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user instanceof User, 401);

        $identity = $this->identity($user);

        abort_if($identity['redirect_to'] === null, 403);

        return response()->json(['user' => $identity]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        Auth::forgetGuards();

        return response()->json(['message' => 'Signed out successfully.']);
    }

    /**
     * @return array{
     *     id: int,
     *     name: string,
     *     email: string,
     *     roles: list<string>,
     *     permissions: list<string>,
     *     audience: 'platform'|'institution'|null,
     *     redirect_to: string|null,
     *     institution: array{id: int, name: string, institution_code: string, type: string}|null
     * }
     */
    private function identity(User $user): array
    {
        $institution = $user->institution;
        $previousTeamId = getPermissionsTeamId();

        $teamId = $user->institution_id ?? (int) config('permission.platform_team_id');
        setPermissionsTeamId($teamId);
        $user->unsetRelation('roles');
        $user->unsetRelation('permissions');

        try {
            $roles = $user->getRoleNames()->all();
            $permissions = $user->getAllPermissions()
                ->pluck('name')
                ->unique()
                ->sort()
                ->values()
                ->all();
        } finally {
            setPermissionsTeamId($previousTeamId);
            $user->unsetRelation('roles');
            $user->unsetRelation('permissions');
        }

        $platformRoles = ['platform-super-admin', 'it-administrator', 'it-support-staff'];
        $institutionRoles = [
            'institution-admin',
            'accountant',
            'cashier',
            'teacher',
            'academic-staff',
            'institution-staff',
        ];
        $isPlatformUser = $user->is_active
            && $user->institution_id === null
            && count(array_intersect($platformRoles, $roles)) > 0;
        $isInstitutionUser = $user->is_active
            && $institution !== null
            && $institution->status === 'active'
            && count(array_intersect($institutionRoles, $roles)) > 0;
        $audience = $isPlatformUser === $isInstitutionUser
            ? null
            : ($isPlatformUser ? 'platform' : 'institution');

        return [
            'id' => $user->getKey(),
            'name' => $user->name,
            'email' => $user->email,
            'roles' => $roles,
            'permissions' => $permissions,
            'audience' => $audience,
            'redirect_to' => match ($audience) {
                'platform' => '/admin/dashboard',
                'institution' => '/dashboard',
                default => null,
            },
            'institution' => $institution === null ? null : [
                'id' => $institution->getKey(),
                'name' => $institution->name,
                'institution_code' => $institution->institution_code,
                'type' => $institution->type,
            ],
        ];
    }
}
