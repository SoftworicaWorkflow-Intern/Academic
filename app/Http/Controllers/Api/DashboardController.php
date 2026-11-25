<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Expense;
use App\Models\Institution;
use App\Models\Invoice;
use App\Models\JournalLine;
use App\Models\LedgerAccount;
use App\Models\Payment;
use App\Models\Student;
use App\Models\Subscription;
use App\Models\Teacher;
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
                'institutions_inactive' => Institution::query()->where('status', '!=', 'active')->count(),
                'schools_total' => Institution::query()->where('type', 'school')->count(),
                'colleges_total' => Institution::query()->where('type', 'college')->count(),
                'users_total' => User::query()->count(),
                'users_active' => User::query()->where('is_active', true)->count(),
                'subscriptions_active' => Subscription::query()->where('status', 'active')->count(),
                'subscriptions_expiring' => Subscription::query()
                    ->where('status', 'active')
                    ->whereDate('expires_on', '<=', now()->addDays(30))
                    ->count(),
                'monthly_recurring_revenue' => (int) Subscription::query()->where('status', 'active')->sum('price_monthly'),
                'recent_institutions' => Institution::query()->latest()->limit(5)->get(['id', 'name', 'institution_code', 'type', 'status', 'created_at']),
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
                'students_total' => Student::query()->count(),
                'teachers_total' => Teacher::query()->count(),
                'invoices_open' => Invoice::query()->whereIn('status', ['open', 'partial'])->count(),
                'fees_outstanding' => (int) Invoice::query()->selectRaw('coalesce(sum(amount - paid_amount), 0) as outstanding')->value('outstanding'),
                'currency' => $institution->currency ?? 'NPR',
            ],
        ]);
    }

    public function accountant(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        $posted = Payment::query()->where('status', 'posted');
        $canManage = $user->can('finance.manage');

        return response()->json([
            'data' => [
                'collection_total' => (int) (clone $posted)->sum('amount'),
                'collection_today' => (int) (clone $posted)->whereDate('paid_on', today())->sum('amount'),
                'collection_month' => (int) (clone $posted)->whereBetween('paid_on', [now()->startOfMonth(), now()->endOfMonth()])->sum('amount'),
                'pending_payments' => (int) Invoice::query()->whereIn('status', ['open', 'partial'])->whereDate('due_on', '<', today())->count()
                    + (int) Invoice::query()->whereIn('status', ['open', 'partial'])->whereDate('due_on', '>=', today())->count(),
                'outstanding' => (int) Invoice::query()->selectRaw('coalesce(sum(amount - paid_amount), 0) as outstanding')->value('outstanding'),
                'overdue' => (int) Invoice::query()->whereIn('status', ['open', 'partial'])->whereDate('due_on', '<', today())->count(),
                'income_total' => (int) (clone $posted)->sum('amount'),
                'expense_total' => $canManage ? (int) Expense::query()->sum('amount') : null,
                'cash_balance' => $this->balance('1000'),
                'bank_balance' => $this->balance('1010'),
                'recent_payments' => Payment::query()->with('invoice.student:id,first_name,last_name,admission_number')->latest()->limit(8)->get(),
            ],
        ]);
    }

    private function balance(string $code): int
    {
        $accountIds = LedgerAccount::query()->where('code', $code)->pluck('id');

        return (int) JournalLine::query()->whereIn('ledger_account_id', $accountIds)->sum('debit')
            - (int) JournalLine::query()->whereIn('ledger_account_id', $accountIds)->sum('credit');
    }
}
