import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
    Bar,
    BarChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import {
    Bell,
    BookOpen,
    Building2,
    ChevronRight,
    GraduationCap,
    LayoutDashboard,
    PanelLeftClose,
    PanelLeftOpen,
    Receipt,
    Search,
    Settings,
    ShieldCheck,
    Users,
    Wallet,
    X,
} from 'lucide-react';
import { AppSidebar, visibleGroups, type NavGroup } from './sidebar';
import { Link, Outlet, useNavigate, useParams } from 'react-router-dom';
import { api, getErrorMessage, type AuthUser, type InstitutionDashboard, type PlatformDashboard } from './api';
import { TopNavbar } from './top-navbar';
export { StudentsPage } from './students-page';

interface AuthApi {
    user: AuthUser | null;
    setUser: (user: AuthUser | null) => void;
}

export function useWorkspaceAuth(): AuthApi {
    const holder = (window as Window & { __campusAuth?: AuthApi }).__campusAuth;

    if (!holder) {
        throw new Error('Auth is unavailable.');
    }

    return holder;
}

export function publishAuth(value: AuthApi): void {
    (window as Window & { __campusAuth?: AuthApi }).__campusAuth = value;
}

const platformNav: NavGroup[] = [
    { label: 'Dashboard', icon: LayoutDashboard, items: [{ label: 'Dashboard', to: '/admin/dashboard' }] },
    { label: 'Institution Management', icon: Building2, items: [
        { label: 'Institutions', to: '/admin/institutions' },
        { label: 'Add Institution', to: '/admin/institutions/create' },
        { label: 'Institution Users', to: '/admin/users' },
        { label: 'Institution Categories', to: '/admin/institution-categories' },
    ] },
    { label: 'Subscription Management', icon: Wallet, items: [
        { label: 'Plans', to: '/admin/plans' },
        { label: 'Subscriptions', to: '/admin/subscriptions' },
        { label: 'Expiring Subscriptions', to: '/admin/subscriptions/expiring' },
    ] },
    { label: 'System Management', icon: Settings, items: [
        { label: 'Module Management', to: '/admin/modules' },
        { label: 'Roles & Permissions', to: '/admin/roles' },
        { label: 'Support & Requests', to: '/admin/support' },
    ] },
    { label: 'Reports & Monitoring', icon: Receipt, items: [
        { label: 'Reports & Analytics', to: '/admin/reports' },
        { label: 'Activity Logs', to: '/admin/activity-logs' },
    ] },
    { label: 'Configuration', icon: ShieldCheck, items: [
        { label: 'System Settings', to: '/admin/settings' },
        { label: 'Backup & Maintenance', to: '/admin/maintenance' },
    ] },
];

const institutionNav: NavGroup[] = [
    { label: 'Dashboard', icon: LayoutDashboard, items: [{ label: 'Dashboard', to: '/dashboard' }] },
    { label: 'Student & Staff Management', icon: Users, items: [
        { label: 'Students', to: '/students', permission: 'students.manage' },
        { label: 'Staff Management', to: '/staff', permission: 'staff.manage' },
    ] },
    { label: 'Academic Management', icon: BookOpen, items: [
        { label: 'Academics', to: '/academics', permission: 'academics.manage' },
        { label: 'Classes & Sections', to: '/classes', permission: 'academics.manage' },
        { label: 'Subjects', to: '/subjects', permission: 'academics.manage' },
        { label: 'Timetable', to: '/timetable', permission: 'academics.manage' },
        { label: 'Examinations', to: '/examinations', permission: 'marks.enter' },
        { label: 'Marks & Results', to: '/marks', permission: 'marks.enter' },
    ] },
    { label: 'Attendance', icon: Bell, items: [
        { label: 'Student Attendance', to: '/attendance/students', permission: 'attendance.manage' },
        { label: 'Teacher Attendance', to: '/attendance/teachers', permission: 'attendance.manage' },
        { label: 'Attendance Reports', to: '/attendance/reports', permission: 'attendance.manage' },
    ] },
    { label: 'Accounting & Finance', icon: Wallet, items: [
        { label: 'Fee Structures & Rules', to: '/fee-structures', permission: 'finance.manage' },
        { label: 'Invoices', to: '/invoices', permission: 'finance.manage' },
        { label: 'Payments', to: '/payments', any: ['finance.manage', 'finance.collect'] },
        { label: 'Fee Collection', to: '/fee-collection', any: ['finance.manage', 'finance.collect'] },
        { label: 'Outstanding Fees', to: '/outstanding-fees', any: ['finance.manage', 'finance.collect'] },
        { label: 'Financial Reports', to: '/financial-reports', permission: 'finance.manage' },
    ] },
    { label: 'Communication', icon: Bell, items: [
        { label: 'Notices', to: '/notices', permission: 'notices.manage' },
        { label: 'Documents', to: '/documents', permission: 'notices.manage' },
    ] },
    { label: 'Administration', icon: Settings, items: [
        { label: 'User Management', to: '/users', permission: 'institution-admin' },
        { label: 'Roles & Permissions', to: '/roles', permission: 'institution-admin' },
        { label: 'Reports', to: '/reports' },
        { label: 'Settings', to: '/settings' },
    ] },
];

export function PlatformApp() {
    return (
        <Shell audience="platform" navigation={platformNav}>
            <Outlet />
        </Shell>
    );
}

export function InstitutionApp() {
    const { user } = useWorkspaceAuth();
    const navigation = visibleGroups(institutionNav, user?.permissions ?? [], user?.roles ?? []);

    return (
        <Shell audience="institution" navigation={navigation}>
            <Outlet />
        </Shell>
    );
}

function Shell({
    audience,
    navigation,
    children,
}: {
    audience: 'platform' | 'institution';
    navigation: NavGroup[];
    children: ReactNode;
}) {
    const { user, setUser } = useWorkspaceAuth();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const [query, setQuery] = useState('');

    async function logout() {
        await api.post('/api/logout');
        setUser(null);
        navigate('/', { replace: true });
    }

    const filtered = navigation
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => `${group.label} ${item.label}`.toLowerCase().includes(query.toLowerCase())),
        }))
        .filter((group) => group.items.length > 0);

    return (
        <div className={`bg-[#f4f6f8] text-slate-900 lg:grid lg:h-screen lg:overflow-hidden ${collapsed ? 'lg:grid-cols-[76px_minmax(0,1fr)]' : 'lg:grid-cols-[272px_minmax(0,1fr)]'}`}>
            {open && <button className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" aria-label="Close navigation" onClick={() => setOpen(false)} />}
            <aside className={`fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col border-r border-slate-200 bg-[#f7f8fa] transition-transform lg:static lg:h-full lg:w-auto lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 px-4">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white"><GraduationCap className="size-4" /></span>
                    {!collapsed && (
                        <div className="min-w-0">
                            <p className="text-sm font-semibold">Campus OS</p>
                            <p className="truncate text-[11px] text-slate-500">{audience === 'platform' ? 'IT management' : user?.institution?.name}</p>
                        </div>
                    )}
                    <button className="ml-auto hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:inline-flex" aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} onClick={() => setCollapsed((value) => !value)}>
                        {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
                    </button>
                    <button className="ml-auto lg:hidden" aria-label="Close navigation" onClick={() => setOpen(false)}><X className="size-4" /></button>
                </div>
                {!collapsed && <div className="shrink-0 px-3 py-3">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-slate-400" />
                        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a section" className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-500" />
                    </div>
                </div>}
                <AppSidebar groups={filtered} collapsed={collapsed} onNavigate={() => setOpen(false)} />
            </aside>
            <div className="flex min-w-0 flex-col lg:overflow-y-auto">
                <TopNavbar user={user} onOpenMenu={() => setOpen(true)} onLogout={logout} />
                <motion.main initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }} className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
                    {children}
                </motion.main>
            </div>
        </div>
    );
}

function PageTitle({ title, detail }: { title: string; detail: string }) {
    return (
        <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-slate-500">{detail}</p>
        </div>
    );
}

function Panel({ children }: { children: ReactNode }) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-5">{children}</div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <label className="block text-sm">
            <span className="mb-1.5 block font-medium text-slate-700">{label}</span>
            {children}
        </label>
    );
}

const inputClass = 'h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100';

export function PlatformHome() {
    const [dashboard, setDashboard] = useState<PlatformDashboard | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api.get<{ data: PlatformDashboard }>('/api/admin/dashboard')
            .then(({ data }) => setDashboard(data.data))
            .catch((reason: unknown) => setError(getErrorMessage(reason, 'Unable to load platform metrics.')));
    }, []);

    if (error) {
        return <Panel><p className="text-sm text-rose-700">{error}</p></Panel>;
    }

    const chart = dashboard ? [
        { name: 'Schools', value: dashboard.schools_total },
        { name: 'Colleges', value: dashboard.colleges_total },
        { name: 'Active', value: dashboard.institutions_active },
        { name: 'Other', value: dashboard.institutions_inactive },
    ] : [];

    return (
        <>
            <PageTitle title="Platform overview" detail="Live institution and subscription totals." />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Institutions" value={dashboard?.institutions_total} />
                <Metric label="Active" value={dashboard?.institutions_active} />
                <Metric label="Users" value={dashboard?.users_total} />
                <Metric label="MRR (NPR)" value={dashboard?.monthly_recurring_revenue} />
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
                <Panel>
                    <h2 className="mb-4 text-sm font-semibold">Institution mix</h2>
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chart}>
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                <Tooltip />
                                <Bar dataKey="value" fill="#1d4ed8" radius={6} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Panel>
                <Panel>
                    <h2 className="mb-3 text-sm font-semibold">Recent institutions</h2>
                    <ul className="divide-y divide-slate-100">
                        {(dashboard?.recent_institutions ?? []).map((institution) => (
                            <li key={institution.id} className="flex items-center justify-between py-3 text-sm">
                                <Link to={`/admin/institutions/${institution.id}`} className="font-medium text-blue-800">{institution.name}</Link>
                                <span className="text-slate-500">{institution.institution_code}</span>
                            </li>
                        ))}
                        {dashboard && dashboard.recent_institutions.length === 0 && <li className="py-3 text-sm text-slate-500">No institutions yet.</li>}
                    </ul>
                </Panel>
            </div>
        </>
    );
}

function Metric({ label, value }: { label: string; value?: number }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold">{value === undefined ? '—' : value.toLocaleString()}</p>
        </div>
    );
}

interface InstitutionRow {
    id: number;
    name: string;
    institution_code: string;
    type: string;
    status: string;
    email?: string | null;
    users_count?: number;
}

export function InstitutionList() {
    const [rows, setRows] = useState<InstitutionRow[]>([]);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api.get<{ data: InstitutionRow[] }>('/api/admin/institutions')
            .then(({ data }) => setRows(data.data))
            .catch((reason: unknown) => setError(getErrorMessage(reason, 'Unable to load institutions.')));
    }, []);

    return (
        <>
            <div className="mb-6 flex items-center justify-between">
                <PageTitle title="Institutions" detail="Each institution keeps its own academic and finance records." />
                <Link to="/admin/institutions/create" className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white">Add</Link>
            </div>
            {error && <p className="text-sm text-rose-700">{error}</p>}
            <Panel>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="text-slate-500"><tr><th className="py-2">Name</th><th>Code</th><th>Type</th><th>Status</th><th>Users</th></tr></thead>
                        <tbody>
                            {rows.map((row) => (
                                <tr key={row.id} className="border-t border-slate-100">
                                    <td className="py-3"><Link className="font-medium text-blue-800" to={`/admin/institutions/${row.id}`}>{row.name}</Link></td>
                                    <td>{row.institution_code}</td>
                                    <td className="capitalize">{row.type}</td>
                                    <td className="capitalize">{row.status}</td>
                                    <td>{row.users_count ?? 0}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Panel>
        </>
    );
}

interface Plan {
    id: number;
    name: string;
    price_monthly: number;
    currency: string;
    modules: string[];
}

export function InstitutionCreate() {
    const navigate = useNavigate();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        api.get<{ data: Plan[] }>('/api/admin/plans').then(({ data }) => setPlans(data.data));
    }, []);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitting(true);
        setError(null);
        const form = new FormData(event.currentTarget);
        const payload = Object.fromEntries(form.entries());

        try {
            const { data } = await api.post<{ data: InstitutionRow }>('/api/admin/institutions', {
                ...payload,
                subscription_plan_id: Number(payload.subscription_plan_id),
            });
            navigate(`/admin/institutions/${data.data.id}`);
        } catch (reason: unknown) {
            setError(getErrorMessage(reason, 'Unable to create the institution.'));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <>
            <PageTitle title="Add institution" detail="Creates the campus, its administrator, subscription, and ledger accounts together." />
            <Panel>
                {error && <p className="mb-4 text-sm text-rose-700">{error}</p>}
                <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
                    <Field label="Institution name"><input name="name" required className={inputClass} /></Field>
                    <Field label="Type">
                        <select name="type" className={inputClass} defaultValue="school">
                            <option value="school">School</option>
                            <option value="college">College</option>
                            <option value="university">University</option>
                        </select>
                    </Field>
                    <Field label="Email"><input name="email" type="email" className={inputClass} /></Field>
                    <Field label="Phone"><input name="phone" className={inputClass} /></Field>
                    <Field label="Province"><input name="province" className={inputClass} /></Field>
                    <Field label="District"><input name="district" className={inputClass} /></Field>
                    <Field label="Address"><input name="address" className={inputClass} /></Field>
                    <Field label="Administrator name"><input name="admin_name" required className={inputClass} /></Field>
                    <Field label="Administrator email"><input name="admin_email" type="email" required className={inputClass} /></Field>
                    <Field label="Temporary password"><input name="admin_password" type="password" minLength={8} required className={inputClass} /></Field>
                    <Field label="Plan">
                        <select name="subscription_plan_id" required className={inputClass} defaultValue={plans[0]?.id}>
                            {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · NPR {plan.price_monthly.toLocaleString()}</option>)}
                        </select>
                    </Field>
                    <Field label="Starts"><input name="starts_on" type="date" required className={inputClass} /></Field>
                    <Field label="Expires"><input name="expires_on" type="date" required className={inputClass} /></Field>
                    <div className="md:col-span-2">
                        <button disabled={submitting} className="h-11 rounded-xl bg-blue-700 px-5 text-sm font-semibold text-white disabled:opacity-60">{submitting ? 'Creating…' : 'Create institution'}</button>
                    </div>
                </form>
            </Panel>
        </>
    );
}

export function InstitutionDetail() {
    const { id } = useParams();
    const [institution, setInstitution] = useState<InstitutionRow & { modules?: Array<{ module: string }> } | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        api.get<{ data: InstitutionRow }>(`/api/admin/institutions/${id}`).then(({ data }) => setInstitution(data.data));
    }, [id]);

    async function setStatus(status: string) {
        await api.patch(`/api/admin/institutions/${id}/status`, { status });
        setMessage(`Status updated to ${status}.`);
        setInstitution((current) => current ? { ...current, status } : current);
    }

    if (!institution) {
        return <p className="text-sm text-slate-500">Loading institution…</p>;
    }

    return (
        <>
            <PageTitle title={institution.name} detail={`${institution.institution_code} · ${institution.type}`} />
            {message && <p className="mb-4 text-sm text-emerald-700">{message}</p>}
            <Panel>
                <p className="text-sm capitalize text-slate-600">Status: {institution.status}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                    {['active', 'inactive', 'suspended'].map((status) => (
                        <button key={status} onClick={() => setStatus(status)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm capitalize hover:bg-slate-50">{status}</button>
                    ))}
                </div>
            </Panel>
        </>
    );
}

export function PlansPage() {
    const [plans, setPlans] = useState<Plan[]>([]);

    useEffect(() => {
        api.get<{ data: Plan[] }>('/api/admin/plans').then(({ data }) => setPlans(data.data));
    }, []);

    return (
        <>
            <PageTitle title="Subscription plans" detail="Prices are stored in NPR." />
            <div className="grid gap-4 md:grid-cols-2">
                {plans.map((plan) => (
                    <Panel key={plan.id}>
                        <h2 className="text-lg font-semibold">{plan.name}</h2>
                        <p className="mt-1 text-sm text-slate-500">NPR {plan.price_monthly.toLocaleString()} / month</p>
                        <p className="mt-3 text-sm text-slate-600">{plan.modules.join(', ')}</p>
                    </Panel>
                ))}
            </div>
        </>
    );
}

export function InstitutionHome() {
    const [dashboard, setDashboard] = useState<InstitutionDashboard | null>(null);

    useEffect(() => {
        api.get<{ data: InstitutionDashboard }>('/api/institution/dashboard').then(({ data }) => setDashboard(data.data));
    }, []);

    return (
        <>
            <PageTitle title={dashboard?.institution.name ?? 'Institution'} detail="Figures come from this institution only." />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Students" value={dashboard?.students_total} />
                <Metric label="Teachers" value={dashboard?.teachers_total} />
                <Metric label="Open invoices" value={dashboard?.invoices_open} />
                <Metric label={`Outstanding ${dashboard?.currency ?? 'NPR'}`} value={dashboard?.fees_outstanding} />
            </div>
        </>
    );
}

interface StudentRow {
    id: number;
    admission_number: string;
    first_name: string;
    last_name: string;
    status: string;
    school_class?: { name: string } | null;
}

export function TeachersPage() {
    const [rows, setRows] = useState<Array<{ id: number; employee_code: string; first_name: string; last_name: string; department: string | null }>>([]);
    const [error, setError] = useState<string | null>(null);

    function load() {
        api.get<{ data: Array<{ id: number; employee_code: string; first_name: string; last_name: string; department: string | null }> }>('/api/institution/teachers')
            .then(({ data }) => setRows(data.data));
    }

    useEffect(() => {
        load();
    }, []);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        try {
            await api.post('/api/institution/teachers', Object.fromEntries(new FormData(form).entries()));
            form.reset();
            load();
        } catch (reason: unknown) {
            setError(getErrorMessage(reason, 'Unable to add the teacher.'));
        }
    }

    return (
        <>
            <PageTitle title="Teachers" detail="Employee records stay inside this institution." />
            {error && <p className="mb-3 text-sm text-rose-700">{error}</p>}
            <Panel>
                <form onSubmit={submit} className="grid gap-3 md:grid-cols-4">
                    <input name="first_name" required placeholder="First name" className={inputClass} />
                    <input name="last_name" required placeholder="Last name" className={inputClass} />
                    <input name="employee_code" required placeholder="Employee code" className={inputClass} />
                    <input name="department" placeholder="Department" className={inputClass} />
                    <button className="h-11 rounded-xl bg-blue-700 text-sm font-semibold text-white">Add teacher</button>
                </form>
            </Panel>
            <ul className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white px-5">
                {rows.map((teacher) => <li key={teacher.id} className="flex justify-between py-3 text-sm"><span>{teacher.first_name} {teacher.last_name}</span><span className="text-slate-500">{teacher.employee_code}</span></li>)}
            </ul>
        </>
    );
}

export function AcademicsPage() {
    const [classes, setClasses] = useState<Array<{ id: number; name: string }>>([]);
    const [subjects, setSubjects] = useState<Array<{ id: number; name: string; code: string }>>([]);
    const [sessions, setSessions] = useState<Array<{ id: number; name: string; is_current: boolean }>>([]);

    function load() {
        api.get<{ data: Array<{ id: number; name: string }> }>('/api/institution/classes').then(({ data }) => setClasses(data.data));
        api.get<{ data: Array<{ id: number; name: string; code: string }> }>('/api/institution/subjects').then(({ data }) => setSubjects(data.data));
        api.get<{ data: Array<{ id: number; name: string; is_current: boolean }> }>('/api/institution/sessions').then(({ data }) => setSessions(data.data));
    }

    useEffect(() => {
        load();
    }, []);

    async function addClass(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        await api.post('/api/institution/classes', Object.fromEntries(new FormData(form).entries()));
        form.reset();
        load();
    }

    async function addSubject(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        await api.post('/api/institution/subjects', Object.fromEntries(new FormData(form).entries()));
        form.reset();
        load();
    }

    async function addSession(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        const payload = Object.fromEntries(new FormData(form).entries());
        await api.post('/api/institution/sessions', { ...payload, is_current: true });
        form.reset();
        load();
    }

    return (
        <>
            <PageTitle title="Academics" detail="Sessions, classes, and subjects for this campus." />
            <div className="grid gap-4 lg:grid-cols-3">
                <Panel>
                    <h2 className="mb-3 font-semibold">Session</h2>
                    <form onSubmit={addSession} className="space-y-2">
                        <input name="name" required placeholder="2082" className={inputClass} />
                        <input name="starts_on" type="date" required className={inputClass} />
                        <input name="ends_on" type="date" required className={inputClass} />
                        <button className="h-10 rounded-xl bg-blue-700 px-4 text-sm text-white">Save session</button>
                    </form>
                    <ul className="mt-3 text-sm text-slate-600">{sessions.map((session) => <li key={session.id}>{session.name}{session.is_current ? ' · current' : ''}</li>)}</ul>
                </Panel>
                <Panel>
                    <h2 className="mb-3 font-semibold">Class</h2>
                    <form onSubmit={addClass} className="space-y-2">
                        <input name="name" required placeholder="Grade 8" className={inputClass} />
                        <input name="section" placeholder="Section A" className={inputClass} />
                        <input name="code" placeholder="Class code" className={inputClass} />
                        <button className="h-10 rounded-xl bg-blue-700 px-4 text-sm text-white">Save class</button>
                    </form>
                    <ul className="mt-3 text-sm text-slate-600">{classes.map((item) => <li key={item.id}>{item.name}</li>)}</ul>
                </Panel>
                <Panel>
                    <h2 className="mb-3 font-semibold">Subject</h2>
                    <form onSubmit={addSubject} className="space-y-2">
                        <input name="name" required placeholder="Mathematics" className={inputClass} />
                        <input name="code" required placeholder="MATH" className={inputClass} />
                        <button className="h-10 rounded-xl bg-blue-700 px-4 text-sm text-white">Save subject</button>
                    </form>
                    <ul className="mt-3 text-sm text-slate-600">{subjects.map((subject) => <li key={subject.id}>{subject.name} · {subject.code}</li>)}</ul>
                </Panel>
            </div>
        </>
    );
}

export function AttendancePage() {
    const [students, setStudents] = useState<StudentRow[]>([]);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        api.get<{ data: StudentRow[] }>('/api/institution/students').then(({ data }) => setStudents(data.data));
    }, []);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
        await api.post('/api/institution/attendance', { ...payload, student_id: Number(payload.student_id) });
        setMessage('Attendance saved.');
    }

    return (
        <>
            <PageTitle title="Student attendance" detail="One record per student per day. Saving again updates that day." />
            {message && <p className="mb-3 text-sm text-emerald-700">{message}</p>}
            <Panel>
                <form onSubmit={submit} className="grid gap-3 md:grid-cols-4">
                    <select name="student_id" required className={inputClass}>
                        <option value="">Student</option>
                        {students.map((student) => <option key={student.id} value={student.id}>{student.first_name} {student.last_name}</option>)}
                    </select>
                    <input name="attended_on" type="date" required className={inputClass} />
                    <select name="status" className={inputClass} defaultValue="present">
                        <option value="present">Present</option>
                        <option value="absent">Absent</option>
                        <option value="late">Late</option>
                    </select>
                    <button className="h-11 rounded-xl bg-blue-700 text-sm font-semibold text-white">Save</button>
                </form>
            </Panel>
        </>
    );
}

interface InvoiceRow {
    id: number;
    number: string;
    amount: number;
    paid_amount: number;
    status: string;
    student?: { first_name: string; last_name: string };
}

export function InvoicesPage() {
    const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
    const [students, setStudents] = useState<StudentRow[]>([]);
    const [feeStructures, setFeeStructures] = useState<Array<{ id: number; name: string; amount: number; due_day: number | null; due_date: string | null }>>([]);
    const [selectedStructureId, setSelectedStructureId] = useState<string>('');
    const [amount, setAmount] = useState<string>('');
    const [description, setDescription] = useState<string>('');
    const [issuedOn, setIssuedOn] = useState<string>(() => new Date().toISOString().slice(0, 10));
    const [dueOn, setDueOn] = useState<string>(() => {
        const d = new Date();
        d.setDate(d.getDate() + 15);
        return d.toISOString().slice(0, 10);
    });
    const [error, setError] = useState<string | null>(null);

    function load() {
        api.get<{ data: InvoiceRow[] }>('/api/institution/invoices').then(({ data }) => setInvoices(data.data));
        api.get<{ data: StudentRow[] }>('/api/institution/students').then(({ data }) => setStudents(data.data));
        api.get<{ data: Array<{ id: number; name: string; amount: number; due_day: number | null; due_date: string | null }> }>('/api/institution/fee-structures?per_page=100')
            .then(({ data }) => setFeeStructures(data.data ?? []))
            .catch(() => {});
    }

    useEffect(() => {
        load();
    }, []);

    function handleStructureChange(id: string) {
        setSelectedStructureId(id);
        const match = feeStructures.find((s) => String(s.id) === id);
        if (match) {
            setAmount(String(match.amount));
            setDescription(match.name);
            if (match.due_date) {
                setDueOn(match.due_date.slice(0, 10));
            } else if (match.due_day) {
                const now = new Date();
                const d = new Date(now.getFullYear(), now.getMonth(), match.due_day);
                if (d < now) {
                    d.setMonth(d.getMonth() + 1);
                }
                setDueOn(d.toISOString().slice(0, 10));
            }
        }
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        const payload = Object.fromEntries(new FormData(form).entries());
        try {
            await api.post('/api/institution/invoices', {
                ...payload,
                student_id: Number(payload.student_id),
                fee_structure_id: selectedStructureId ? Number(selectedStructureId) : null,
                description: description || null,
                amount: Number(amount || payload.amount),
                issued_on: issuedOn,
                due_on: dueOn,
            });
            form.reset();
            setSelectedStructureId('');
            setAmount('');
            setDescription('');
            load();
        } catch (reason: unknown) {
            setError(getErrorMessage(reason, 'Unable to issue the invoice.'));
        }
    }

    return (
        <>
            <PageTitle title="Invoices" detail="Issuing an invoice posts a receivable and fee income. Amounts are in NPR." />
            {error && <p className="mb-3 text-sm text-rose-700">{error}</p>}
            <Panel>
                <form onSubmit={submit} className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-3">
                        <select
                            value={selectedStructureId}
                            onChange={(e) => handleStructureChange(e.target.value)}
                            className={inputClass}
                        >
                            <option value="">Apply Fee Structure (Optional)</option>
                            {feeStructures.map((structure) => (
                                <option key={structure.id} value={structure.id}>
                                    {structure.name} (NPR {structure.amount.toLocaleString()})
                                </option>
                            ))}
                        </select>

                        <select name="student_id" required className={inputClass}>
                            <option value="">Select Student *</option>
                            {students.map((student) => (
                                <option key={student.id} value={student.id}>
                                    {student.first_name} {student.last_name} ({student.admission_number})
                                </option>
                            ))}
                        </select>

                        <input
                            name="amount"
                            type="number"
                            min={1}
                            required
                            placeholder="Amount (NPR) *"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className={inputClass}
                        />
                    </div>

                    <div className="grid gap-3 md:grid-cols-4">
                        <input
                            name="description"
                            type="text"
                            placeholder="Bill description / items note"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className={`md:col-span-2 ${inputClass}`}
                        />
                        <input
                            name="issued_on"
                            type="date"
                            required
                            value={issuedOn}
                            onChange={(e) => setIssuedOn(e.target.value)}
                            className={inputClass}
                        />
                        <input
                            name="due_on"
                            type="date"
                            required
                            value={dueOn}
                            onChange={(e) => setDueOn(e.target.value)}
                            className={inputClass}
                        />
                    </div>

                    <div className="flex justify-end pt-1">
                        <button className="h-11 rounded-xl bg-blue-700 px-6 text-sm font-semibold text-white hover:bg-blue-800">
                            Issue invoice
                        </button>
                    </div>
                </form>
            </Panel>
            <ul className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white px-5">
                {invoices.map((invoice: any) => (
                    <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                        <div>
                            <span className="font-semibold text-slate-800">{invoice.number}</span>
                            <span className="ml-2 text-slate-600">· {invoice.student?.first_name} {invoice.student?.last_name}</span>
                            {invoice.fee_structure?.name && (
                                <span className="ml-2 inline-flex items-center rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                                    {invoice.fee_structure.name}
                                </span>
                            )}
                        </div>
                        <span className="text-slate-500">NPR {invoice.amount.toLocaleString()} · paid {invoice.paid_amount.toLocaleString()} · <span className={`font-medium ${invoice.status === 'paid' ? 'text-emerald-700' : 'text-amber-700'}`}>{invoice.status}</span></span>
                    </li>
                ))}
            </ul>
        </>
    );
}

export function PaymentsPage() {
    const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
    const [paymentMethods, setPaymentMethods] = useState<Array<{ id: number; name: string; code: string; enabled: boolean; instructions?: string }>>([]);
    const [selectedMethod, setSelectedMethod] = useState<string>('cash');
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    function loadInvoices() {
        api.get<{ data: InvoiceRow[] }>('/api/institution/invoices').then(({ data }) => setInvoices(data.data.filter((invoice) => invoice.status !== 'paid')));
        api.get<{ data: Array<{ id: number; name: string; code: string; enabled: boolean; instructions?: string }> }>('/api/institution/payment-methods')
            .then(({ data }) => {
                const methods = (data.data ?? []).filter((m) => m.enabled);
                setPaymentMethods(methods);
                if (methods.length > 0 && !methods.some((m) => m.code === selectedMethod)) {
                    setSelectedMethod(methods[0].code);
                }
            })
            .catch(() => {});
    }

    useEffect(() => {
        loadInvoices();
    }, []);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
        try {
            await api.post(`/api/institution/invoices/${payload.invoice_id}/payments`, {
                amount: Number(payload.amount),
                paid_on: payload.paid_on,
                method: payload.method,
            });
            setMessage('Receipt posted. Cash/Bank increased and the receivable decreased.');
            setError(null);
            loadInvoices();
        } catch (reason: unknown) {
            setError(getErrorMessage(reason, 'Unable to collect this payment.'));
        }
    }

    const currentMethodInfo = paymentMethods.find((m) => m.code === selectedMethod);

    return (
        <>
            <PageTitle title="Fee collection" detail="Partial payments are allowed. Supports Cash, Bank, eSewa, Khalti, and digital methods." />
            {message && <p className="mb-3 text-sm text-emerald-700">{message}</p>}
            {error && <p className="mb-3 text-sm text-rose-700">{error}</p>}
            <Panel>
                <form onSubmit={submit} className="space-y-3">
                    <div className="grid gap-3 md:grid-cols-4">
                        <select name="invoice_id" required className={inputClass}>
                            <option value="">Select open invoice *</option>
                            {invoices.map((invoice) => (
                                <option key={invoice.id} value={invoice.id}>
                                    {invoice.number} · due NPR {(invoice.amount - invoice.paid_amount).toLocaleString()}
                                </option>
                            ))}
                        </select>
                        <input name="amount" type="number" min={1} required placeholder="Amount (NPR) *" className={inputClass} />
                        <input name="paid_on" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className={inputClass} />
                        <select
                            name="method"
                            className={inputClass}
                            value={selectedMethod}
                            onChange={(e) => setSelectedMethod(e.target.value)}
                        >
                            {paymentMethods.length > 0 ? (
                                paymentMethods.map((m) => (
                                    <option key={m.id} value={m.code}>
                                        {m.name}
                                    </option>
                                ))
                            ) : (
                                <>
                                    <option value="cash">Cash</option>
                                    <option value="bank">Bank Transfer</option>
                                    <option value="esewa">eSewa</option>
                                    <option value="khalti">Khalti</option>
                                    <option value="online">Online / Card</option>
                                </>
                            )}
                        </select>
                    </div>

                    {currentMethodInfo?.instructions && (
                        <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                            <span className="font-semibold text-slate-700">Payment Instruction: </span>
                            {currentMethodInfo.instructions}
                        </div>
                    )}

                    <div className="flex justify-end pt-1">
                        <button className="h-11 rounded-xl bg-blue-700 px-6 text-sm font-semibold text-white hover:bg-blue-800">
                            Collect payment
                        </button>
                    </div>
                </form>
            </Panel>
        </>
    );
}

export function NoticesPage() {
    const [notices, setNotices] = useState<Array<{ id: number; title: string; body: string }>>([]);

    function load() {
        api.get<{ data: Array<{ id: number; title: string; body: string }> }>('/api/institution/notices').then(({ data }) => setNotices(data.data));
    }

    useEffect(() => {
        load();
    }, []);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        await api.post('/api/institution/notices', Object.fromEntries(new FormData(form).entries()));
        form.reset();
        load();
    }

    return (
        <>
            <PageTitle title="Notices" detail="Announcements published for this institution." />
            <Panel>
                <form onSubmit={submit} className="space-y-3">
                    <input name="title" required placeholder="Title" className={inputClass} />
                    <textarea name="body" required placeholder="Message" className="min-h-28 w-full rounded-xl border border-slate-200 p-3 text-sm" />
                    <button className="h-11 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white">Publish</button>
                </form>
            </Panel>
            <div className="mt-4 space-y-3">
                {notices.map((notice) => (
                    <Panel key={notice.id}>
                        <h2 className="font-semibold">{notice.title}</h2>
                        <p className="mt-1 text-sm text-slate-600">{notice.body}</p>
                    </Panel>
                ))}
            </div>
        </>
    );
}

export function BillSettingsPage() {
    const [categories, setCategories] = useState<Array<{ id: number; name: string; kind: string; default_amount: number }>>([]);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    function load() {
        api.get<{ data: Array<{ id: number; name: string; kind: string; default_amount: number }> }>('/api/institution/fee-categories')
            .then(({ data }) => setCategories(data.data))
            .catch((reason: unknown) => setError(getErrorMessage(reason, 'Unable to load fee categories.')));
    }

    useEffect(() => {
        load();
    }, []);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        const payload = Object.fromEntries(new FormData(form).entries());
        try {
            await api.post('/api/institution/fee-categories', {
                ...payload,
                default_amount: Number(payload.default_amount),
                fine_amount: Number(payload.fine_amount || 0),
                due_day: payload.due_day ? Number(payload.due_day) : null,
            });
            form.reset();
            setMessage('Fee category saved.');
            load();
        } catch (reason: unknown) {
            setError(getErrorMessage(reason, 'Unable to save the fee category.'));
        }
    }

    async function savePlan(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
        try {
            await api.post('/api/institution/fee-plans', {
                ...payload,
                amount: Number(payload.amount),
                due_day: payload.due_day ? Number(payload.due_day) : null,
            });
            setMessage('Class and session fee structure saved.');
        } catch (reason: unknown) {
            setError(getErrorMessage(reason, 'Unable to save the fee structure.'));
        }
    }

    async function saveScholarship(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
        await api.post('/api/institution/scholarships', { ...payload, value: Number(payload.value) });
        setMessage('Discount saved.');
    }

    return (
        <>
            <PageTitle title="Bill settings" detail="Fee categories, fines, due dates, and class or session structures. Amounts are NPR." />
            {message && <p className="mb-3 text-sm text-emerald-700">{message}</p>}
            {error && <p className="mb-3 text-sm text-rose-700">{error}</p>}
            <div className="grid gap-4 lg:grid-cols-2">
                <Panel>
                    <h2 className="mb-3 font-semibold">Fee category</h2>
                    <form onSubmit={submit} className="grid gap-2">
                        <input name="name" required placeholder="Monthly tuition" className={inputClass} />
                        <input name="code" required placeholder="tuition" className={inputClass} />
                        <select name="kind" className={inputClass} defaultValue="tuition">
                            {['admission', 'tuition', 'examination', 'transport', 'hostel', 'library', 'laboratory', 'fine', 'other'].map((kind) => <option key={kind} value={kind}>{kind}</option>)}
                        </select>
                        <select name="billing_type" className={inputClass} defaultValue="recurring">
                            <option value="recurring">Recurring</option>
                            <option value="one_time">One time</option>
                        </select>
                        <input name="default_amount" type="number" min={0} required placeholder="Amount" className={inputClass} />
                        <input name="fine_amount" type="number" min={0} placeholder="Late fine" className={inputClass} />
                        <input name="due_day" type="number" min={1} max={28} placeholder="Due day of month" className={inputClass} />
                        <button className="h-11 rounded-xl bg-blue-700 text-sm font-semibold text-white">Save category</button>
                    </form>
                    <ul className="mt-3 text-sm text-slate-600">{categories.map((category) => <li key={category.id}>{category.name} · {category.kind} · NPR {category.default_amount}</li>)}</ul>
                </Panel>
                <div className="space-y-4">
                    <Panel>
                        <h2 className="mb-3 font-semibold">Class and session structure</h2>
                        <form onSubmit={savePlan} className="grid gap-2">
                            <input name="name" required placeholder="Grade 8 tuition" className={inputClass} />
                            <input name="amount" type="number" min={1} required className={inputClass} />
                            <select name="billing_type" className={inputClass}><option value="recurring">Recurring</option><option value="one_time">One time</option></select>
                            <input name="due_day" type="number" min={1} max={28} placeholder="Due day" className={inputClass} />
                            <button className="h-11 rounded-xl bg-blue-700 text-sm font-semibold text-white">Save structure</button>
                        </form>
                    </Panel>
                    <Panel>
                        <h2 className="mb-3 font-semibold">Discount or scholarship</h2>
                        <form onSubmit={saveScholarship} className="grid gap-2">
                            <input name="name" required placeholder="Merit scholarship" className={inputClass} />
                            <select name="discount_type" className={inputClass}><option value="percent">Percent</option><option value="fixed">Fixed NPR</option></select>
                            <input name="value" type="number" min={1} required className={inputClass} />
                            <button className="h-11 rounded-xl bg-blue-700 text-sm font-semibold text-white">Save discount</button>
                        </form>
                    </Panel>
                </div>
            </div>
        </>
    );
}

export function AccountantPage() {
    const [data, setData] = useState<Record<string, number | null> | null>(null);
    const [rows, setRows] = useState<Array<{ id: number; receipt_number: string; amount: number; status: string }>>([]);
    const [error, setError] = useState<string | null>(null);
    const { user } = useWorkspaceAuth();

    useEffect(() => {
        api.get<{ data: Record<string, number | null> & { recent_payments: Array<{ id: number; receipt_number: string; amount: number; status: string }> } }>('/api/institution/accountant/dashboard')
            .then(({ data: body }) => {
                setRows(body.data.recent_payments);
                setData(body.data);
            })
            .catch((reason: unknown) => setError(getErrorMessage(reason, 'Unable to load the accountant dashboard.')));
    }, []);

    const chart = data ? [
        { name: 'Today', value: Number(data.collection_today ?? 0) },
        { name: 'Month', value: Number(data.collection_month ?? 0) },
        { name: 'Outstanding', value: Number(data.outstanding ?? 0) },
    ] : [];

    return (
        <>
            <PageTitle title="Accountant" detail="Collections and balances for this institution, in NPR." />
            {error && <p className="mb-4 text-sm text-rose-700">{error}</p>}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Metric label="Today" value={data ? Number(data.collection_today) : undefined} />
                <Metric label="This month" value={data ? Number(data.collection_month) : undefined} />
                <Metric label="Cash" value={data ? Number(data.cash_balance) : undefined} />
                <Metric label="Bank" value={data ? Number(data.bank_balance) : undefined} />
            </div>
            <div className="mt-4 h-56 rounded-2xl border border-slate-200 bg-white p-4">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart}><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="value" fill="#1d4ed8" radius={6} /></BarChart>
                </ResponsiveContainer>
            </div>
            <ul className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white px-5">
                {rows.map((row) => <li key={row.id} className="flex justify-between py-3 text-sm"><span>{row.receipt_number}</span><span>NPR {row.amount.toLocaleString()} · {row.status}</span></li>)}
            </ul>
            {user?.permissions.includes('finance.manage') && <p className="mt-3 text-sm text-slate-500">Expenses recorded: NPR {Number(data?.expense_total ?? 0).toLocaleString()}</p>}
        </>
    );
}

export function MarksPage() {
    const [classes, setClasses] = useState<Array<{ id: number; name: string }>>([]);
    const [subjects, setSubjects] = useState<Array<{ id: number; name: string }>>([]);
    const [students, setStudents] = useState<StudentRow[]>([]);
    const [exams, setExams] = useState<Array<{ id: number; name: string }>>([]);
    const [sheet, setSheet] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api.get<{ data: Array<{ id: number; name: string }> }>('/api/institution/classes').then(({ data }) => setClasses(data.data)).catch(() => undefined);
        api.get<{ data: Array<{ id: number; name: string }> }>('/api/institution/subjects').then(({ data }) => setSubjects(data.data)).catch(() => undefined);
        api.get<{ data: StudentRow[] }>('/api/institution/students').then(({ data }) => setStudents(data.data)).catch(() => undefined);
        api.get<{ data: Array<{ id: number; name: string }> }>('/api/institution/examinations').then(({ data }) => setExams(data.data)).catch((reason: unknown) => setError(getErrorMessage(reason, 'Marks are not available for this account.')));
    }, []);

    async function createExam(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
        const { data } = await api.post<{ data: { id: number; name: string } }>('/api/institution/examinations', { ...payload, school_class_id: Number(payload.school_class_id) });
        setExams((current) => [data.data, ...current]);
    }

    async function saveMarks(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
        try {
            const { data } = await api.post<{ data: { result: { total: number; percentage: number; grade: string; passed: boolean } } }>(`/api/institution/examinations/${payload.examination_id}/marks`, {
                student_id: Number(payload.student_id),
                subject_id: Number(payload.subject_id),
                theory_marks: Number(payload.theory_marks),
                practical_marks: Number(payload.practical_marks || 0),
            });
            setSheet(`${data.data.result.grade} · ${data.data.result.percentage}% · total ${data.data.result.total}`);
            setError(null);
        } catch (reason: unknown) {
            setError(getErrorMessage(reason, 'Unable to save marks.'));
        }
    }

    return (
        <>
            <PageTitle title="Marks" detail="Theory and practical marks are checked against the class subject full marks." />
            {error && <p className="mb-3 text-sm text-rose-700">{error}</p>}
            {sheet && <p className="mb-3 text-sm text-emerald-700">{sheet}</p>}
            <div className="grid gap-4 lg:grid-cols-2">
                <Panel>
                    <h2 className="mb-3 font-semibold">Examination</h2>
                    <form onSubmit={createExam} className="grid gap-2">
                        <input name="name" required placeholder="First terminal" className={inputClass} />
                        <select name="exam_type" className={inputClass}><option value="terminal">Terminal</option><option value="midterm">Midterm</option><option value="final">Final</option><option value="practical">Practical</option></select>
                        <select name="school_class_id" required className={inputClass}>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                        <button className="h-11 rounded-xl bg-blue-700 text-sm font-semibold text-white">Create examination</button>
                    </form>
                </Panel>
                <Panel>
                    <h2 className="mb-3 font-semibold">Enter marks</h2>
                    <form onSubmit={saveMarks} className="grid gap-2">
                        <select name="examination_id" required className={inputClass}>{exams.map((exam) => <option key={exam.id} value={exam.id}>{exam.name}</option>)}</select>
                        <select name="student_id" required className={inputClass}>{students.map((student) => <option key={student.id} value={student.id}>{student.first_name} {student.last_name}</option>)}</select>
                        <select name="subject_id" required className={inputClass}>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select>
                        <input name="theory_marks" type="number" min={0} required placeholder="Theory" className={inputClass} />
                        <input name="practical_marks" type="number" min={0} placeholder="Practical" className={inputClass} />
                        <button className="h-11 rounded-xl bg-blue-700 text-sm font-semibold text-white">Save marks</button>
                    </form>
                </Panel>
            </div>
        </>
    );
}

export function SettingsPage() {
    const { user } = useWorkspaceAuth();

    return (
        <>
            <PageTitle title="Profile and settings" detail="Institution context is taken from your account." />
            <Panel>
                <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 size-5 text-blue-700" />
                    <div className="text-sm">
                        <p className="font-medium">{user?.name}</p>
                        <p className="text-slate-500">{user?.email}</p>
                        <p className="mt-2 text-slate-600">{user?.institution?.name} · {user?.institution?.institution_code}</p>
                        <p className="mt-2 inline-flex items-center gap-1 text-slate-500">Currency <ChevronRight className="size-3" /> NPR</p>
                    </div>
                </div>
            </Panel>
            <PasswordForm />
        </>
    );
}

function PasswordForm() {
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const payload = Object.fromEntries(new FormData(event.currentTarget).entries());
        try {
            const { data } = await api.put<{ message: string }>('/api/password', payload);
            setMessage(data.message);
            setError(null);
        } catch (reason: unknown) {
            setError(getErrorMessage(reason, 'Unable to change the password.'));
        }
    }

    return (
        <div className="mt-4">
            <Panel>
                <h2 className="mb-3 font-semibold">Change password</h2>
                {message && <p className="mb-2 text-sm text-emerald-700">{message}</p>}
                {error && <p className="mb-2 text-sm text-rose-700">{error}</p>}
                <form onSubmit={submit} className="grid max-w-md gap-2">
                    <input name="current_password" type="password" required placeholder="Current password" className={inputClass} />
                    <input name="password" type="password" required minLength={8} placeholder="New password" className={inputClass} />
                    <input name="password_confirmation" type="password" required placeholder="Confirm new password" className={inputClass} />
                    <button className="h-11 rounded-xl bg-blue-700 text-sm font-semibold text-white">Update password</button>
                </form>
            </Panel>
        </div>
    );
}
