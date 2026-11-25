<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Institution;
use App\Models\InstitutionModule;
use App\Models\Subscription;
use App\Models\SubscriptionPlan;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use App\Services\CreateInstitution;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InstitutionController extends Controller
{
    public function platformUsers(): JsonResponse
    {
        $users = User::query()->with('institution:id,name')->latest()->paginate(20);

        return response()->json($users);
    }

    public function categories(): JsonResponse
    {
        $rows = Institution::query()
            ->select('type', DB::raw('count(*) as total'))
            ->groupBy('type')
            ->orderBy('type')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function subscriptions(Request $request): JsonResponse
    {
        $query = Subscription::query()->withoutGlobalScope('institution')->with(['plan:id,name', 'institution:id,name']);

        if ($request->boolean('expiring')) {
            $query->where('status', 'active')->whereDate('expires_on', '<=', now()->addDays(30));
        }

        return response()->json($query->latest()->paginate(20));
    }

    public function modules(): JsonResponse
    {
        $rows = InstitutionModule::query()
            ->withoutGlobalScope('institution')
            ->with('institution:id,name')
            ->orderBy('module')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function activity(): JsonResponse
    {
        $rows = AuditLog::query()->with('user:id,name')->latest()->limit(50)->get();

        return response()->json(['data' => $rows]);
    }

    public function plans(): JsonResponse
    {
        return response()->json([
            'data' => SubscriptionPlan::query()->where('is_active', true)->orderBy('price_monthly')->get(),
        ]);
    }

    public function index(): JsonResponse
    {
        $institutions = Institution::query()
            ->with(['subscriptions.plan', 'modules'])
            ->withCount('users')
            ->latest()
            ->paginate(15);

        return response()->json($institutions);
    }

    public function store(Request $request, CreateInstitution $createInstitution): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', Rule::in(['school', 'college', 'university'])],
            'registration_number' => ['nullable', 'string', 'max:100'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:30'],
            'website' => ['nullable', 'string', 'max:255'],
            'province' => ['nullable', 'string', 'max:100'],
            'district' => ['nullable', 'string', 'max:100'],
            'municipality' => ['nullable', 'string', 'max:100'],
            'ward' => ['nullable', 'string', 'max:20'],
            'address' => ['nullable', 'string', 'max:500'],
            'admin_name' => ['required', 'string', 'max:255'],
            'admin_email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'admin_password' => ['required', 'string', 'min:8'],
            'subscription_plan_id' => ['required', 'exists:subscription_plans,id'],
            'starts_on' => ['required', 'date'],
            'expires_on' => ['required', 'date', 'after:starts_on'],
            'modules' => ['nullable', 'array'],
            'modules.*' => ['string', Rule::in(['students', 'teachers', 'academics', 'attendance', 'examinations', 'finance', 'notices'])],
            'status' => ['nullable', Rule::in(['active', 'inactive', 'suspended'])],
        ]);

        $actor = $request->user();
        $institution = $createInstitution->handle($validated, $actor instanceof User ? $actor : null);

        return response()->json(['data' => $institution], 201);
    }

    public function show(Institution $institution): JsonResponse
    {
        $institution->load(['subscriptions.plan', 'modules', 'settings', 'users:id,name,email,institution_id,is_active']);

        return response()->json(['data' => $institution]);
    }

    public function updateStatus(Request $request, Institution $institution): JsonResponse
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(['active', 'inactive', 'suspended'])],
        ]);

        $institution->update(['status' => $validated['status']]);
        $actor = $request->user();

        AuditLog::query()->create([
            'institution_id' => $institution->getKey(),
            'user_id' => $actor instanceof User ? $actor->getKey() : null,
            'action' => 'institution.status',
            'subject_type' => Institution::class,
            'subject_id' => $institution->getKey(),
            'metadata' => ['status' => $validated['status']],
        ]);

        return response()->json(['data' => $institution]);
    }
}
