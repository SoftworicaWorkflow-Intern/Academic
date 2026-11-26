<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicSession;
use App\Models\FeeCategory;
use App\Models\FeeStructure;
use App\Models\Institution;
use App\Models\LateFeeSetting;
use App\Models\PaymentMethod;
use App\Models\Scholarship;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Services\InstitutionContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class FeeController extends Controller
{
    /**
     * Get summary metrics for the fee management dashboard.
     */
    public function summary(): JsonResponse
    {
        $context = app(InstitutionContext::class);
        $institution = null;
        try {
            $institution = $context->current();
        } catch (\LogicException) {
            // No active context
        }
        $institutionId = $institution?->getKey() ?? 0;

        $totalCategories = FeeCategory::query()->count();
        $activeFeeStructures = FeeStructure::query()->where('is_active', true)->count();
        $totalFeeStructures = FeeStructure::query()->count();
        $activeAcademicYears = AcademicSession::query()->where('status', 'active')->count();
        $totalScholarships = Scholarship::query()->where('is_active', true)->count();
        $lateFeeSetting = LateFeeSetting::query()->first();

        return response()->json([
            'data' => [
                'total_categories' => $totalCategories,
                'active_fee_structures' => $activeFeeStructures,
                'total_fee_structures' => $totalFeeStructures,
                'active_academic_years' => $activeAcademicYears,
                'total_scholarships' => $totalScholarships,
                'late_fees_enabled' => $lateFeeSetting?->enabled ?? false,
                'currency' => $institution->currency ?? 'NPR',
            ],
        ]);
    }

    /**
     * List fee categories with search and filtering.
     */
    public function categories(Request $request): JsonResponse
    {
        $query = FeeCategory::query()->withCount('feeStructures');

        if ($search = $request->string('search')->trim()->value()) {
            $query->where(function ($q) use ($search): void {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        if ($kind = $request->string('kind')->trim()->value()) {
            $query->where('kind', $kind);
        }

        if ($request->has('is_active') && $request->input('is_active') !== '') {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $perPage = $request->integer('per_page', 15);
        $rows = $query->orderBy('name')->paginate($perPage);

        return response()->json($rows);
    }

    /**
     * Store a new fee category.
     */
    public function storeCategory(Request $request): JsonResponse
    {
        $validated = $this->categoryValidation($request);
        $category = FeeCategory::query()->create($validated);

        return response()->json(['data' => $category], 201);
    }

    /**
     * Show a specific fee category.
     */
    public function showCategory(int $feeCategory): JsonResponse
    {
        $category = FeeCategory::query()->with('feeStructures')->findOrFail($feeCategory);

        return response()->json(['data' => $category]);
    }

    /**
     * Update an existing fee category.
     */
    public function updateCategory(Request $request, int $feeCategory): JsonResponse
    {
        $category = FeeCategory::query()->findOrFail($feeCategory);
        $validated = $this->categoryValidation($request, $category->id);
        $category->update($validated);

        return response()->json(['data' => $category]);
    }

    /**
     * Delete a fee category.
     */
    public function destroyCategory(int $feeCategory): JsonResponse
    {
        $category = FeeCategory::query()->findOrFail($feeCategory);

        if ($category->feeStructures()->exists()) {
            throw ValidationException::withMessages([
                'category' => 'Cannot delete this fee category because it is linked to one or more fee structures.',
            ]);
        }

        $category->delete();

        return response()->json(['message' => 'Fee category removed successfully.']);
    }

    /**
     * List fee structures with search, filtering, and pagination.
     */
    public function structures(Request $request): JsonResponse
    {
        $query = FeeStructure::query()
            ->with([
                'category:id,name,code,kind',
                'academicSession:id,name,code,status',
                'schoolClass:id,name,code',
                'section:id,name',
            ])
            ->withCount('invoices');

        if ($search = $request->string('search')->trim()->value()) {
            $query->where(function ($q) use ($search): void {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%")
                    ->orWhereHas('category', function ($cq) use ($search): void {
                        $cq->where('name', 'like', "%{$search}%");
                    })
                    ->orWhereHas('schoolClass', function ($cq) use ($search): void {
                        $cq->where('name', 'like', "%{$search}%");
                    });
            });
        }

        if ($sessionId = $request->integer('academic_session_id')) {
            $query->where('academic_session_id', $sessionId);
        }

        if ($classId = $request->integer('school_class_id')) {
            $query->where('school_class_id', $classId);
        }

        if ($sectionId = $request->integer('section_id')) {
            $query->where('section_id', $sectionId);
        }

        if ($categoryId = $request->integer('fee_category_id')) {
            $query->where('fee_category_id', $categoryId);
        }

        if ($feeType = $request->string('fee_type')->trim()->value()) {
            $query->where('fee_type', $feeType);
        }

        if ($schedule = $request->string('payment_schedule')->trim()->value()) {
            $query->where('payment_schedule', $schedule);
        }

        if ($request->has('is_active') && $request->input('is_active') !== '') {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $perPage = $request->integer('per_page', 15);
        $rows = $query->latest()->paginate($perPage);

        return response()->json($rows);
    }

    /**
     * Store a new fee structure.
     */
    public function storeStructure(Request $request): JsonResponse
    {
        $validated = $this->structureValidation($request);
        $structure = FeeStructure::query()->create($validated);

        return response()->json([
            'data' => $structure->load([
                'category:id,name,code,kind',
                'academicSession:id,name,code,status',
                'schoolClass:id,name,code',
                'section:id,name',
            ]),
        ], 201);
    }

    /**
     * Show a specific fee structure.
     */
    public function showStructure(int $feeStructure): JsonResponse
    {
        $structure = FeeStructure::query()
            ->with([
                'category',
                'academicSession',
                'schoolClass',
                'section',
            ])
            ->findOrFail($feeStructure);

        return response()->json(['data' => $structure]);
    }

    /**
     * Update an existing fee structure.
     */
    public function updateStructure(Request $request, int $feeStructure): JsonResponse
    {
        $structure = FeeStructure::query()->findOrFail($feeStructure);
        $validated = $this->structureValidation($request, $structure->id);
        $structure->update($validated);

        return response()->json([
            'data' => $structure->fresh([
                'category:id,name,code,kind',
                'academicSession:id,name,code,status',
                'schoolClass:id,name,code',
                'section:id,name',
            ]),
        ]);
    }

    /**
     * Delete a fee structure.
     */
    public function destroyStructure(int $feeStructure): JsonResponse
    {
        $structure = FeeStructure::query()->findOrFail($feeStructure);

        if ($structure->invoices()->exists()) {
            throw ValidationException::withMessages([
                'fee_structure' => 'Cannot delete this fee structure because invoices have already been issued against it.',
            ]);
        }

        $structure->delete();

        return response()->json(['message' => 'Fee structure removed successfully.']);
    }

    /**
     * List scholarships and discounts.
     */
    public function scholarships(Request $request): JsonResponse
    {
        $query = Scholarship::query();

        if ($search = $request->string('search')->trim()->value()) {
            $query->where(function ($q) use ($search): void {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%")
                    ->orWhere('eligibility_rules', 'like', "%{$search}%");
            });
        }

        if ($category = $request->string('category')->trim()->value()) {
            $query->where('category', $category);
        }

        if ($discountType = $request->string('discount_type')->trim()->value()) {
            $query->where('discount_type', $discountType);
        }

        if ($request->has('is_active') && $request->input('is_active') !== '') {
            $query->where('is_active', $request->boolean('is_active'));
        }

        $perPage = $request->integer('per_page', 15);
        $rows = $query->orderBy('name')->paginate($perPage);

        return response()->json($rows);
    }

    /**
     * Store a scholarship or discount.
     */
    public function storeScholarship(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => ['nullable', 'string', 'max:50'],
            'category' => ['required', Rule::in(['merit', 'need_based', 'sibling', 'staff_child', 'sports', 'general'])],
            'discount_type' => ['required', Rule::in(['percent', 'fixed'])],
            'value' => ['required', 'integer', 'min:1'],
            'eligibility_rules' => ['nullable', 'string'],
            'is_active' => ['boolean'],
        ]);

        if ($validated['discount_type'] === 'percent' && $validated['value'] > 100) {
            throw ValidationException::withMessages([
                'value' => 'Percentage discount cannot exceed 100%.',
            ]);
        }

        $scholarship = Scholarship::query()->create($validated);

        return response()->json(['data' => $scholarship], 201);
    }

    /**
     * Update a scholarship or discount.
     */
    public function updateScholarship(Request $request, int $scholarship): JsonResponse
    {
        $record = Scholarship::query()->findOrFail($scholarship);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => ['nullable', 'string', 'max:50'],
            'category' => ['required', Rule::in(['merit', 'need_based', 'sibling', 'staff_child', 'sports', 'general'])],
            'discount_type' => ['required', Rule::in(['percent', 'fixed'])],
            'value' => ['required', 'integer', 'min:1'],
            'eligibility_rules' => ['nullable', 'string'],
            'is_active' => ['boolean'],
        ]);

        if ($validated['discount_type'] === 'percent' && $validated['value'] > 100) {
            throw ValidationException::withMessages([
                'value' => 'Percentage discount cannot exceed 100%.',
            ]);
        }

        $record->update($validated);

        return response()->json(['data' => $record]);
    }

    /**
     * Delete a scholarship or discount.
     */
    public function destroyScholarship(int $scholarship): JsonResponse
    {
        $record = Scholarship::query()->findOrFail($scholarship);
        $record->delete();

        return response()->json(['message' => 'Discount rule removed successfully.']);
    }

    /**
     * Get institution late fee settings.
     */
    public function lateFeeSettings(): JsonResponse
    {
        $setting = LateFeeSetting::query()->firstOrCreate(
            [],
            [
                'enabled' => false,
                'penalty_type' => 'fixed',
                'penalty_value' => 0,
                'grace_days' => 7,
                'description' => 'Late payment fine applied after grace period expires.',
            ],
        );

        return response()->json(['data' => $setting]);
    }

    /**
     * Update institution late fee settings.
     */
    public function updateLateFeeSettings(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'enabled' => ['required', 'boolean'],
            'penalty_type' => ['required', Rule::in(['fixed', 'percentage'])],
            'penalty_value' => ['required', 'integer', 'min:0'],
            'grace_days' => ['required', 'integer', 'min:0', 'max:365'],
            'penalty_start_date' => ['nullable', 'date'],
            'description' => ['nullable', 'string'],
        ]);

        $setting = LateFeeSetting::query()->first();

        if ($setting === null) {
            $setting = LateFeeSetting::query()->create($validated);
        } else {
            $setting->update($validated);
        }

        return response()->json(['data' => $setting]);
    }

    /**
     * Get configured payment methods.
     */
    public function paymentMethods(): JsonResponse
    {
        $this->ensureDefaultPaymentMethods();
        $methods = PaymentMethod::query()->orderBy('id')->get();

        return response()->json(['data' => $methods]);
    }

    /**
     * Add a custom payment method.
     */
    public function storePaymentMethod(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => ['required', 'string', 'max:30'],
            'instructions' => ['nullable', 'string'],
            'account_details' => ['nullable', 'string'],
            'enabled' => ['boolean'],
        ]);

        $method = PaymentMethod::query()->create($validated);

        return response()->json(['data' => $method], 201);
    }

    /**
     * Update payment method configuration.
     */
    public function updatePaymentMethod(Request $request, int $paymentMethod): JsonResponse
    {
        $method = PaymentMethod::query()->findOrFail($paymentMethod);

        $validated = $request->validate([
            'name' => ['sometimes', 'required', 'string', 'max:100'],
            'instructions' => ['nullable', 'string'],
            'account_details' => ['nullable', 'string'],
            'enabled' => ['sometimes', 'required', 'boolean'],
            'is_active' => ['sometimes', 'required', 'boolean'],
        ]);

        $method->update($validated);

        return response()->json(['data' => $method]);
    }

    /**
     * Delete custom payment method.
     */
    public function destroyPaymentMethod(int $paymentMethod): JsonResponse
    {
        $method = PaymentMethod::query()->findOrFail($paymentMethod);

        if (in_array($method->code, ['cash', 'bank', 'esewa', 'khalti', 'online'], true)) {
            throw ValidationException::withMessages([
                'payment_method' => 'Standard system payment methods cannot be deleted. You can disable them instead.',
            ]);
        }

        $method->delete();

        return response()->json(['message' => 'Payment method removed.']);
    }

    /**
     * Ensure default payment methods exist for the institution.
     */
    private function ensureDefaultPaymentMethods(): void
    {
        $defaults = [
            [
                'name' => 'Cash',
                'code' => 'cash',
                'instructions' => 'Pay cash directly at the school accounts desk during office hours.',
                'account_details' => 'Office Hours: 9:00 AM - 4:00 PM (Sun-Fri)',
                'enabled' => true,
            ],
            [
                'name' => 'Bank Transfer',
                'code' => 'bank',
                'instructions' => 'Direct deposit or mobile banking transfer to official school account.',
                'account_details' => 'Bank: Nepal Investment Mega Bank | A/C: 01234567890123 | Name: Academic Institution',
                'enabled' => true,
            ],
            [
                'name' => 'eSewa',
                'code' => 'esewa',
                'instructions' => 'Scan school QR code or pay via eSewa School Fee Portal.',
                'account_details' => 'eSewa ID: 9801234567 | Merchant Code: ACADEMIC_FEE',
                'enabled' => true,
            ],
            [
                'name' => 'Khalti',
                'code' => 'khalti',
                'instructions' => 'Pay via Khalti digital wallet or scan Khalti QR.',
                'account_details' => 'Khalti ID: 9801234567 | Merchant: ACADEMIC_KHALTI',
                'enabled' => true,
            ],
            [
                'name' => 'Digital payment / Card',
                'code' => 'online',
                'instructions' => 'Online debit/credit card or connectIPS checkout.',
                'account_details' => 'Gateway: connectIPS / Online Portal',
                'enabled' => true,
            ],
        ];

        foreach ($defaults as $default) {
            PaymentMethod::query()->firstOrCreate(
                ['code' => $default['code']],
                [
                    'name' => $default['name'],
                    'instructions' => $default['instructions'],
                    'account_details' => $default['account_details'],
                    'enabled' => $default['enabled'],
                ],
            );
        }
    }

    /**
     * Category request validation rules.
     *
     * @return array<string, mixed>
     */
    private function categoryValidation(Request $request, ?int $ignoreId = null): array
    {
        $context = app(InstitutionContext::class);
        $institutionId = $context->id();

        $codeRule = Rule::unique('fee_categories', 'code')->where('institution_id', $institutionId);
        if ($ignoreId !== null) {
            $codeRule->ignore($ignoreId);
        }

        return $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'code' => ['required', 'string', 'max:30', $codeRule],
            'kind' => [
                'required',
                Rule::in([
                    'admission',
                    'tuition',
                    'examination',
                    'library',
                    'transport',
                    'computer_lab',
                    'sports',
                    'hostel',
                    'laboratory',
                    'fine',
                    'other',
                ]),
            ],
            'billing_type' => ['required', Rule::in(['one_time', 'recurring'])],
            'default_amount' => ['required', 'integer', 'min:0'],
            'fine_amount' => ['nullable', 'integer', 'min:0'],
            'due_day' => ['nullable', 'integer', 'between:1,28'],
            'description' => ['nullable', 'string'],
            'is_active' => ['boolean'],
        ]);
    }

    /**
     * Structure request validation rules.
     *
     * @return array<string, mixed>
     */
    private function structureValidation(Request $request, ?int $ignoreId = null): array
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'amount' => ['required', 'integer', 'min:0'],
            'academic_session_id' => ['nullable', 'integer', 'exists:academic_sessions,id'],
            'school_class_id' => ['nullable', 'integer', 'exists:school_classes,id'],
            'section_id' => ['nullable', 'integer', 'exists:sections,id'],
            'fee_category_id' => ['nullable', 'integer', 'exists:fee_categories,id'],
            'fee_type' => ['required', Rule::in(['compulsory', 'optional'])],
            'payment_schedule' => ['required', Rule::in(['monthly', 'quarterly', 'half_yearly', 'yearly', 'one_time'])],
            'billing_type' => ['sometimes', 'string', Rule::in(['one_time', 'recurring'])],
            'due_day' => ['nullable', 'integer', 'between:1,28'],
            'due_date' => ['nullable', 'date'],
            'description' => ['nullable', 'string'],
            'is_active' => ['boolean'],
        ]);

        if (empty($validated['billing_type'])) {
            $validated['billing_type'] = $validated['payment_schedule'] === 'one_time' ? 'one_time' : 'recurring';
        }

        if (! empty($validated['section_id']) && ! empty($validated['school_class_id'])) {
            $section = Section::query()->findOrFail($validated['section_id']);
            if ($section->school_class_id !== (int) $validated['school_class_id']) {
                throw ValidationException::withMessages([
                    'section_id' => 'The selected section does not belong to the selected class.',
                ]);
            }
        }

        return $validated;
    }
}
