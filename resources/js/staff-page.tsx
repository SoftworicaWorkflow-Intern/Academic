import { type FormEvent, type ReactNode, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BriefcaseBusiness, Clock3, MoreHorizontal, UserCheck, UserPlus, Users, X } from 'lucide-react';
import { api, getErrorMessage } from './api';

interface StaffRecord {
    id: number;
    employee_id: string;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    photo_path: string | null;
    gender: string | null;
    date_of_birth: string | null;
    blood_group: string | null;
    marital_status: string | null;
    nationality: string | null;
    citizenship_number: string | null;
    personal_phone: string | null;
    email: string | null;
    province: string | null;
    district: string | null;
    municipality: string | null;
    ward: string | null;
    permanent_address: string | null;
    temporary_address: string | null;
    emergency_contact_number: string | null;
    emergency_contact_name: string | null;
    emergency_contact_relation: string | null;
    department_id: number | null;
    designation_id: number | null;
    department?: { id: number; name: string } | null;
    designation?: { id: number; name: string } | null;
    employment_type: string | null;
    joining_date: string | null;
    probation_end_date: string | null;
    reporting_manager_id: number | null;
    reporting_manager?: { id: number; name: string; employee_id: string } | null;
    employment_status: string;
    job_description: string | null;
    basic_salary?: number | null;
    allowances?: number | null;
    deductions?: number | null;
    payment_frequency?: string | null;
    payment_method?: string | null;
    salary_effective_date?: string | null;
    documents?: StaffDocument[];
    employment_histories?: StaffHistory[];
    salary_structures?: StaffSalary[];
    attendance_records?: StaffAttendance[];
    leave_requests?: StaffLeave[];
}

interface StaffDocument {
    id: number;
    type: string;
    original_name: string;
    mime_type: string | null;
    file_size: number | null;
    created_at: string | null;
}

interface StaffHistory {
    id: number;
    event_type: string;
    previous_status: string | null;
    new_status: string | null;
    effective_date: string | null;
    notes: string | null;
}

interface StaffSalary {
    id: number;
    basic_salary: number;
    allowances: number;
    deductions: number;
    payment_frequency: string | null;
    payment_method: string | null;
    effective_date: string | null;
    end_date: string | null;
}

interface StaffAttendance {
    id: number;
    attended_on: string | null;
    status: string;
    check_in: string | null;
    check_out: string | null;
}

interface StaffLeave {
    id: number;
    leave_type: string | null;
    starts_on: string | null;
    ends_on: string | null;
    days: number;
    status: string;
    reason: string | null;
}

interface PagePayload {
    data: StaffRecord[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

interface Option { id: number; name: string; is_active?: boolean; head_staff_id?: number | null; }

const field = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15';
const statusStyles: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700',
    on_leave: 'bg-amber-50 text-amber-700',
    suspended: 'bg-rose-50 text-rose-700',
    resigned: 'bg-slate-100 text-slate-700',
    terminated: 'bg-slate-200 text-slate-700',
};

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
    return (
        <label className={`block ${wide ? 'md:col-span-2' : ''}`}>
            <span className="mb-1.5 block text-xs font-medium tracking-wide text-slate-500">{label}</span>
            {children}
        </label>
    );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-800">{title}</h3>
            <div className="grid gap-3 md:grid-cols-2">{children}</div>
        </section>
    );
}

function formatStatus(status: string): string {
    return status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StaffPage() {
    const [page, setPage] = useState<PagePayload | null>(null);
    const [summary, setSummary] = useState({ total: 0, active: 0, on_leave: 0, inactive: 0 });
    const [search, setSearch] = useState('');
    const [debounced, setDebounced] = useState('');
    const [filters, setFilters] = useState({ department_id: '', designation_id: '', employment_type: '', employment_status: '', joining_from: '', joining_to: '' });
    const [perPage, setPerPage] = useState(10);
    const [current, setCurrent] = useState(1);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<StaffRecord | null>(null);
    const [viewing, setViewing] = useState<{ id: number; tab: string } | null>(null);
    const [statusStaff, setStatusStaff] = useState<StaffRecord | null>(null);
    const [manage, setManage] = useState<'departments' | 'designations' | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [menu, setMenu] = useState<number | null>(null);
    const [departments, setDepartments] = useState<Option[]>([]);
    const [designations, setDesignations] = useState<Option[]>([]);
    const [allStaff, setAllStaff] = useState<Array<{ id: number; name: string }>>([]);

    useEffect(() => { const timer = window.setTimeout(() => setDebounced(search), 300); return () => window.clearTimeout(timer); }, [search]);
    useEffect(() => { setCurrent(1); }, [debounced, filters, perPage]);

    function loadLookups() {
        api.get<{ data: Option[] }>('/api/institution/staff-departments').then(({ data }) => setDepartments(data.data)).catch(() => undefined);
        api.get<{ data: Option[] }>('/api/institution/staff-designations').then(({ data }) => setDesignations(data.data)).catch(() => undefined);
        api.get<PagePayload>('/api/institution/staff', { params: { per_page: 100 } }).then(({ data }) => {
            setAllStaff(data.data.map((s) => ({ id: s.id, name: `${s.first_name} ${s.last_name}`.trim() })));
        }).catch(() => undefined);
    }

    function load() {
        api.get<PagePayload>('/api/institution/staff', { params: { search: debounced, page: current, per_page: perPage, ...filters } })
            .then(({ data }) => setPage(data))
            .catch((reason: unknown) => setError(getErrorMessage(reason, 'Unable to load staff.')));
        api.get<{ data: typeof summary }>('/api/institution/staff-summary').then(({ data }) => setSummary(data.data)).catch(() => undefined);
    }

    useEffect(() => { loadLookups(); }, []);
    useEffect(() => { load(); }, [debounced, filters, perPage, current, toast]);

    async function archive(staff: StaffRecord) {
        if (!window.confirm(`Archive ${staff.first_name} ${staff.last_name}? Employment history will be preserved.`)) {
            return;
        }
        await api.delete(`/api/institution/staff/${staff.id}`);
        setMenu(null);
        setToast('Staff archived.');
    }

    async function changeStatus(staff: StaffRecord, employment_status: string) {
        if (!window.confirm(`Change ${staff.first_name} ${staff.last_name}'s status to ${formatStatus(employment_status)}?`)) {
            return;
        }
        await api.patch(`/api/institution/staff/${staff.id}/status`, { employment_status });
        setMenu(null);
        setStatusStaff(null);
        setToast('Staff status updated.');
    }

    const resetFilters = () => { setSearch(''); setFilters({ department_id: '', designation_id: '', employment_type: '', employment_status: '', joining_from: '', joining_to: '' }); };

    return (
        <div>
            {toast && <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{toast}</p>}
            {error && <p className="mb-4 text-sm text-rose-700">{error}</p>}
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Staff Management</h1>
                    <p className="mt-1 text-sm text-slate-500">Manage your institution&apos;s employees and staff records.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => setManage('departments')} className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Departments</button>
                    <button type="button" onClick={() => setManage('designations')} className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Designations</button>
                    <button type="button" onClick={() => { setEditing(null); setOpen(true); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800">
                        <UserPlus className="size-4" /> Register Staff
                    </button>
                </div>
            </div>

            <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard icon={Users} label="Total Staff" value={summary.total} tone="text-blue-700 bg-blue-50" />
                <SummaryCard icon={UserCheck} label="Active Staff" value={summary.active} tone="text-emerald-700 bg-emerald-50" />
                <SummaryCard icon={Clock3} label="On Leave" value={summary.on_leave} tone="text-amber-700 bg-amber-50" />
                <SummaryCard icon={BriefcaseBusiness} label="Inactive Staff" value={summary.inactive} tone="text-slate-700 bg-slate-100" />
            </div>

            <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Filter label="Search" wide>
                        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, employee ID, or phone" className={control} />
                    </Filter>
                    <Filter label="Department">
                        <select value={filters.department_id} onChange={(e) => setFilters({ ...filters, department_id: e.target.value })} className={control}>
                            <option value="">All departments</option>
                            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </Filter>
                    <Filter label="Designation">
                        <select value={filters.designation_id} onChange={(e) => setFilters({ ...filters, designation_id: e.target.value })} className={control}>
                            <option value="">All designations</option>
                            {designations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </Filter>
                    <Filter label="Employment type">
                        <select value={filters.employment_type} onChange={(e) => setFilters({ ...filters, employment_type: e.target.value })} className={control}>
                            <option value="">All types</option>
                            <option value="full-time">Full-time</option>
                            <option value="part-time">Part-time</option>
                            <option value="contract">Contract</option>
                            <option value="temporary">Temporary</option>
                        </select>
                    </Filter>
                    <Filter label="Status">
                        <select value={filters.employment_status} onChange={(e) => setFilters({ ...filters, employment_status: e.target.value })} className={control}>
                            <option value="">All statuses</option>
                            <option value="active">Active</option>
                            <option value="on_leave">On Leave</option>
                            <option value="suspended">Suspended</option>
                            <option value="resigned">Resigned</option>
                            <option value="terminated">Terminated</option>
                        </select>
                    </Filter>
                    <Filter label="Joined from">
                        <input type="date" value={filters.joining_from} onChange={(e) => setFilters({ ...filters, joining_from: e.target.value })} className={control} />
                    </Filter>
                    <Filter label="Joined to">
                        <input type="date" value={filters.joining_to} onChange={(e) => setFilters({ ...filters, joining_to: e.target.value })} className={control} />
                    </Filter>
                </div>
                <div className="mt-3 flex justify-end">
                    <button type="button" onClick={resetFilters} className="h-9 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-50">Reset filters</button>
                </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full min-w-[860px] text-left text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
                        <tr>
                            {['Staff', 'Role', 'Contact', 'Joined', 'Type', 'Status', ''].map((h) => <th key={h || 'actions'} className="px-4 py-3 font-medium">{h}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {(page?.data ?? []).map((staff) => (
                            <tr key={staff.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        {staff.photo_path ? <img alt="" src={`/api/institution/staff/${staff.id}/photo`} className="size-9 rounded-full object-cover" /> : <span className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-600">{staff.first_name.slice(0, 1)}</span>}
                                        <div>
                                            <p className="font-medium text-slate-900">{staff.first_name} {staff.last_name}</p>
                                            <p className="text-xs text-slate-500">{staff.employee_id}{staff.gender ? ` · ${staff.gender}` : ''}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <p className="text-slate-800">{staff.designation?.name ?? '—'}</p>
                                    <p className="text-xs text-slate-500">{staff.department?.name ?? 'No department'}</p>
                                </td>
                                <td className="px-4 py-3">
                                    <p className="text-slate-800">{staff.personal_phone ?? '—'}</p>
                                    <p className="text-xs text-slate-500">{staff.email ?? 'No email'}</p>
                                </td>
                                <td className="px-4 py-3 text-slate-700">{staff.joining_date ?? '—'}</td>
                                <td className="px-4 py-3 text-slate-700">{formatStatus(staff.employment_type ?? '—')}</td>
                                <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[staff.employment_status] ?? 'bg-slate-100 text-slate-700'}`}>{formatStatus(staff.employment_status)}</span></td>
                                <td className="relative px-4 py-3">
                                    <button type="button" aria-label="Staff actions" onClick={() => setMenu(menu === staff.id ? null : staff.id)} className="rounded-lg p-2 hover:bg-slate-100"><MoreHorizontal className="size-4" /></button>
                                    {menu === staff.id && (
                                        <div className="absolute right-3 z-20 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                                            <MenuButton onClick={() => { setViewing({ id: staff.id, tab: 'Overview' }); setMenu(null); }}>View Staff</MenuButton>
                                            <MenuButton onClick={() => { setEditing(staff); setOpen(true); setMenu(null); }}>Edit Staff</MenuButton>
                                            <MenuButton onClick={() => { setViewing({ id: staff.id, tab: 'Documents' }); setMenu(null); }}>View Documents</MenuButton>
                                            <MenuButton onClick={() => { setViewing({ id: staff.id, tab: 'Employment History' }); setMenu(null); }}>View Employment History</MenuButton>
                                            <MenuButton onClick={() => { setStatusStaff(staff); setMenu(null); }}>Change Status</MenuButton>
                                            <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-700 hover:bg-rose-50" onClick={() => archive(staff)}>Delete / Archive</button>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {(page?.data.length ?? 0) === 0 && (
                            <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">No staff records found.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                <p>Showing {page?.from ?? 0}–{page?.to ?? 0} of {page?.total ?? 0} staff</p>
                <div className="flex flex-wrap items-center gap-2">
                    <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))} className="h-9 rounded-lg border border-slate-200 px-2">
                        {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size} / page</option>)}
                    </select>
                    <button type="button" disabled={current <= 1} onClick={() => setCurrent((v) => v - 1)} className="h-9 rounded-lg border border-slate-200 px-3 disabled:opacity-40">Previous</button>
                    {Array.from({ length: page?.last_page ?? 1 }, (_, i) => i + 1).slice(0, 8).map((n) => (
                        <button key={n} type="button" onClick={() => setCurrent(n)} className={`h-9 min-w-9 rounded-lg border px-2 ${n === current ? 'border-blue-700 bg-blue-50 text-blue-800' : 'border-slate-200'}`}>{n}</button>
                    ))}
                    <button type="button" disabled={!page || current >= page.last_page} onClick={() => setCurrent((v) => v + 1)} className="h-9 rounded-lg border border-slate-200 px-3 disabled:opacity-40">Next</button>
                </div>
            </div>

            <AnimatePresence>
                {open && <StaffForm staff={editing} departments={departments} designations={designations} managers={allStaff} onClose={() => setOpen(false)} onSaved={(msg, keepOpen) => { setToast(msg); loadLookups(); if (!keepOpen) { setOpen(false); } }} />}
            </AnimatePresence>
            {viewing !== null && <StaffProfile staffId={viewing.id} initialTab={viewing.tab} onClose={() => setViewing(null)} />}
            {statusStaff && <StatusModal staff={statusStaff} onClose={() => setStatusStaff(null)} onSave={(status) => changeStatus(statusStaff, status)} />}
            {manage && <ManagementModal type={manage} departments={departments} designations={designations} staff={allStaff} onClose={() => setManage(null)} onChanged={() => { loadLookups(); load(); }} />}
        </div>
    );
}

const control = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15';

function Filter({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
    return (
        <label className={`block ${wide ? 'sm:col-span-2' : ''}`}>
            <span className="mb-1.5 block text-xs font-medium text-slate-500">{label}</span>
            {children}
        </label>
    );
}

function SummaryCard({ icon: Icon, label, value, tone }: { icon: typeof Users; label: string; value: number; tone: string }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-slate-500">{label}</p>
                    <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
                </div>
                <span className={`rounded-xl p-2.5 ${tone}`}><Icon className="size-5" /></span>
            </div>
        </div>
    );
}

function MenuButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
    return <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={onClick}>{children}</button>;
}

function StaffForm({ staff, departments, designations, managers, onClose, onSaved }: {
    staff: StaffRecord | null;
    departments: Option[];
    designations: Option[];
    managers: Array<{ id: number; name: string }>;
    onClose: () => void;
    onSaved: (message: string, keepOpen?: boolean) => void;
}) {
    const [preview, setPreview] = useState<string | null>(staff?.photo_path ? `/api/institution/staff/${staff.id}/photo` : null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

    async function submit(event: FormEvent<HTMLFormElement>, addAnother: boolean) {
        event.preventDefault();
        setSaving(true);
        setError(null);
        setFieldErrors({});
        const form = event.currentTarget;
        const body = new FormData(form);

        try {
            if (staff) {
                await api.post(`/api/institution/staff/${staff.id}`, body);
                onSaved('Staff updated.');
            } else {
                await api.post('/api/institution/staff', body);
                if (addAnother) {
                    form.reset();
                    setPreview(null);
                    setSaving(false);
                    onSaved('Staff registered. You can add another.', true);
                    return;
                }
                onSaved('Staff registered.');
            }
        } catch (reason: unknown) {
            if (reason && typeof reason === 'object' && 'isAxiosError' in reason) {
                const axiosError = reason as { response?: { data?: { errors?: Record<string, string[]> } } };
                const errors = axiosError.response?.data?.errors ?? {};
                const mapped: Record<string, string> = {};
                Object.entries(errors).forEach(([k, v]) => { mapped[k] = v[0]; });
                setFieldErrors(mapped);
            }
            setError(getErrorMessage(reason, 'Unable to save staff.'));
            setSaving(false);
        }
    }

    return (
        <motion.div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="my-auto flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">{staff ? 'Edit staff' : 'Register staff'}</h2>
                        <p className="mt-0.5 text-sm text-slate-500">Personal, contact, employment, and salary details.</p>
                    </div>
                    <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="size-4" /></button>
                </div>
                <form onSubmit={(e) => submit(e, false)} className="flex min-h-0 flex-col">
                <div className="max-h-[min(68vh,680px)] space-y-4 overflow-y-auto px-6 py-5">
                    {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
                    <Section title="Personal information">
                        <div className="flex items-center gap-4 md:col-span-2">
                            {preview ? <img alt="Profile preview" src={preview} className="size-14 rounded-full object-cover ring-1 ring-slate-200" /> : <div className="flex size-14 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-500">Photo</div>}
                            <label className="text-sm text-slate-600">Profile photo<input name="photo" type="file" accept="image/*" className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5" onChange={(e) => { const f = e.target.files?.[0]; if (f) setPreview(URL.createObjectURL(f)); }} /></label>
                        </div>
                        <Field label="Employee ID"><input name="employee_id" defaultValue={staff?.employee_id ?? ''} placeholder="Auto generated if blank" className={field} />{fieldErrors.employee_id && <p className="mt-1 text-xs text-rose-600">{fieldErrors.employee_id}</p>}</Field>
                        <Field label="Email"><input name="email" type="email" defaultValue={staff?.email ?? ''} className={field} />{fieldErrors.email && <p className="mt-1 text-xs text-rose-600">{fieldErrors.email}</p>}</Field>
                        <Field label="First Name"><input name="first_name" required defaultValue={staff?.first_name ?? ''} className={field} />{fieldErrors.first_name && <p className="mt-1 text-xs text-rose-600">{fieldErrors.first_name}</p>}</Field>
                        <Field label="Middle Name"><input name="middle_name" defaultValue={staff?.middle_name ?? ''} className={field} /></Field>
                        <Field label="Last Name"><input name="last_name" required defaultValue={staff?.last_name ?? ''} className={field} />{fieldErrors.last_name && <p className="mt-1 text-xs text-rose-600">{fieldErrors.last_name}</p>}</Field>
                        <Field label="Gender"><select name="gender" defaultValue={staff?.gender ?? ''} className={field}><option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></Field>
                        <Field label="Citizenship number"><input name="citizenship_number" defaultValue={staff?.citizenship_number ?? ''} className={field} /></Field>
                    </Section>

                    <Section title="Contact">
                        <Field label="Phone"><input name="personal_phone" defaultValue={staff?.personal_phone ?? ''} className={field} /></Field>
                        <Field label="Emergency phone"><input name="emergency_contact_number" defaultValue={staff?.emergency_contact_number ?? ''} className={field} /></Field>
                    </Section>

                    <Section title="Address">
                        <Field label="Province"><input name="province" defaultValue={staff?.province ?? ''} className={field} /></Field>
                        <Field label="District"><input name="district" defaultValue={staff?.district ?? ''} className={field} /></Field>
                        <Field label="Municipality"><input name="municipality" defaultValue={staff?.municipality ?? ''} className={field} /></Field>
                        <Field label="Ward number"><input name="ward" defaultValue={staff?.ward ?? ''} className={field} /></Field>
                        <Field label="Permanent address" wide><input name="permanent_address" defaultValue={staff?.permanent_address ?? ''} className={field} /></Field>
                        <Field label="Temporary address" wide><input name="temporary_address" defaultValue={staff?.temporary_address ?? ''} className={field} /></Field>
                    </Section>

                    <Section title="Employment">
                        <Field label="Department"><select name="department_id" defaultValue={staff?.department_id ?? ''} className={field}><option value="">Select</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
                        <Field label="Designation"><select name="designation_id" defaultValue={staff?.designation_id ?? ''} className={field}><option value="">Select</option>{designations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
                        <Field label="Employment Type"><select name="employment_type" defaultValue={staff?.employment_type ?? ''} className={field}><option value="">Select</option><option value="full-time">Full-time</option><option value="part-time">Part-time</option><option value="contract">Contract</option><option value="temporary">Temporary</option></select></Field>
                        <Field label="Joining Date"><input name="joining_date" type="date" defaultValue={staff?.joining_date?.slice(0, 10) ?? ''} className={field} /></Field>
                        <Field label="Probation End Date"><input name="probation_end_date" type="date" defaultValue={staff?.probation_end_date?.slice(0, 10) ?? ''} className={field} /></Field>
                        <Field label="Reporting Manager"><select name="reporting_manager_id" defaultValue={staff?.reporting_manager_id ?? ''} className={field}><option value="">Select</option>{managers.filter((m) => m.id !== staff?.id).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field>
                        <Field label="Employment Status"><select name="employment_status" defaultValue={staff?.employment_status ?? 'active'} className={field}><option value="active">Active</option><option value="on_leave">On Leave</option><option value="suspended">Suspended</option><option value="resigned">Resigned</option><option value="terminated">Terminated</option></select></Field>
                        <Field label="Job Description" wide><textarea name="job_description" defaultValue={staff?.job_description ?? ''} className="min-h-24 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15" /></Field>
                    </Section>

                    <Section title="Salary">
                        <Field label="Basic Salary"><input name="basic_salary" type="number" min="0" defaultValue={staff?.basic_salary ?? ''} className={field} /></Field>
                        <Field label="Allowances"><input name="allowances" type="number" min="0" defaultValue={staff?.allowances ?? ''} className={field} /></Field>
                        <Field label="Deductions"><input name="deductions" type="number" min="0" defaultValue={staff?.deductions ?? ''} className={field} /></Field>
                        <Field label="Payment Frequency"><select name="payment_frequency" defaultValue={staff?.payment_frequency ?? ''} className={field}><option value="">Select</option><option value="monthly">Monthly</option><option value="biweekly">Biweekly</option><option value="weekly">Weekly</option></select></Field>
                        <Field label="Payment Method"><select name="payment_method" defaultValue={staff?.payment_method ?? ''} className={field}><option value="">Select</option><option value="cash">Cash</option><option value="bank">Bank</option><option value="online">Online</option></select></Field>
                        <Field label="Salary Effective Date"><input name="salary_effective_date" type="date" defaultValue={staff?.salary_effective_date?.slice(0, 10) ?? ''} className={field} /></Field>
                        <p className="text-xs text-slate-500 md:col-span-2">Visible only to administrators and finance staff.</p>
                    </Section>

                    <Section title="Documents">
                        <p className="text-xs text-slate-500 md:col-span-2">Optional. Files can also be added later from the staff profile.</p>
                        {[
                            ['citizenship', 'Citizenship'],
                            ['academic_certificate', 'Academic certificate'],
                            ['experience_certificate', 'Experience certificate'],
                            ['cv', 'CV'],
                            ['appointment_letter', 'Appointment letter'],
                            ['other', 'Other'],
                        ].map(([type, label], index) => (
                            <label key={type} className="block rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2">
                                <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
                                <input type="hidden" name={`documents[${index}][type]`} value={type} />
                                <input name={`documents[${index}][file]`} type="file" className="block w-full text-xs text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-2 file:py-1 file:text-xs file:font-medium" />
                            </label>
                        ))}
                    </Section>
                </div>
                    <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 bg-white px-6 py-4">
                        <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                        {!staff && <button type="button" disabled={saving} onClick={(e) => { const form = e.currentTarget.closest('form'); if (form) submit({ preventDefault: () => undefined, currentTarget: form } as unknown as FormEvent<HTMLFormElement>, true); }} className="h-10 rounded-lg border border-blue-200 px-4 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-60">Save and add another</button>}
                        <button disabled={saving} className="h-10 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">{saving ? 'Saving…' : 'Save staff'}</button>
                    </div>
                </form>
            </motion.div>
        </motion.div>
    );
}

function StaffProfile({ staffId, initialTab, onClose }: { staffId: number; initialTab: string; onClose: () => void }) {
    const [staff, setStaff] = useState<StaffRecord | null>(null);
    const [tab, setTab] = useState(initialTab);
    const [error, setError] = useState<string | null>(null);
    const [docType, setDocType] = useState('other');
    const [uploading, setUploading] = useState(false);

    function load() {
        api.get<{ data: StaffRecord }>(`/api/institution/staff/${staffId}`).then(({ data }) => setStaff(data.data)).catch((r: unknown) => setError(getErrorMessage(r, 'Unable to load staff.')));
    }

    useEffect(() => { load(); }, [staffId]);

    async function uploadDocument(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget;
        const body = new FormData(form);
        setUploading(true);
        try {
            await api.post(`/api/institution/staff/${staffId}/documents`, body);
            form.reset();
            setDocType('other');
            load();
        } finally {
            setUploading(false);
        }
    }

    const tabs = ['Overview', 'Personal Information', 'Contact Information', 'Employment Details', 'Salary Information', 'Documents', 'Attendance History', 'Leave History', 'Employment History'];

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4">
            <div className="my-6 w-full max-w-5xl rounded-2xl bg-white p-6 shadow-xl">
                <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                        {staff?.photo_path ? <img alt="" src={`/api/institution/staff/${staffId}/photo`} className="size-14 rounded-full object-cover" /> : <div className="flex size-14 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600">{staff?.first_name?.slice(0, 1) ?? 'S'}</div>}
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">{staff ? `${staff.first_name} ${staff.middle_name ? `${staff.middle_name} ` : ''}${staff.last_name}` : 'Staff profile'}</h2>
                            <p className="text-sm text-slate-500">{staff?.employee_id ?? '—'} · {staff?.designation?.name ?? 'No designation'} · {staff?.department?.name ?? 'No department'}</p>
                            {staff && <span className={`mt-1 inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusStyles[staff.employment_status] ?? 'bg-slate-100 text-slate-700'}`}>{formatStatus(staff.employment_status)}</span>}
                        </div>
                    </div>
                    <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="size-4" /></button>
                </div>
                {error && <p className="mb-4 text-sm text-rose-700">{error}</p>}
                <div className="mb-4 flex flex-wrap gap-2">
                    {tabs.map((t) => <button key={t} type="button" onClick={() => setTab(t)} className={`rounded-lg px-3 py-2 text-sm ${tab === t ? 'bg-blue-50 font-medium text-blue-800' : 'text-slate-600 hover:bg-slate-100'}`}>{t}</button>)}
                </div>
                {staff && (
                    <div className="space-y-3 text-sm text-slate-700">
                        {tab === 'Overview' && <InfoGrid items={[['Employee ID', staff.employee_id], ['Name', `${staff.first_name} ${staff.middle_name ?? ''} ${staff.last_name}`.replace(/\s+/g, ' ').trim()], ['Department', staff.department?.name], ['Designation', staff.designation?.name], ['Employment Type', formatStatus(staff.employment_type ?? '—')], ['Status', formatStatus(staff.employment_status)], ['Joining Date', staff.joining_date], ['Phone', staff.personal_phone], ['Email', staff.email]]} />}
                        {tab === 'Personal Information' && <InfoGrid items={[['Gender', staff.gender], ['Date of Birth', staff.date_of_birth], ['Blood Group', staff.blood_group], ['Marital Status', staff.marital_status], ['Nationality', staff.nationality], ['Citizenship Number', staff.citizenship_number]]} />}
                        {tab === 'Contact Information' && <InfoGrid items={[['Phone', staff.personal_phone], ['Email', staff.email], ['Province', staff.province], ['District', staff.district], ['Municipality', staff.municipality], ['Ward', staff.ward], ['Permanent Address', staff.permanent_address], ['Temporary Address', staff.temporary_address], ['Emergency Contact', staff.emergency_contact_name], ['Emergency Relation', staff.emergency_contact_relation], ['Emergency Number', staff.emergency_contact_number]]} />}
                        {tab === 'Employment Details' && <InfoGrid items={[['Department', staff.department?.name], ['Designation', staff.designation?.name], ['Employment Type', formatStatus(staff.employment_type ?? '—')], ['Joining Date', staff.joining_date], ['Probation End Date', staff.probation_end_date], ['Reporting Manager', staff.reporting_manager?.name], ['Status', formatStatus(staff.employment_status)], ['Job Description', staff.job_description]]} />}
                        {tab === 'Salary Information' && (
                            staff.basic_salary !== undefined ? (
                                <div className="space-y-4">
                                    <InfoGrid items={[['Basic Salary', String(staff.basic_salary ?? '—')], ['Allowances', String(staff.allowances ?? '—')], ['Deductions', String(staff.deductions ?? '—')], ['Payment Frequency', staff.payment_frequency], ['Payment Method', staff.payment_method], ['Effective Date', staff.salary_effective_date]]} />
                                    <div>
                                        <h3 className="mb-2 font-medium text-slate-900">Salary History</h3>
                                        <SimpleTable headers={['Effective Date', 'Basic', 'Allowances', 'Deductions', 'Frequency', 'Method']} rows={(staff.salary_structures ?? []).map((s) => [s.effective_date ?? '—', String(s.basic_salary), String(s.allowances), String(s.deductions), s.payment_frequency ?? '—', s.payment_method ?? '—'])} />
                                    </div>
                                </div>
                            ) : <p className="text-slate-500">Salary information is restricted to authorized administrators and finance staff.</p>
                        )}
                        {tab === 'Documents' && (
                            <div className="space-y-4">
                                <form onSubmit={uploadDocument} className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 p-3">
                                    <label className="block text-xs text-slate-500">Type<select value={docType} onChange={(e) => setDocType(e.target.value)} name="type" className="mt-1 h-9 rounded-lg border border-slate-200 px-2 text-sm"><option value="citizenship">Citizenship</option><option value="academic_certificate">Academic Certificate</option><option value="experience_certificate">Experience Certificate</option><option value="cv">CV / Resume</option><option value="appointment_letter">Appointment Letter</option><option value="other">Other</option></select></label>
                                    <label className="block text-xs text-slate-500">File<input name="file" type="file" required className="mt-1 block text-sm" /></label>
                                    <button disabled={uploading} className="h-9 rounded-lg bg-blue-700 px-3 text-sm font-medium text-white disabled:opacity-60">{uploading ? 'Uploading…' : 'Upload'}</button>
                                </form>
                                <SimpleTable headers={['Type', 'Name', 'Size', 'Uploaded', 'Download']} rows={(staff.documents ?? []).map((d) => [formatStatus(d.type), d.original_name, d.file_size ? `${Math.round(d.file_size / 1024)} KB` : '—', d.created_at?.slice(0, 10) ?? '—', <a key={d.id} className="text-blue-700 hover:underline" href={`/api/institution/staff/${staffId}/documents/${d.id}`}>Download</a>])} />
                            </div>
                        )}
                        {tab === 'Attendance History' && <SimpleTable headers={['Date', 'Status', 'Check In', 'Check Out']} rows={(staff.attendance_records ?? []).map((a) => [a.attended_on ?? '—', formatStatus(a.status), a.check_in ?? '—', a.check_out ?? '—'])} />}
                        {tab === 'Leave History' && <SimpleTable headers={['Type', 'Start', 'End', 'Days', 'Status', 'Reason']} rows={(staff.leave_requests ?? []).map((l) => [l.leave_type ?? '—', l.starts_on ?? '—', l.ends_on ?? '—', String(l.days), formatStatus(l.status), l.reason ?? '—'])} />}
                        {tab === 'Employment History' && <SimpleTable headers={['Event', 'Previous', 'New', 'Effective Date', 'Notes']} rows={(staff.employment_histories ?? []).map((h) => [formatStatus(h.event_type), formatStatus(h.previous_status ?? '—'), formatStatus(h.new_status ?? '—'), h.effective_date ?? '—', h.notes ?? '—'])} />}
                    </div>
                )}
            </div>
        </div>
    );
}

function InfoGrid({ items }: { items: Array<[string, string | null | undefined]> }) {
    return (
        <div className="grid gap-3 sm:grid-cols-2">
            {items.map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
                    <p className="mt-1 text-sm text-slate-800">{value && value !== '' ? value : '—'}</p>
                </div>
            ))}
        </div>
    );
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: Array<Array<ReactNode>> }) {
    return (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500"><tr>{headers.map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr><td colSpan={headers.length} className="px-3 py-6 text-center text-slate-500">No records found.</td></tr>
                    ) : rows.map((row, i) => <tr key={i} className="border-t border-slate-100">{row.map((cell, j) => <td key={j} className="px-3 py-2">{cell}</td>)}</tr>)}
                </tbody>
            </table>
        </div>
    );
}

function StatusModal({ staff, onClose, onSave }: { staff: StaffRecord; onClose: () => void; onSave: (status: string) => Promise<void> }) {
    const [status, setStatus] = useState(staff.employment_status);
    const [saving, setSaving] = useState(false);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
                <h3 className="text-lg font-semibold text-slate-900">Change Employment Status</h3>
                <p className="mt-1 text-sm text-slate-500">{staff.first_name} {staff.last_name} ({staff.employee_id})</p>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-4 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm">
                    {['active', 'on_leave', 'suspended', 'resigned', 'terminated'].map((s) => <option key={s} value={s}>{formatStatus(s)}</option>)}
                </select>
                <div className="mt-4 flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-200 px-4 text-sm">Cancel</button>
                    <button type="button" disabled={saving} onClick={async () => { setSaving(true); try { await onSave(status); } finally { setSaving(false); } }} className="h-10 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Update Status'}</button>
                </div>
            </div>
        </div>
    );
}

function ManagementModal({ type, departments, designations, staff, onClose, onChanged }: { type: 'departments' | 'designations'; departments: Option[]; designations: Option[]; staff: Array<{ id: number; name: string }>; onClose: () => void; onChanged: () => void }) {
    const isDept = type === 'departments';
    const items = isDept ? departments : designations;
    const [name, setName] = useState('');
    const [headStaffId, setHeadStaffId] = useState('');
    const [editingId, setEditingId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const payload = isDept ? { name, head_staff_id: headStaffId === '' ? null : Number(headStaffId) } : { name };
            if (editingId) {
                await api.patch(`/api/institution/${isDept ? 'staff-departments' : 'staff-designations'}/${editingId}`, payload);
            } else {
                await api.post(`/api/institution/${isDept ? 'staff-departments' : 'staff-designations'}`, payload);
            }
            setName(''); setHeadStaffId(''); setEditingId(null);
            onChanged();
        } catch (reason) {
            setError(getErrorMessage(reason, 'Unable to save.'));
        } finally {
            setSaving(false);
        }
    }

    async function toggleActive(item: Option) {
        await api.patch(`/api/institution/${isDept ? 'staff-departments' : 'staff-designations'}/${item.id}`, { is_active: !item.is_active });
        onChanged();
    }

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4">
            <div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-slate-900">{isDept ? 'Department Management' : 'Designation Management'}</h3>
                    <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="size-4" /></button>
                </div>
                {error && <p className="mb-3 text-sm text-rose-700">{error}</p>}
                <form onSubmit={save} className="mb-4 grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
                    <label className="block text-xs font-medium text-slate-500">Name<input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" /></label>
                    {isDept && <label className="block text-xs font-medium text-slate-500">Department Head<select value={headStaffId} onChange={(e) => setHeadStaffId(e.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"><option value="">None</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
                    <div className="flex items-end gap-2 sm:col-span-2">
                        <button disabled={saving} className="h-10 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : editingId ? 'Update' : 'Create'}</button>
                        {editingId && <button type="button" onClick={() => { setEditingId(null); setName(''); setHeadStaffId(''); }} className="h-10 rounded-lg border border-slate-200 px-4 text-sm">Cancel edit</button>}
                    </div>
                </form>
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2 font-medium">Name</th>{isDept && <th className="px-3 py-2 font-medium">Head</th>}<th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Actions</th></tr></thead>
                        <tbody>
                            {items.length === 0 ? <tr><td colSpan={isDept ? 4 : 3} className="px-3 py-6 text-center text-slate-500">No records found.</td></tr> : items.map((item) => (
                                <tr key={item.id} className="border-t border-slate-100">
                                    <td className="px-3 py-2">{item.name}</td>
                                    {isDept && <td className="px-3 py-2">{departments.find((d) => d.id === item.id)?.head_staff_id ? staff.find((s) => s.id === departments.find((d) => d.id === item.id)?.head_staff_id)?.name ?? '—' : '—'}</td>}
                                    <td className="px-3 py-2">{item.is_active ? 'Active' : 'Inactive'}</td>
                                    <td className="px-3 py-2"><div className="flex gap-2"><button type="button" onClick={() => { setEditingId(item.id); setName(item.name); setHeadStaffId(String((item as Option & { head_staff_id?: number | null }).head_staff_id ?? '')); }} className="text-blue-700 hover:underline">Edit</button><button type="button" onClick={() => toggleActive(item)} className="text-slate-700 hover:underline">{item.is_active ? 'Deactivate' : 'Activate'}</button></div></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
