import { type FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MoreHorizontal, UserPlus, X } from 'lucide-react';
import { api, getErrorMessage } from './api';

interface StudentRecord {
    id: number;
    admission_number: string;
    first_name: string;
    last_name: string;
    gender: string | null;
    date_of_birth: string | null;
    email: string | null;
    guardian_name: string | null;
    guardian_relationship: string | null;
    guardian_phone: string | null;
    guardian_email: string | null;
    status: string;
    admission_date: string | null;
    previous_school: string | null;
    province: string | null;
    district: string | null;
    municipality: string | null;
    ward: string | null;
    street: string | null;
    permanent_address: string | null;
    school_class_id: number | null;
    section_id: number | null;
    academic_session_id: number | null;
    photo_path: string | null;
    school_class?: { id: number; name: string } | null;
    section?: { id: number; name: string } | null;
    academic_session?: { id: number; name: string } | null;
    attendance_records?: unknown[];
    marks?: unknown[];
    invoices?: unknown[];
}

interface PagePayload {
    data: StudentRecord[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
}

const columns = ['Photo', 'Admission', 'First name', 'Last name', 'Guardian', 'Guardian phone', 'Gender', 'Date of birth', 'Class', 'Section', 'Session', 'Admission date', 'Status', 'Actions'] as const;
const field = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15';

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

export function StudentsPage() {
    const [page, setPage] = useState<PagePayload | null>(null);
    const [search, setSearch] = useState('');
    const [debounced, setDebounced] = useState('');
    const [filters, setFilters] = useState({ school_class_id: '', section_id: '', academic_session_id: '', gender: '', status: '' });
    const [perPage, setPerPage] = useState(10);
    const [current, setCurrent] = useState(1);
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<StudentRecord | null>(null);
    const [viewing, setViewing] = useState<number | null>(null);
    const [toast, setToast] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [visible, setVisible] = useState<string[]>([...columns]);
    const [classes, setClasses] = useState<Array<{ id: number; name: string; sections?: Array<{ id: number; name: string }> }>>([]);
    const [sessions, setSessions] = useState<Array<{ id: number; name: string }>>([]);
    const [menu, setMenu] = useState<number | null>(null);

    useEffect(() => {
        const timer = window.setTimeout(() => setDebounced(search), 300);

        return () => window.clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        setCurrent(1);
    }, [debounced, filters, perPage]);

    useEffect(() => {
        api.get<{ data: typeof classes }>('/api/institution/classes').then(({ data }) => setClasses(data.data)).catch(() => undefined);
        api.get<{ data: typeof sessions }>('/api/institution/sessions').then(({ data }) => setSessions(data.data)).catch(() => undefined);
    }, []);

    useEffect(() => {
        api.get<PagePayload>('/api/institution/students', {
            params: { search: debounced, page: current, per_page: perPage, ...filters },
        }).then(({ data }) => setPage(data)).catch((reason: unknown) => setError(getErrorMessage(reason, 'Unable to load students.')));
    }, [debounced, filters, perPage, current, toast]);

    const sections = useMemo(
        () => classes.find((item) => String(item.id) === filters.school_class_id)?.sections ?? [],
        [classes, filters.school_class_id],
    );

    async function remove(student: StudentRecord) {
        if (!window.confirm(`Archive ${student.first_name} ${student.last_name}? Academic and fee history is kept.`)) {
            return;
        }

        await api.delete(`/api/institution/students/${student.id}`);
        setMenu(null);
        setToast('Student archived.');
    }

    return (
        <div>
            {toast && <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{toast}</p>}
            {error && <p className="mb-4 text-sm text-rose-700">{error}</p>}
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight">Students</h1>
                    <p className="mt-1 text-sm text-slate-500">Manage and view all registered students.</p>
                    <p className="mt-1 text-sm font-medium text-slate-700">{page?.total ?? 0} registered</p>
                </div>
                <button type="button" onClick={() => { setEditing(null); setOpen(true); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white">
                    <UserPlus className="size-4" /> Register Student
                </button>
            </div>
            <div className="mb-4 grid gap-2 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-4">
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, admission number, or guardian" className="h-10 rounded-lg border border-slate-200 px-3 text-sm md:col-span-2" />
                <select value={filters.school_class_id} onChange={(event) => setFilters({ ...filters, school_class_id: event.target.value, section_id: '' })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
                    <option value="">All classes</option>
                    {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <select value={filters.section_id} onChange={(event) => setFilters({ ...filters, section_id: event.target.value })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
                    <option value="">All sections</option>
                    {sections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <select value={filters.academic_session_id} onChange={(event) => setFilters({ ...filters, academic_session_id: event.target.value })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
                    <option value="">All sessions</option>
                    {sessions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <select value={filters.gender} onChange={(event) => setFilters({ ...filters, gender: event.target.value })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
                    <option value="">All genders</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                </select>
                <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="graduated">Graduated</option>
                    <option value="transferred">Transferred</option>
                </select>
                <button type="button" onClick={() => { setSearch(''); setFilters({ school_class_id: '', section_id: '', academic_session_id: '', gender: '', status: '' }); }} className="h-10 rounded-lg border border-slate-200 text-sm">Reset filters</button>
            </div>
            <details className="mb-3 text-sm text-slate-600">
                <summary className="cursor-pointer">Show or hide columns</summary>
                <div className="mt-2 flex flex-wrap gap-3">
                    {columns.map((column) => (
                        <label key={column} className="inline-flex items-center gap-1">
                            <input type="checkbox" checked={visible.includes(column)} onChange={() => setVisible((currentColumns) => currentColumns.includes(column) ? currentColumns.filter((item) => item !== column) : [...currentColumns, column])} />
                            {column}
                        </label>
                    ))}
                </div>
            </details>
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full min-w-[1100px] text-left text-sm">
                    <thead className="sticky top-0 bg-slate-50 text-slate-500">
                        <tr>{columns.filter((column) => visible.includes(column)).map((column) => <th key={column} className="px-3 py-3 font-medium">{column}</th>)}</tr>
                    </thead>
                    <tbody>
                        {(page?.data ?? []).map((student) => (
                            <tr key={student.id} className="border-t border-slate-100 hover:bg-slate-50">
                                {visible.includes('Photo') && <td className="px-3 py-3">{student.photo_path ? <img alt="" src={`/api/institution/students/${student.id}/photo`} className="size-9 rounded-full object-cover" /> : <span className="flex size-9 items-center justify-center rounded-full bg-slate-100 text-xs">{student.first_name.slice(0, 1)}</span>}</td>}
                                {visible.includes('Admission') && <td className="px-3 py-3">{student.admission_number}</td>}
                                {visible.includes('First name') && <td className="px-3 py-3">{student.first_name}</td>}
                                {visible.includes('Last name') && <td className="px-3 py-3">{student.last_name}</td>}
                                {visible.includes('Guardian') && <td className="px-3 py-3">{student.guardian_name ?? '—'}</td>}
                                {visible.includes('Guardian phone') && <td className="px-3 py-3">{student.guardian_phone ?? '—'}</td>}
                                {visible.includes('Gender') && <td className="px-3 py-3 capitalize">{student.gender ?? '—'}</td>}
                                {visible.includes('Date of birth') && <td className="px-3 py-3">{student.date_of_birth?.slice(0, 10) ?? '—'}</td>}
                                {visible.includes('Class') && <td className="px-3 py-3">{student.school_class?.name ?? '—'}</td>}
                                {visible.includes('Section') && <td className="px-3 py-3">{student.section?.name ?? '—'}</td>}
                                {visible.includes('Session') && <td className="px-3 py-3">{student.academic_session?.name ?? '—'}</td>}
                                {visible.includes('Admission date') && <td className="px-3 py-3">{student.admission_date?.slice(0, 10) ?? '—'}</td>}
                                {visible.includes('Status') && <td className="px-3 py-3"><span className="rounded-full bg-slate-100 px-2 py-1 text-xs capitalize">{student.status}</span></td>}
                                {visible.includes('Actions') && (
                                    <td className="relative px-3 py-3">
                                        <button type="button" aria-label="Student actions" onClick={() => setMenu(menu === student.id ? null : student.id)} className="rounded-lg p-2 hover:bg-slate-100"><MoreHorizontal className="size-4" /></button>
                                        {menu === student.id && (
                                            <div className="absolute right-3 z-10 w-36 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                                                <button type="button" className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50" onClick={() => { setViewing(student.id); setMenu(null); }}>View</button>
                                                <button type="button" className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50" onClick={() => { setEditing(student); setOpen(true); setMenu(null); }}>Edit</button>
                                                <button type="button" className="block w-full rounded-lg px-3 py-2 text-left text-rose-700 hover:bg-rose-50" onClick={() => remove(student)}>Delete</button>
                                            </div>
                                        )}
                                    </td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                <p>Showing {page?.from ?? 0}–{page?.to ?? 0} of {page?.total ?? 0} students</p>
                <div className="flex flex-wrap items-center gap-2">
                    <select value={perPage} onChange={(event) => setPerPage(Number(event.target.value))} className="h-9 rounded-lg border border-slate-200 px-2">
                        {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size} / page</option>)}
                    </select>
                    <button type="button" disabled={current <= 1} onClick={() => setCurrent((value) => value - 1)} className="h-9 rounded-lg border border-slate-200 px-3 disabled:opacity-40">Previous</button>
                    {Array.from({ length: page?.last_page ?? 1 }, (_, index) => index + 1).slice(0, 8).map((number) => (
                        <button key={number} type="button" onClick={() => setCurrent(number)} className={`h-9 min-w-9 rounded-lg border px-2 ${number === current ? 'border-blue-700 bg-blue-50 text-blue-800' : 'border-slate-200'}`}>{number}</button>
                    ))}
                    <button type="button" disabled={!page || current >= page.last_page} onClick={() => setCurrent((value) => value + 1)} className="h-9 rounded-lg border border-slate-200 px-3 disabled:opacity-40">Next</button>
                </div>
            </div>
            <AnimatePresence>
                {open && (
                    <StudentForm
                        student={editing}
                        classes={classes}
                        sessions={sessions}
                        onClose={() => setOpen(false)}
                        onSaved={(message) => { setOpen(false); setToast(message); }}
                    />
                )}
            </AnimatePresence>
            {viewing !== null && <Profile studentId={viewing} onClose={() => setViewing(null)} />}
        </div>
    );
}

function StudentForm({ student, classes, sessions, onClose, onSaved }: {
    student: StudentRecord | null;
    classes: Array<{ id: number; name: string; sections?: Array<{ id: number; name: string }> }>;
    sessions: Array<{ id: number; name: string }>;
    onClose: () => void;
    onSaved: (message: string) => void;
}) {
    const [classId, setClassId] = useState(student?.school_class_id ? String(student.school_class_id) : '');
    const [preview, setPreview] = useState<string | null>(student?.photo_path ? `/api/institution/students/${student.id}/photo` : null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const sections = classes.find((item) => String(item.id) === classId)?.sections ?? [];

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSaving(true);
        setError(null);
        const body = new FormData(event.currentTarget);

        try {
            if (student) {
                await api.post(`/api/institution/students/${student.id}`, body);
                onSaved('Student updated.');
            } else {
                await api.post('/api/institution/students', body);
                onSaved('Student registered.');
            }
        } catch (reason: unknown) {
            setError(getErrorMessage(reason, 'Unable to save the student.'));
            setSaving(false);
        }
    }

    return (
        <motion.div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 p-4 sm:p-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.form onSubmit={submit} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="my-auto flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">{student ? 'Edit student' : 'Register student'}</h2>
                        <p className="mt-0.5 text-sm text-slate-500">Personal, guardian, academic, and address details.</p>
                    </div>
                    <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="size-4" /></button>
                </div>
                <div className="max-h-[min(70vh,720px)] space-y-4 overflow-y-auto px-6 py-5">
                    {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
                    <Section title="Personal information">
                        <div className="flex items-center gap-4 md:col-span-2">
                            {preview ? (
                                <img alt="Student preview" src={preview} className="size-14 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />
                            ) : (
                                <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-500">Photo</div>
                            )}
                            <label className="text-sm text-slate-600">
                                Student photo
                                <input name="photo" type="file" accept="image/*" className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium" onChange={(event) => {
                                    const file = event.target.files?.[0];
                                    if (file) {
                                        setPreview(URL.createObjectURL(file));
                                    }
                                }} />
                            </label>
                        </div>
                        <Field label="Admission number"><input name="admission_number" defaultValue={student?.admission_number ?? ''} placeholder="Leave blank to generate" className={field} /></Field>
                        <Field label="Email"><input name="email" type="email" defaultValue={student?.email ?? ''} className={field} /></Field>
                        <Field label="First name"><input name="first_name" required defaultValue={student?.first_name ?? ''} className={field} /></Field>
                        <Field label="Last name"><input name="last_name" required defaultValue={student?.last_name ?? ''} className={field} /></Field>
                        <Field label="Date of birth"><input name="date_of_birth" type="date" defaultValue={student?.date_of_birth?.slice(0, 10) ?? ''} className={field} /></Field>
                        <Field label="Gender">
                            <select name="gender" defaultValue={student?.gender ?? ''} className={field}>
                                <option value="">Select</option>
                                <option value="female">Female</option>
                                <option value="male">Male</option>
                                <option value="other">Other</option>
                            </select>
                        </Field>
                    </Section>
                    <Section title="Guardian">
                        <Field label="Full name"><input name="guardian_name" defaultValue={student?.guardian_name ?? ''} className={field} /></Field>
                        <Field label="Relationship"><input name="guardian_relationship" defaultValue={student?.guardian_relationship ?? ''} placeholder="Parent, guardian" className={field} /></Field>
                        <Field label="Phone"><input name="guardian_phone" defaultValue={student?.guardian_phone ?? ''} className={field} /></Field>
                        <Field label="Email"><input name="guardian_email" type="email" defaultValue={student?.guardian_email ?? ''} className={field} /></Field>
                    </Section>
                    <Section title="Academic information">
                        <Field label="Academic session">
                            <select name="academic_session_id" defaultValue={student?.academic_session_id ?? ''} className={field}>
                                <option value="">Select</option>
                                {sessions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                            </select>
                        </Field>
                        <Field label="Class">
                            <select name="school_class_id" value={classId} onChange={(event) => setClassId(event.target.value)} className={field}>
                                <option value="">Select</option>
                                {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                            </select>
                        </Field>
                        <Field label="Section">
                            <select key={classId} name="section_id" defaultValue={student?.section_id ?? ''} className={field}>
                                <option value="">Select</option>
                                {sections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                            </select>
                        </Field>
                        <Field label="Admission date"><input name="admission_date" type="date" defaultValue={student?.admission_date?.slice(0, 10) ?? ''} className={field} /></Field>
                        <Field label="Previous school or college" wide><input name="previous_school" defaultValue={student?.previous_school ?? ''} className={field} /></Field>
                    </Section>
                    <Section title="Address">
                        <Field label="Province"><input name="province" defaultValue={student?.province ?? ''} className={field} /></Field>
                        <Field label="District"><input name="district" defaultValue={student?.district ?? ''} className={field} /></Field>
                        <Field label="Municipality"><input name="municipality" defaultValue={student?.municipality ?? ''} className={field} /></Field>
                        <Field label="Ward number"><input name="ward" defaultValue={student?.ward ?? ''} className={field} /></Field>
                        <Field label="Street or tole"><input name="street" defaultValue={student?.street ?? ''} className={field} /></Field>
                        <Field label="Permanent address"><input name="permanent_address" defaultValue={student?.permanent_address ?? ''} className={field} /></Field>
                    </Section>
                </div>
                <div className="flex justify-end gap-2 border-t border-slate-100 bg-white px-6 py-4">
                    <button type="button" onClick={onClose} className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                    <button disabled={saving} className="h-10 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">{saving ? 'Saving…' : 'Save student'}</button>
                </div>
            </motion.form>
        </motion.div>
    );
}

function Profile({ studentId, onClose }: { studentId: number; onClose: () => void }) {
    const [student, setStudent] = useState<StudentRecord | null>(null);

    useEffect(() => {
        api.get<{ data: StudentRecord }>(`/api/institution/students/${studentId}`).then(({ data }) => setStudent(data.data));
    }, [studentId]);

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-4">
            <div className="my-6 w-full max-w-2xl rounded-2xl bg-white p-6">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">{student ? `${student.first_name} ${student.last_name}` : 'Student'}</h2>
                    <button type="button" aria-label="Close" onClick={onClose}><X className="size-4" /></button>
                </div>
                {student && (
                    <div className="space-y-3 text-sm text-slate-700">
                        <p>Admission {student.admission_number} · {student.school_class?.name ?? 'No class'} {student.section?.name ?? ''}</p>
                        <p>Guardian: {student.guardian_name ?? '—'} · {student.guardian_phone ?? '—'} · {student.guardian_email ?? '—'}</p>
                        <p>Address: {[student.street, student.ward, student.municipality, student.district, student.province].filter(Boolean).join(', ') || '—'}</p>
                        <p>Attendance records: {student.attendance_records?.length ?? 0}</p>
                        <p>Examination marks: {student.marks?.length ?? 0}</p>
                        <p>Fee invoices: {student.invoices?.length ?? 0}</p>
                        <p className="text-slate-500">Uploaded student documents are not stored yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
