<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Institution;
use App\Models\User;
use App\Services\InstitutionContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function platform(): JsonResponse
    {
        return response()->json([
            'data' => [
                'institutions_total' => Institution::query()->count(),
                'institutions_active' => Institution::query()->where('status', 'active')->count(),
                'users_total' => User::query()->count(),
                'users_active' => User::query()->where('is_active', true)->count(),
            ],
        ]);
    }

    public function institution(InstitutionContext $institutionContext, Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless($user instanceof User, 401);

        $institution = $institutionContext->current();

        return response()->json([
            'data' => [
                'institution' => [
                    'id' => $institution->getKey(),
                    'name' => $institution->name,
                    'institution_code' => $institution->institution_code,
                    'type' => $institution->type,
                ],
                'user' => [
                    'name' => $user->name,
                    'roles' => $user->getRoleNames()->all(),
                ],
            ],
        ]);
    }
}
