<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AcademicSession;
use App\Models\AttendanceRecord;
use App\Models\Examination;
use App\Models\Expense;
use App\Models\Institution;
use App\Models\Invoice;
use App\Models\JournalLine;
use App\Models\LedgerAccount;
use App\Models\Notice;
use App\Models\Payment;
use App\Models\SchoolClass;
use App\Models\Section;
use App\Models\Staff;
use App\Models\StaffAttendanceRecord;
use App\Models\Student;
use App\Models\Subscription;
use App\Models\Teacher;
use App\Models\User;
use App\Services\InstitutionContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    public function platform(): JsonResponse
    {
        return response()->json([
            'data' => [
                'institutions_total'        => Institution::query()->count(),
                'institutions_active'       => Institution::query()->where('status', 'active')->count(),
                'institutions_inactive'     => Institution::query()->where('status', '!=', 'active')->count(),
                'schools_total'             => Institution::query()->where('type', 'school')->count(),
                'colleges_total'            => Institution::query()->where('type', 'college')->count(),
                'users_total'               => User::query()->count(),
                'users_active'              => User::query()->where('is_active', true)->count(),
                'subscriptions_active'      => Subscription::query()->where('status', 'active')->count(),
                'subscriptions_expiring'    => Subscription::query()
                    ->where('status', 'active')
                    ->whereDate('expires_on', '<=', now()->addDays(30))
                    ->count(),
                'monthly_recurring_revenue' => (int) Subscription::query()->where('status', 'active')->sum('price_monthly'),
                'recent_institutions'       => Institution::query()->latest()->limit(5)->get(['id', 'name', 'institution_code', 'type', 'status', 'created_at']),
            ],
        ]);
    }

    public function institution(InstitutionContext $institutionContext, Request $request): JsonResponse
    {
        $user        = $request->user();
        abort_unless($user instanceof User, 401);

        $institution = $institutionContext->current();
        $filter      = $request->input('filter', 'month'); // today|week|month|year
        $period      = $this->period($filter);

        // --- Counts ---
        $studentsTotal   = Student::query()->count();
        $teachersTotal   = Teacher::query()->count();
        $staffTotal      = Staff::query()->count();
        $classesTotal    = SchoolClass::query()->count();
        $sectionsTotal   = Section::query()->count();
        $invoicesTotal   = Invoice::query()->count();

        // --- Attendance today ---
        $todayRecords  = AttendanceRecord::query()->whereDate('attended_on', today());
        $todayPresent  = (clone $todayRecords)->where('status', 'present')->count();
        $todayAbsent   = (clone $todayRecords)->where('status', 'absent')->count();
        $todayLate     = (clone $todayRecords)->where('status', 'late')->count();
        $todayTotal    = (clone $todayRecords)->count();
        $todayPct      = $todayTotal > 0 ? round(($todayPresent / $todayTotal) * 100, 1) : 0;

        // --- Teacher attendance today ---
        $teacherToday         = StaffAttendanceRecord::query()->whereDate('attended_on', today());
        $teacherTodayPresent  = (clone $teacherToday)->where('status', 'present')->count();
        $teacherTodayAbsent   = (clone $teacherToday)->where('status', 'absent')->count();
        $teacherTodayTotal    = (clone $teacherToday)->count();

        // --- Finance ---
        $posted           = Payment::query()->where('status', 'posted');
        $todayCollection  = (clone $posted)->whereDate('paid_on', today())->sum('amount');
        $monthCollection  = (clone $posted)->whereBetween('paid_on', [now()->startOfMonth(), now()->endOfMonth()])->sum('amount');
        $totalCollection  = (clone $posted)->sum('amount');
        $outstanding      = (int) Invoice::query()->selectRaw('coalesce(sum(amount - paid_amount), 0) as v')->value('v');
        $paidInvoices     = Invoice::query()->where('status', 'paid')->count();
        $unpaidInvoices   = Invoice::query()->whereIn('status', ['open', 'partial'])->count();
        $pendingPayments  = $unpaidInvoices;

        // --- Monthly collection for chart (last 6 months) ---
        $monthlyCollection = Payment::query()
            ->where('status', 'posted')
            ->where('paid_on', '>=', now()->subMonths(5)->startOfMonth())
            ->select(
                DB::raw("YEAR(paid_on) as yr"),
                DB::raw("MONTH(paid_on) as mo"),
                DB::raw("SUM(amount) as total"),
            )
            ->groupBy('yr', 'mo')
            ->orderBy('yr')->orderBy('mo')
            ->get()
            ->map(fn ($r) => [
                'label' => Carbon::create((int) $r->yr, (int) $r->mo)->format('M Y'),
                'value' => (int) $r->total,
            ]);

        // --- Monthly attendance (last 6 months) ---
        $monthlyAttendance = AttendanceRecord::query()
            ->where('attended_on', '>=', now()->subMonths(5)->startOfMonth())
            ->select(
                DB::raw("YEAR(attended_on) as yr"),
                DB::raw("MONTH(attended_on) as mo"),
                DB::raw("SUM(CASE WHEN status='present' THEN 1 ELSE 0 END) as present"),
                DB::raw("SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END) as absent"),
                DB::raw("COUNT(*) as total"),
            )
            ->groupBy('yr', 'mo')
            ->orderBy('yr')->orderBy('mo')
            ->get()
            ->map(fn ($r) => [
                'label'   => Carbon::create((int) $r->yr, (int) $r->mo)->format('M Y'),
                'present' => (int) $r->present,
                'absent'  => (int) $r->absent,
                'total'   => (int) $r->total,
                'pct'     => $r->total > 0 ? round(($r->present / $r->total) * 100, 1) : 0,
            ]);

        // --- Student enrollment by month (last 6 months) ---
        $enrollmentGrowth = Student::query()
            ->where('created_at', '>=', now()->subMonths(5)->startOfMonth())
            ->select(
                DB::raw("YEAR(created_at) as yr"),
                DB::raw("MONTH(created_at) as mo"),
                DB::raw("COUNT(*) as total"),
            )
            ->groupBy('yr', 'mo')
            ->orderBy('yr')->orderBy('mo')
            ->get()
            ->map(fn ($r) => [
                'label' => Carbon::create((int) $r->yr, (int) $r->mo)->format('M Y'),
                'value' => (int) $r->total,
            ]);

        // --- Gender distribution ---
        $genderDist = Student::query()
            ->select('gender', DB::raw('COUNT(*) as total'))
            ->groupBy('gender')
            ->get()
            ->map(fn ($r) => ['label' => $r->gender ?? 'Unknown', 'value' => (int) $r->total]);

        // --- Class-wise student distribution ---
        $classWise = SchoolClass::query()
            ->select('school_classes.name', DB::raw('COUNT(students.id) as total'))
            ->leftJoin('students', 'students.school_class_id', '=', 'school_classes.id')
            ->groupBy('school_classes.id', 'school_classes.name')
            ->orderByDesc('total')
            ->limit(8)
            ->get()
            ->map(fn ($r) => ['label' => $r->name, 'value' => (int) $r->total]);

        // --- Payment method distribution ---
        $paymentMethodDist = Payment::query()
            ->where('status', 'posted')
            ->select('method', DB::raw('COUNT(*) as total'))
            ->groupBy('method')
            ->get()
            ->map(fn ($r) => ['label' => $r->method ?? 'Unknown', 'value' => (int) $r->total]);

        // --- Recent activities ---
        $recentStudents = Student::query()
            ->latest()->limit(5)
            ->get(['id', 'first_name', 'last_name', 'admission_number', 'created_at', 'school_class_id']);

        $recentTeachers = Teacher::query()
            ->latest()->limit(5)
            ->get(['id', 'first_name', 'last_name', 'employee_code', 'created_at']);

        $recentPayments = Payment::query()
            ->with('invoice.student:id,first_name,last_name,admission_number')
            ->where('status', 'posted')
            ->latest()->limit(5)
            ->get(['id', 'invoice_id', 'amount', 'method', 'paid_on', 'receipt_number', 'created_at']);

        $recentInvoices = Invoice::query()
            ->with('student:id,first_name,last_name,admission_number')
            ->latest()->limit(5)
            ->get(['id', 'student_id', 'number', 'amount', 'status', 'due_on', 'issued_on', 'created_at']);

        // --- Upcoming events ---
        $upcomingExaminations = Examination::query()
            ->where('starts_on', '>=', today())
            ->orderBy('starts_on')
            ->limit(5)
            ->get(['id', 'title', 'starts_on', 'ends_on']);

        $upcomingNotices = Notice::query()
            ->where('published_at', '>=', now()->subDays(7))
            ->orderByDesc('published_at')
            ->limit(5)
            ->get(['id', 'title', 'published_at']);

        $overdueFees = Invoice::query()
            ->with('student:id,first_name,last_name,admission_number')
            ->whereIn('status', ['open', 'partial'])
            ->whereDate('due_on', '<', today())
            ->orderBy('due_on')
            ->limit(5)
            ->get(['id', 'student_id', 'number', 'amount', 'paid_amount', 'due_on', 'status']);

        // --- Top classes by attendance ---
        $topClassesByAttendance = SchoolClass::query()
            ->select(
                'school_classes.name',
                DB::raw('COUNT(attendance_records.id) as total'),
                DB::raw("SUM(CASE WHEN attendance_records.status='present' THEN 1 ELSE 0 END) as present"),
            )
            ->leftJoin('students', 'students.school_class_id', '=', 'school_classes.id')
            ->leftJoin('attendance_records', function ($join) {
                $join->on('attendance_records.student_id', '=', 'students.id')
                    ->whereDate('attendance_records.attended_on', today());
            })
            ->groupBy('school_classes.id', 'school_classes.name')
            ->having('total', '>', 0)
            ->orderByDesc('present')
            ->limit(5)
            ->get()
            ->map(fn ($r) => [
                'class'   => $r->name,
                'present' => (int) $r->present,
                'total'   => (int) $r->total,
                'pct'     => $r->total > 0 ? round(($r->present / $r->total) * 100, 1) : 0,
            ]);

        // --- New admissions this month ---
        $newAdmissionsThisMonth = Student::query()
            ->whereBetween('created_at', [now()->startOfMonth(), now()->endOfMonth()])
            ->count();

        $newAdmissionsLastMonth = Student::query()
            ->whereBetween('created_at', [now()->subMonth()->startOfMonth(), now()->subMonth()->endOfMonth()])
            ->count();

        // --- Period-based stats ---
        $periodStudents = Student::query()->whereBetween('created_at', $period)->count();
        $periodPayments = (clone $posted)->whereBetween('paid_on', $period)->sum('amount');

        // --- Current academic session ---
        $currentSession = AcademicSession::query()
            ->where('is_current', true)
            ->first(['id', 'name', 'starts_on', 'ends_on', 'status']);

        return response()->json([
            'data' => [
                'institution'  => [
                    'id'               => $institution->getKey(),
                    'name'             => $institution->name,
                    'institution_code' => $institution->institution_code,
                    'type'             => $institution->type,
                    'currency'         => $institution->currency ?? 'NPR',
                ],
                'user' => [
                    'name'  => $user->name,
                    'roles' => $user->getRoleNames()->all(),
                ],
                'filter'       => $filter,
                // --- Summary cards ---
                'students_total'          => $studentsTotal,
                'teachers_total'          => $teachersTotal,
                'staff_total'             => $staffTotal,
                'classes_total'           => $classesTotal,
                'sections_total'          => $sectionsTotal,
                'invoices_total'          => $invoicesTotal,
                'pending_payments'        => $pendingPayments,
                'new_admissions_month'    => $newAdmissionsThisMonth,
                'new_admissions_prev'     => $newAdmissionsLastMonth,
                // --- Attendance ---
                'attendance' => [
                    'today_present'          => $todayPresent,
                    'today_absent'           => $todayAbsent,
                    'today_late'             => $todayLate,
                    'today_total'            => $todayTotal,
                    'today_pct'              => $todayPct,
                    'teacher_today_present'  => $teacherTodayPresent,
                    'teacher_today_absent'   => $teacherTodayAbsent,
                    'teacher_today_total'    => $teacherTodayTotal,
                ],
                // --- Finance ---
                'finance' => [
                    'today_collection'    => (int) $todayCollection,
                    'month_collection'    => (int) $monthCollection,
                    'total_collection'    => (int) $totalCollection,
                    'outstanding'         => $outstanding,
                    'paid_invoices'       => $paidInvoices,
                    'unpaid_invoices'     => $unpaidInvoices,
                    'period_collection'   => (int) $periodPayments,
                ],
                // --- Charts ---
                'charts' => [
                    'monthly_collection' => $monthlyCollection,
                    'monthly_attendance' => $monthlyAttendance,
                    'enrollment_growth'  => $enrollmentGrowth,
                    'gender_dist'        => $genderDist,
                    'class_wise'         => $classWise,
                    'payment_methods'    => $paymentMethodDist,
                ],
                // --- Recent activity ---
                'recent' => [
                    'students'  => $recentStudents,
                    'teachers'  => $recentTeachers,
                    'payments'  => $recentPayments,
                    'invoices'  => $recentInvoices,
                ],
                // --- Upcoming ---
                'upcoming' => [
                    'examinations'   => $upcomingExaminations,
                    'notices'        => $upcomingNotices,
                    'overdue_fees'   => $overdueFees,
                ],
                // --- Top performance ---
                'top' => [
                    'classes_by_attendance' => $topClassesByAttendance,
                ],
                // --- Academic ---
                'academic' => [
                    'current_session' => $currentSession,
                    'period_students' => $periodStudents,
                ],
            ],
        ]);
    }

    public function accountant(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user instanceof User, 401);

        $posted    = Payment::query()->where('status', 'posted');
        $canManage = $user->can('finance.manage');

        return response()->json([
            'data' => [
                'collection_total'   => (int) (clone $posted)->sum('amount'),
                'collection_today'   => (int) (clone $posted)->whereDate('paid_on', today())->sum('amount'),
                'collection_month'   => (int) (clone $posted)->whereBetween('paid_on', [now()->startOfMonth(), now()->endOfMonth()])->sum('amount'),
                'pending_payments'   => Invoice::query()->whereIn('status', ['open', 'partial'])->count(),
                'outstanding'        => (int) Invoice::query()->selectRaw('coalesce(sum(amount - paid_amount), 0) as outstanding')->value('outstanding'),
                'overdue'            => (int) Invoice::query()->whereIn('status', ['open', 'partial'])->whereDate('due_on', '<', today())->count(),
                'income_total'       => (int) (clone $posted)->sum('amount'),
                'expense_total'      => $canManage ? (int) Expense::query()->sum('amount') : null,
                'cash_balance'       => $this->balance('1000'),
                'bank_balance'       => $this->balance('1010'),
                'recent_payments'    => Payment::query()->with('invoice.student:id,first_name,last_name,admission_number')->latest()->limit(8)->get(),
            ],
        ]);
    }

    // -------------------------------------------------------------------------
    private function period(string $filter): array
    {
        return match ($filter) {
            'today' => [today()->startOfDay(), today()->endOfDay()],
            'week'  => [now()->startOfWeek(), now()->endOfWeek()],
            'year'  => [now()->startOfYear(), now()->endOfYear()],
            default => [now()->startOfMonth(), now()->endOfMonth()], // month
        };
    }

    private function balance(string $code): int
    {
        $ids = LedgerAccount::query()->where('code', $code)->pluck('id');

        return (int) JournalLine::query()->whereIn('ledger_account_id', $ids)->sum('debit')
            - (int) JournalLine::query()->whereIn('ledger_account_id', $ids)->sum('credit');
    }
}
