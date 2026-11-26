import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Users, GraduationCap, BookOpen, Layers, CalendarCheck, Wallet,
    AlertCircle, FileText, Clock, TrendingUp, TrendingDown,
    UserPlus, UserCheck, ChevronRight, BarChart3, PieChart,
    Bell, CheckCircle, Minus, Building2, Activity,
    Banknote, CreditCard, BookMarked, Award, Calendar,
} from 'lucide-react';
import { api } from './api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChartPoint { label: string; value: number }
interface AttendancePoint { label: string; present: number; absent: number; total: number; pct: number }
interface GenderPoint { label: string; value: number }
interface ClassPoint { label: string; value: number }

interface DashboardData {
    institution: { id: number; name: string; institution_code: string; type: string; currency: string };
    user: { name: string; roles: string[] };
    filter: string;
    students_total: number;
    teachers_total: number;
    staff_total: number;
    classes_total: number;
    sections_total: number;
    invoices_total: number;
    pending_payments: number;
    new_admissions_month: number;
    new_admissions_prev: number;
    attendance: {
        today_present: number; today_absent: number; today_late: number;
        today_total: number; today_pct: number;
        teacher_today_present: number; teacher_today_absent: number; teacher_today_total: number;
    };
    finance: {
        today_collection: number; month_collection: number; total_collection: number;
        outstanding: number; paid_invoices: number; unpaid_invoices: number; period_collection: number;
    };
    charts: {
        monthly_collection: ChartPoint[];
        monthly_attendance: AttendancePoint[];
        enrollment_growth: ChartPoint[];
        gender_dist: GenderPoint[];
        class_wise: ClassPoint[];
        payment_methods: GenderPoint[];
    };
    recent: {
        students: Array<{ id: number; first_name: string; last_name: string; admission_number: string; created_at: string }>;
        teachers: Array<{ id: number; first_name: string; last_name: string; employee_code: string; created_at: string }>;
        payments: Array<{ id: number; amount: number; method: string; paid_on: string; receipt_number: string; invoice?: { student?: { first_name: string; last_name: string } } }>;
        invoices: Array<{ id: number; number: string; amount: number; status: string; due_on: string; student?: { first_name: string; last_name: string } }>;
    };
    upcoming: {
        examinations: Array<{ id: number; title: string; starts_on: string; ends_on: string }>;
        notices: Array<{ id: number; title: string; published_at: string }>;
        overdue_fees: Array<{ id: number; number: string; amount: number; paid_amount: number; due_on: string; student?: { first_name: string; last_name: string } }>;
    };
    top: {
        classes_by_attendance: Array<{ class: string; present: number; total: number; pct: number }>;
    };
    academic: { current_session: { name: string; starts_on: string; ends_on: string; status: string } | null; period_students: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FILTERS = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'year', label: 'This Year' },
] as const;

function fmt(n: number, currency = 'NPR') {
    if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${currency} ${(n / 1_000).toFixed(1)}K`;
    return `${currency} ${n.toLocaleString()}`;
}

function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function timeAgo(d: string) {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function statusColor(s: string) {
    if (s === 'paid') return 'text-emerald-600 bg-emerald-50';
    if (s === 'partial') return 'text-amber-600 bg-amber-50';
    if (s === 'open') return 'text-rose-600 bg-rose-50';
    return 'text-slate-600 bg-slate-50';
}

// ─── Sparkline bar chart ──────────────────────────────────────────────────────

function BarSparkline({ data, color = 'bg-blue-500' }: { data: ChartPoint[]; color?: string }) {
    if (!data.length) return <div className="flex items-end gap-0.5 h-12 opacity-30"><div className="flex-1 h-6 bg-slate-200 rounded-sm" /></div>;
    const max = Math.max(...data.map((d) => d.value), 1);
    return (
        <div className="flex items-end gap-0.5 h-12">
            {data.map((d, i) => (
                <div key={i} className="group relative flex-1 flex flex-col items-center justify-end" title={`${d.label}: ${d.value}`}>
                    <div
                        className={`w-full rounded-sm transition-all ${color} opacity-80 group-hover:opacity-100`}
                        style={{ height: `${Math.max(4, (d.value / max) * 48)}px` }}
                    />
                </div>
            ))}
        </div>
    );
}

function AttendanceSparkline({ data }: { data: AttendancePoint[] }) {
    if (!data.length) return <div className="flex items-end gap-0.5 h-12 opacity-30"><div className="flex-1 h-6 bg-slate-200 rounded-sm" /></div>;
    const max = Math.max(...data.map((d) => d.total), 1);
    return (
        <div className="flex items-end gap-0.5 h-12">
            {data.map((d, i) => (
                <div key={i} className="group relative flex-1 flex flex-col items-end justify-end" title={`${d.label}: ${d.pct}% present`}>
                    <div className="w-full bg-rose-300 rounded-sm opacity-70" style={{ height: `${Math.max(2, (d.absent / max) * 48)}px` }} />
                    <div className="w-full bg-emerald-400 rounded-sm" style={{ height: `${Math.max(2, (d.present / max) * 48)}px` }} />
                </div>
            ))}
        </div>
    );
}

function DonutChart({ data, colors }: { data: GenderPoint[]; colors: string[] }) {
    const total = data.reduce((s, d) => s + d.value, 0);
    if (!total) return <div className="h-24 w-24 rounded-full bg-slate-100 mx-auto" />;
    let offset = 0;
    const r = 36;
    const cx = 44;
    const cy = 44;
    const circ = 2 * Math.PI * r;
    const slices = data.map((d, i) => {
        const pct = d.value / total;
        const dash = pct * circ;
        const gap = circ - dash;
        const slice = { d, i, dash, gap, offset, color: colors[i % colors.length] };
        offset += dash;
        return slice;
    });
    return (
        <div className="relative mx-auto w-[88px] h-[88px]">
            <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90">
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth="12" />
                {slices.map((s) => (
                    <circle key={s.i} cx={cx} cy={cy} r={r} fill="none"
                        stroke={s.color} strokeWidth="12"
                        strokeDasharray={`${s.dash} ${s.gap}`}
                        strokeDashoffset={-s.offset} />
                ))}
            </svg>
        </div>
    );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    iconBg: string;
    iconColor: string;
    change?: number | null;
    changeLabel?: string;
    sub?: string;
    to?: string;
}

function SummaryCard({ title, value, icon, iconBg, iconColor, change, changeLabel, sub, to }: SummaryCardProps) {
    const inner = (
        <div className="group flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5">
            <div className="flex items-start justify-between">
                <div className={`flex size-11 items-center justify-center rounded-xl ${iconBg} ${iconColor}`}>
                    {icon}
                </div>
                {change != null && (
                    <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${change >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        {change >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                        {Math.abs(change)}%
                    </div>
                )}
            </div>
            <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
                {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
                {changeLabel && <p className="mt-0.5 text-xs text-slate-400">{changeLabel}</p>}
            </div>
        </div>
    );
    return to ? <Link to={to} className="block">{inner}</Link> : inner;
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionTitle({ title, sub }: { title: string; sub?: string }) {
    return (
        <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {sub && <p className="text-xs text-slate-500">{sub}</p>}
        </div>
    );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ className = '' }: { className?: string }) {
    return <div className={`animate-pulse rounded-lg bg-slate-100 ${className}`} />;
}

function DashboardSkeleton() {
    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-56" />)}
            </div>
        </div>
    );
}

// ─── Quick Actions ────────────────────────────────────────────────────────────

const quickActions = [
    { label: 'Register Student', icon: <UserPlus className="size-4" />, to: '/students/create', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
    { label: 'Add Teacher', icon: <GraduationCap className="size-4" />, to: '/teachers', color: 'bg-violet-50 text-violet-700 hover:bg-violet-100' },
    { label: 'Add Staff', icon: <Building2 className="size-4" />, to: '/staff', color: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
    { label: 'Create Invoice', icon: <FileText className="size-4" />, to: '/invoices', color: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
    { label: 'Collect Fee', icon: <Banknote className="size-4" />, to: '/fee-collection', color: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
    { label: 'Take Attendance', icon: <CalendarCheck className="size-4" />, to: '/attendance/students', color: 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100' },
    { label: 'Add Class', icon: <Layers className="size-4" />, to: '/classes', color: 'bg-rose-50 text-rose-700 hover:bg-rose-100' },
    { label: 'Add Subject', icon: <BookOpen className="size-4" />, to: '/subjects', color: 'bg-orange-50 text-orange-700 hover:bg-orange-100' },
];

// ─── Main Dashboard ────────────────────────────────────────────────────────────

export function InstitutionHome() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filter, setFilter] = useState<'today' | 'week' | 'month' | 'year'>('month');

    useEffect(() => {
        setLoading(true);
        setError(null);
        api.get<{ data: DashboardData }>(`/api/institution/dashboard?filter=${filter}`)
            .then(({ data: res }) => setData(res.data))
            .catch(() => setError('Failed to load dashboard data. Please refresh.'))
            .finally(() => setLoading(false));
    }, [filter]);

    if (loading) return <DashboardSkeleton />;

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
                    <AlertCircle className="size-7" />
                </div>
                <p className="text-sm text-slate-600">{error}</p>
                <button onClick={() => setFilter(filter)} className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800">
                    Retry
                </button>
            </div>
        );
    }

    if (!data) return null;

    const currency = data.institution.currency;
    const att = data.attendance;
    const fin = data.finance;
    const charts = data.charts;

    // Admission trend
    const admissionChange = data.new_admissions_prev > 0
        ? Math.round(((data.new_admissions_month - data.new_admissions_prev) / data.new_admissions_prev) * 100)
        : null;

    return (
        <div className="space-y-7">
            {/* ── Header ── */}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-bold text-slate-900">{data.institution.name}</h1>
                    <p className="text-sm text-slate-500">
                        Welcome back, {data.user.name} · {data.academic.current_session ? data.academic.current_session.name : 'No active session'}
                    </p>
                </div>
                {/* Filter tabs */}
                <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
                    {FILTERS.map((f) => (
                        <button
                            key={f.key}
                            onClick={() => setFilter(f.key)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${filter === f.key ? 'bg-blue-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Summary Cards ── */}
            <div>
                <SectionTitle title="Overview" sub="Key metrics for your institution" />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    <SummaryCard
                        title="Total Students" value={data.students_total.toLocaleString()}
                        icon={<Users className="size-5" />} iconBg="bg-blue-50" iconColor="text-blue-700"
                        sub={`+${data.new_admissions_month} this month`}
                        change={admissionChange}
                        to="/students"
                    />
                    <SummaryCard
                        title="Total Teachers" value={data.teachers_total.toLocaleString()}
                        icon={<GraduationCap className="size-5" />} iconBg="bg-violet-50" iconColor="text-violet-700"
                        to="/teachers"
                    />
                    <SummaryCard
                        title="Total Staff" value={data.staff_total.toLocaleString()}
                        icon={<Building2 className="size-5" />} iconBg="bg-indigo-50" iconColor="text-indigo-700"
                        to="/staff"
                    />
                    <SummaryCard
                        title="Classes" value={data.classes_total.toLocaleString()}
                        icon={<Layers className="size-5" />} iconBg="bg-cyan-50" iconColor="text-cyan-700"
                        sub={`${data.sections_total} sections`}
                        to="/classes"
                    />
                    <SummaryCard
                        title="Today's Attendance" value={`${att.today_pct}%`}
                        icon={<CalendarCheck className="size-5" />} iconBg="bg-emerald-50" iconColor="text-emerald-700"
                        sub={`${att.today_present} present of ${att.today_total}`}
                        to="/attendance/students"
                    />
                    <SummaryCard
                        title="Fee Collection" value={fmt(fin.month_collection, currency)}
                        icon={<Wallet className="size-5" />} iconBg="bg-amber-50" iconColor="text-amber-700"
                        sub={`Today: ${fmt(fin.today_collection, currency)}`}
                        to="/payments"
                    />
                    <SummaryCard
                        title="Outstanding Fees" value={fmt(fin.outstanding, currency)}
                        icon={<AlertCircle className="size-5" />} iconBg="bg-rose-50" iconColor="text-rose-700"
                        to="/outstanding-fees"
                    />
                    <SummaryCard
                        title="Total Invoices" value={data.invoices_total.toLocaleString()}
                        icon={<FileText className="size-5" />} iconBg="bg-orange-50" iconColor="text-orange-700"
                        sub={`${fin.paid_invoices} paid`}
                        to="/invoices"
                    />
                    <SummaryCard
                        title="Pending Payments" value={data.pending_payments.toLocaleString()}
                        icon={<Clock className="size-5" />} iconBg="bg-pink-50" iconColor="text-pink-700"
                        to="/outstanding-fees"
                    />
                    <SummaryCard
                        title="Total Collection" value={fmt(fin.total_collection, currency)}
                        icon={<Banknote className="size-5" />} iconBg="bg-teal-50" iconColor="text-teal-700"
                        to="/financial-reports"
                    />
                </div>
            </div>

            {/* ── Quick Actions ── */}
            <div>
                <SectionTitle title="Quick Actions" sub="Common tasks at a glance" />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                    {quickActions.map((a) => (
                        <Link
                            key={a.label} to={a.to}
                            className={`flex flex-col items-center gap-2 rounded-xl border border-transparent px-3 py-4 text-center text-xs font-medium transition-all hover:border-slate-200 ${a.color}`}
                        >
                            <span className="flex size-9 items-center justify-center rounded-xl bg-white/60 shadow-sm">
                                {a.icon}
                            </span>
                            {a.label}
                        </Link>
                    ))}
                </div>
            </div>

            {/* ── Attendance + Finance Overview ── */}
            <div className="grid gap-4 lg:grid-cols-3">
                {/* Attendance card */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-slate-900">Today's Attendance</p>
                            <p className="text-xs text-slate-500">Student attendance</p>
                        </div>
                        <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                            <CalendarCheck className="size-4" />
                        </span>
                    </div>
                    <div className="mb-4 flex items-end gap-1">
                        <span className="text-4xl font-bold text-slate-900">{att.today_pct}%</span>
                        <span className="mb-1 text-sm text-slate-400">attendance rate</span>
                    </div>
                    <div className="mb-4 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${att.today_pct}%` }} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-emerald-50 py-2">
                            <p className="text-lg font-bold text-emerald-700">{att.today_present}</p>
                            <p className="text-xs text-emerald-600">Present</p>
                        </div>
                        <div className="rounded-xl bg-rose-50 py-2">
                            <p className="text-lg font-bold text-rose-700">{att.today_absent}</p>
                            <p className="text-xs text-rose-600">Absent</p>
                        </div>
                        <div className="rounded-xl bg-amber-50 py-2">
                            <p className="text-lg font-bold text-amber-700">{att.today_late}</p>
                            <p className="text-xs text-amber-600">Late</p>
                        </div>
                    </div>
                    {att.teacher_today_total > 0 && (
                        <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2">
                            <p className="text-xs font-medium text-slate-600">Teacher Attendance</p>
                            <div className="mt-1 flex items-center gap-3">
                                <span className="text-sm font-semibold text-slate-900">{att.teacher_today_present}/{att.teacher_today_total}</span>
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${att.teacher_today_total > 0 ? (att.teacher_today_present / att.teacher_today_total) * 100 : 0}%` }} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Finance summary */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-slate-900">Finance Overview</p>
                            <p className="text-xs text-slate-500">Collections & invoices</p>
                        </div>
                        <span className="flex size-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                            <Wallet className="size-4" />
                        </span>
                    </div>
                    <div className="space-y-3">
                        <FinanceStat label="Today's Collection" value={fmt(fin.today_collection, currency)} color="text-emerald-600" />
                        <FinanceStat label="This Month" value={fmt(fin.month_collection, currency)} color="text-blue-600" />
                        <FinanceStat label="Total Collection" value={fmt(fin.total_collection, currency)} color="text-slate-900" />
                        <div className="my-1 border-t border-slate-100" />
                        <FinanceStat label="Outstanding Fees" value={fmt(fin.outstanding, currency)} color="text-rose-600" />
                        <FinanceStat label="Pending Payments" value={`${data.pending_payments} invoices`} color="text-amber-600" />
                    </div>
                    <div className="mt-4 flex gap-2">
                        <div className="flex-1 rounded-xl bg-emerald-50 py-2 text-center">
                            <p className="text-sm font-bold text-emerald-700">{fin.paid_invoices}</p>
                            <p className="text-[10px] text-emerald-600">Paid</p>
                        </div>
                        <div className="flex-1 rounded-xl bg-amber-50 py-2 text-center">
                            <p className="text-sm font-bold text-amber-700">{fin.unpaid_invoices}</p>
                            <p className="text-[10px] text-amber-600">Unpaid</p>
                        </div>
                    </div>
                </div>

                {/* Student overview */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-slate-900">Student Overview</p>
                            <p className="text-xs text-slate-500">Enrollment & distribution</p>
                        </div>
                        <span className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                            <Users className="size-4" />
                        </span>
                    </div>
                    {/* Gender donut */}
                    <div className="flex items-center gap-4">
                        <DonutChart
                            data={charts.gender_dist}
                            colors={['#3b82f6', '#ec4899', '#94a3b8']}
                        />
                        <div className="flex-1 space-y-1.5">
                            {charts.gender_dist.map((d, i) => {
                                const colors = ['#3b82f6', '#ec4899', '#94a3b8'];
                                const total = charts.gender_dist.reduce((s, x) => s + x.value, 0);
                                return (
                                    <div key={i} className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-1.5">
                                            <span className="size-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                                            <span className="capitalize text-slate-600">{d.label}</span>
                                        </div>
                                        <span className="font-medium text-slate-900">
                                            {d.value} ({total > 0 ? Math.round((d.value / total) * 100) : 0}%)
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-blue-50 p-3">
                            <p className="text-xs text-blue-600">New This Month</p>
                            <p className="text-xl font-bold text-blue-800">{data.new_admissions_month}</p>
                        </div>
                        <div className="rounded-xl bg-slate-50 p-3">
                            <p className="text-xs text-slate-500">Last Month</p>
                            <p className="text-xl font-bold text-slate-700">{data.new_admissions_prev}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Charts Row ── */}
            <div className="grid gap-4 lg:grid-cols-2">
                {/* Monthly fee collection chart */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-slate-900">Monthly Fee Collection</p>
                            <p className="text-xs text-slate-500">Last 6 months</p>
                        </div>
                        <BarChart3 className="size-4 text-slate-400" />
                    </div>
                    <BarSparkline data={charts.monthly_collection} color="bg-blue-500" />
                    <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                        {charts.monthly_collection.map((d) => <span key={d.label}>{d.label.split(' ')[0]}</span>)}
                    </div>
                    {charts.monthly_collection.length === 0 && (
                        <p className="mt-2 text-center text-xs text-slate-400">No collection data yet</p>
                    )}
                </div>

                {/* Monthly attendance chart */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-slate-900">Monthly Attendance Trend</p>
                            <p className="text-xs text-slate-500">Present vs Absent · last 6 months</p>
                        </div>
                        <Activity className="size-4 text-slate-400" />
                    </div>
                    <AttendanceSparkline data={charts.monthly_attendance} />
                    <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                        {charts.monthly_attendance.map((d) => <span key={d.label}>{d.label.split(' ')[0]}</span>)}
                    </div>
                    <div className="mt-2 flex gap-3">
                        <div className="flex items-center gap-1 text-xs text-slate-500"><span className="size-2 rounded-full bg-emerald-400" /> Present</div>
                        <div className="flex items-center gap-1 text-xs text-slate-500"><span className="size-2 rounded-full bg-rose-300" /> Absent</div>
                    </div>
                </div>

                {/* Enrollment growth */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-slate-900">Student Enrollment Growth</p>
                            <p className="text-xs text-slate-500">New admissions per month</p>
                        </div>
                        <TrendingUp className="size-4 text-slate-400" />
                    </div>
                    <BarSparkline data={charts.enrollment_growth} color="bg-violet-500" />
                    <div className="mt-2 flex justify-between text-[10px] text-slate-400">
                        {charts.enrollment_growth.map((d) => <span key={d.label}>{d.label.split(' ')[0]}</span>)}
                    </div>
                </div>

                {/* Class-wise distribution */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-slate-900">Class-wise Student Distribution</p>
                            <p className="text-xs text-slate-500">Students per class</p>
                        </div>
                        <PieChart className="size-4 text-slate-400" />
                    </div>
                    {charts.class_wise.length === 0 ? (
                        <EmptyState label="No classes set up yet" />
                    ) : (
                        <div className="space-y-2">
                            {charts.class_wise.map((c, i) => {
                                const max = Math.max(...charts.class_wise.map((x) => x.value), 1);
                                return (
                                    <div key={i} className="flex items-center gap-2">
                                        <span className="w-24 truncate text-xs text-slate-600">{c.label}</span>
                                        <div className="flex-1 overflow-hidden rounded-full bg-slate-100 h-2">
                                            <div className="h-full rounded-full bg-blue-500" style={{ width: `${(c.value / max) * 100}%` }} />
                                        </div>
                                        <span className="w-7 text-right text-xs font-medium text-slate-700">{c.value}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Top Performance + Upcoming ── */}
            <div className="grid gap-4 lg:grid-cols-3">
                {/* Top classes by attendance */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">Top Classes – Attendance</p>
                        <Award className="size-4 text-amber-500" />
                    </div>
                    {data.top.classes_by_attendance.length === 0 ? (
                        <EmptyState label="No attendance recorded today" />
                    ) : (
                        <div className="space-y-3">
                            {data.top.classes_by_attendance.map((c, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                                        {i + 1}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-xs font-medium text-slate-800">{c.class}</p>
                                        <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${c.pct}%` }} />
                                        </div>
                                    </div>
                                    <span className={`text-xs font-semibold ${c.pct >= 80 ? 'text-emerald-600' : c.pct >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>
                                        {c.pct}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Upcoming examinations */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">Upcoming Examinations</p>
                        <BookMarked className="size-4 text-slate-400" />
                    </div>
                    {data.upcoming.examinations.length === 0 ? (
                        <EmptyState label="No upcoming examinations" />
                    ) : (
                        <div className="space-y-2">
                            {data.upcoming.examinations.map((e) => (
                                <div key={e.id} className="flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                                        <Calendar className="size-3" />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="truncate text-xs font-medium text-slate-800">{e.title}</p>
                                        <p className="text-[10px] text-slate-500">{fmtDate(e.starts_on)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <Link to="/examinations" className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800">
                        View all <ChevronRight className="size-3" />
                    </Link>
                </div>

                {/* Overdue fees */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">Overdue Fee Invoices</p>
                        <AlertCircle className="size-4 text-rose-500" />
                    </div>
                    {data.upcoming.overdue_fees.length === 0 ? (
                        <EmptyState label="No overdue fees 🎉" />
                    ) : (
                        <div className="space-y-2">
                            {data.upcoming.overdue_fees.map((inv) => (
                                <div key={inv.id} className="flex items-center justify-between gap-2 rounded-xl bg-rose-50 px-3 py-2">
                                    <div className="min-w-0">
                                        <p className="truncate text-xs font-medium text-slate-800">
                                            {inv.student ? `${inv.student.first_name} ${inv.student.last_name}` : inv.number}
                                        </p>
                                        <p className="text-[10px] text-rose-500">Due: {fmtDate(inv.due_on)}</p>
                                    </div>
                                    <span className="shrink-0 text-xs font-semibold text-rose-700">
                                        {fmt(inv.amount - inv.paid_amount, currency)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                    <Link to="/outstanding-fees" className="mt-3 flex items-center gap-1 text-xs font-medium text-rose-700 hover:text-rose-800">
                        View all <ChevronRight className="size-3" />
                    </Link>
                </div>
            </div>

            {/* ── Recent Activity ── */}
            <div className="grid gap-4 lg:grid-cols-2">
                {/* Recent students */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">Recently Registered Students</p>
                        <UserPlus className="size-4 text-slate-400" />
                    </div>
                    {data.recent.students.length === 0 ? (
                        <EmptyState label="No students yet" />
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {data.recent.students.map((s) => (
                                <div key={s.id} className="flex items-center gap-3 py-2.5">
                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                                        {s.first_name[0]}{s.last_name[0]}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-medium text-slate-800">{s.first_name} {s.last_name}</p>
                                        <p className="text-[10px] text-slate-400">#{s.admission_number}</p>
                                    </div>
                                    <span className="text-[10px] text-slate-400">{timeAgo(s.created_at)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <Link to="/students" className="mt-2 flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800">
                        View all students <ChevronRight className="size-3" />
                    </Link>
                </div>

                {/* Recent payments */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">Recent Fee Payments</p>
                        <CreditCard className="size-4 text-slate-400" />
                    </div>
                    {data.recent.payments.length === 0 ? (
                        <EmptyState label="No payments yet" />
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {data.recent.payments.map((p) => (
                                <div key={p.id} className="flex items-center gap-3 py-2.5">
                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                                        <CheckCircle className="size-4" />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-medium text-slate-800">
                                            {p.invoice?.student ? `${p.invoice.student.first_name} ${p.invoice.student.last_name}` : `Receipt #${p.receipt_number}`}
                                        </p>
                                        <p className="text-[10px] text-slate-400 capitalize">{p.method} · {fmtDate(p.paid_on)}</p>
                                    </div>
                                    <span className="text-xs font-semibold text-emerald-700">{fmt(p.amount, currency)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <Link to="/payments" className="mt-2 flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800">
                        View all payments <ChevronRight className="size-3" />
                    </Link>
                </div>

                {/* Recent teachers */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">Recently Added Teachers</p>
                        <UserCheck className="size-4 text-slate-400" />
                    </div>
                    {data.recent.teachers.length === 0 ? (
                        <EmptyState label="No teachers yet" />
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {data.recent.teachers.map((t) => (
                                <div key={t.id} className="flex items-center gap-3 py-2.5">
                                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                                        {t.first_name[0]}{t.last_name[0]}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-medium text-slate-800">{t.first_name} {t.last_name}</p>
                                        <p className="text-[10px] text-slate-400">#{t.employee_code}</p>
                                    </div>
                                    <span className="text-[10px] text-slate-400">{timeAgo(t.created_at)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <Link to="/teachers" className="mt-2 flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800">
                        View all teachers <ChevronRight className="size-3" />
                    </Link>
                </div>

                {/* Recent invoices */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">Recent Invoices</p>
                        <FileText className="size-4 text-slate-400" />
                    </div>
                    {data.recent.invoices.length === 0 ? (
                        <EmptyState label="No invoices yet" />
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {data.recent.invoices.map((inv) => (
                                <div key={inv.id} className="flex items-center gap-3 py-2.5">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-medium text-slate-800">
                                            {inv.student ? `${inv.student.first_name} ${inv.student.last_name}` : `Invoice #${inv.number}`}
                                        </p>
                                        <p className="text-[10px] text-slate-400">Due: {fmtDate(inv.due_on)}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${statusColor(inv.status)}`}>
                                            {inv.status}
                                        </span>
                                        <span className="text-xs font-semibold text-slate-700">{fmt(inv.amount, currency)}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <Link to="/invoices" className="mt-2 flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800">
                        View all invoices <ChevronRight className="size-3" />
                    </Link>
                </div>
            </div>

            {/* ── Notices ── */}
            {data.upcoming.notices.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <p className="text-sm font-semibold text-slate-900">Recent Notices & Announcements</p>
                        <Bell className="size-4 text-slate-400" />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {data.upcoming.notices.map((n) => (
                            <div key={n.id} className="flex items-start gap-3 rounded-xl bg-blue-50 px-3 py-2.5">
                                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                                    <Bell className="size-3" />
                                </span>
                                <div className="min-w-0">
                                    <p className="truncate text-xs font-medium text-slate-800">{n.title}</p>
                                    <p className="text-[10px] text-slate-500">{timeAgo(n.published_at)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                    <Link to="/notices" className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800">
                        View all notices <ChevronRight className="size-3" />
                    </Link>
                </div>
            )}
        </div>
    );
}

// ─── Minor helpers ─────────────────────────────────────────────────────────────

function FinanceStat({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">{label}</span>
            <span className={`text-sm font-semibold ${color}`}>{value}</span>
        </div>
    );
}

function EmptyState({ label }: { label: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-6 text-center">
            <Minus className="mb-2 size-5 text-slate-300" />
            <p className="text-xs text-slate-400">{label}</p>
        </div>
    );
}
