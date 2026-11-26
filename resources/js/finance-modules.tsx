import { AnimatePresence, motion } from 'framer-motion';
import {
    AlertCircle,
    CalendarDays,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    CircleDollarSign,
    CreditCard,
    Download,
    Eye,
    FileText,
    Mail,
    Pencil,
    Plus,
    Printer,
    Receipt,
    RefreshCw,
    RotateCcw,
    Search,
    ShieldCheck,
    Wallet,
    X,
} from 'lucide-react';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, getErrorMessage } from './api';
import { useWorkspaceAuth } from './workspace';

interface PageResult<T> {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
    summary?: {
        count: number;
        balance_due: number;
        overdue_count: number;
    };
}

interface StudentOption {
    id: number;
    name: string;
    admission_number: string;
    class?: string | null;
}

interface FinanceLookups {
    classes: Array<{ id: number; name: string; code?: string | null }>;
    academic_sessions: Array<{ id: number; name: string; code?: string | null; is_current?: boolean }>;
    fee_categories: Array<{ id: number; name: string }>;
    fee_structures: Array<{
        id: number;
        name: string;
        amount: number;
        fee_category_id: number | null;
        school_class_id: number | null;
        academic_session_id: number | null;
        category?: { id: number; name: string } | null;
        school_class?: { id: number; name: string } | null;
        academic_session?: { id: number; name: string } | null;
    }>;
    payment_methods: Array<{ id: number; name: string; code: string; instructions?: string | null; enabled?: boolean; is_active?: boolean }>;
}

interface InvoiceRow {
    id: number;
    number: string;
    description: string | null;
    amount: number;
    base_amount: number;
    discount_amount: number;
    late_fee_amount: number;
    paid_amount: number;
    balance_due: number;
    status: string;
    display_status: string;
    issued_on: string;
    due_on: string;
    cancellation_reason?: string | null;
    student?: {
        id: number;
        first_name: string;
        last_name: string;
        admission_number: string;
        school_class_id?: number | null;
    } | null;
    school_class?: { id: number; name: string } | null;
    academic_session?: { id: number; name: string } | null;
    fee_category?: { id: number; name: string } | null;
    fee_structure?: { id: number; name: string } | null;
    payments?: PaymentRow[];
}

interface PaymentRow {
    id: number;
    receipt_number: string;
    amount: number;
    paid_on: string;
    method: string;
    transaction_id: string | null;
    status: string;
    verified_at: string | null;
    reversed_at?: string | null;
    reversal_reason?: string | null;
    invoice?: {
        id: number;
        number: string;
        student?: { id: number; first_name: string; last_name: string; admission_number: string } | null;
        school_class?: { name: string } | null;
    } | null;
    verifier?: { name: string } | null;
}

const fieldClass = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100';
const buttonClass = 'inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50';
const softButtonClass = 'inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-50';
const chartColors = ['#2563eb', '#14b8a6', '#f59e0b', '#8b5cf6', '#f43f5e', '#0ea5e9'];

function todayString(): string {
    const date = new Date();
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function startOfMonthString(): string {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function money(amount: number, currency = 'NPR'): string {
    return new Intl.NumberFormat('en-NP', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
    }).format(amount ?? 0);
}

function PageHeading({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
    return (
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">Finance workspace</p>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{detail}</p>
            </div>
            {action}
        </div>
    );
}

function SummaryCard({ label, value, note, icon: Icon, tone = 'blue' }: {
    label: string;
    value: string;
    note?: string;
    icon: typeof Receipt;
    tone?: 'blue' | 'teal' | 'amber' | 'rose';
}) {
    const tones = {
        blue: 'bg-blue-50 text-blue-700 ring-blue-100',
        teal: 'bg-teal-50 text-teal-700 ring-teal-100',
        amber: 'bg-amber-50 text-amber-700 ring-amber-100',
        rose: 'bg-rose-50 text-rose-700 ring-rose-100',
    };

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-medium text-slate-500">{label}</p>
                    <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
                    {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
                </div>
                <span className={`grid size-10 shrink-0 place-items-center rounded-xl ring-1 ${tones[tone]}`}>
                    <Icon className="size-5" />
                </span>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        paid: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
        posted: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
        verified: 'bg-teal-50 text-teal-700 ring-teal-200',
        partial: 'bg-amber-50 text-amber-700 ring-amber-200',
        overdue: 'bg-rose-50 text-rose-700 ring-rose-200',
        reversed: 'bg-slate-100 text-slate-600 ring-slate-200',
        cancelled: 'bg-slate-100 text-slate-600 ring-slate-200',
        unpaid: 'bg-blue-50 text-blue-700 ring-blue-200',
        open: 'bg-blue-50 text-blue-700 ring-blue-200',
    };

    return (
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${styles[status] ?? 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
            {status === 'open' ? 'Unpaid' : status}
        </span>
    );
}

function Notice({ tone, children, onDismiss }: { tone: 'success' | 'error'; children: ReactNode; onDismiss?: () => void }) {
    return (
        <div className={`mb-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`} role="status">
            {tone === 'success' ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <AlertCircle className="mt-0.5 size-4 shrink-0" />}
            <div className="min-w-0 flex-1">{children}</div>
            {onDismiss && <button type="button" onClick={onDismiss} aria-label="Dismiss notification"><X className="size-4" /></button>}
        </div>
    );
}

function LoadingPanel({ label = 'Loading financial records…' }: { label?: string }) {
    return (
        <div className="flex min-h-40 items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
            <span className="mr-3 size-5 animate-spin rounded-full border-2 border-blue-100 border-t-blue-700" />
            {label}
        </div>
    );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
    return (
        <div className="px-6 py-14 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-500"><Receipt className="size-5" /></span>
            <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{detail}</p>
        </div>
    );
}

function Pagination({ page, lastPage, total, onChange }: { page: number; lastPage: number; total: number; onChange: (page: number) => void }) {
    if (total < 1) {
        return null;
    }

    return (
        <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>Page {page} of {lastPage} · {total.toLocaleString()} records</span>
            <div className="flex gap-2">
                <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1} className={softButtonClass} aria-label="Previous page">
                    <ChevronLeft className="size-4" /> Previous
                </button>
                <button type="button" onClick={() => onChange(page + 1)} disabled={page >= lastPage} className={softButtonClass} aria-label="Next page">
                    Next <ChevronRight className="size-4" />
                </button>
            </div>
        </div>
    );
}

function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-sm sm:p-6 print:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onMouseDown={(event) => {
                    if (event.target === event.currentTarget) {
                        onClose();
                    }
                }}
            >
                <motion.section
                    role="dialog"
                    aria-modal="true"
                    aria-label={title}
                    className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl bg-white shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-xl'}`}
                    initial={{ opacity: 0, y: 14, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                >
                    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
                        <h2 className="font-semibold text-slate-900">{title}</h2>
                        <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close dialog">
                            <X className="size-4" />
                        </button>
                    </div>
                    <div className="p-5">{children}</div>
                </motion.section>
            </motion.div>
        </AnimatePresence>
    );
}

function InvoiceForm({ invoice, lookups, onClose, onSaved }: {
    invoice: InvoiceRow | null;
    lookups: FinanceLookups | null;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [studentSearch, setStudentSearch] = useState(invoice?.student ? `${invoice.student.first_name} ${invoice.student.last_name}` : '');
    const [studentOptions, setStudentOptions] = useState<StudentOption[]>(invoice?.student ? [{
        id: invoice.student.id,
        name: `${invoice.student.first_name} ${invoice.student.last_name}`,
        admission_number: invoice.student.admission_number,
    }] : []);
    const [studentId, setStudentId] = useState<number | null>(invoice?.student?.id ?? null);
    const [structureId, setStructureId] = useState<string>(invoice?.fee_structure ? String(invoice.fee_structure.id) : '');
    const [amount, setAmount] = useState(String(invoice?.base_amount || invoice?.amount || ''));
    const [discount, setDiscount] = useState(String(invoice?.discount_amount ?? 0));
    const [lateFee, setLateFee] = useState(String(invoice?.late_fee_amount ?? 0));
    const [issuedOn, setIssuedOn] = useState(invoice?.issued_on?.slice(0, 10) ?? todayString());
    const [dueOn, setDueOn] = useState(invoice?.due_on?.slice(0, 10) ?? '');
    const [classId, setClassId] = useState(String(invoice?.school_class?.id ?? ''));
    const [sessionId, setSessionId] = useState(String(invoice?.academic_session?.id ?? ''));
    const [categoryId, setCategoryId] = useState(String(invoice?.fee_category?.id ?? ''));
    const [description, setDescription] = useState(invoice?.description ?? '');
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (studentSearch.trim().length < 2 || studentId !== null) {
            return;
        }

        let active = true;
        const timer = window.setTimeout(() => {
            api.get<{ data: StudentOption[] }>('/api/institution/finance/students', {
                params: { search: studentSearch, include_all: true },
            })
                .then(({ data }) => {
                    if (active) {
                        setStudentOptions(data.data);
                    }
                })
                .catch((reason: unknown) => {
                    if (active) {
                        setError(getErrorMessage(reason, 'Unable to search students.'));
                    }
                });
        }, 250);

        return () => {
            active = false;
            window.clearTimeout(timer);
        };
    }, [studentSearch, studentId]);

    function chooseStructure(value: string) {
        setStructureId(value);
        const structure = lookups?.fee_structures.find((row) => String(row.id) === value);
        if (!structure) {
            return;
        }

        setAmount(String(structure.amount));
        setDescription(structure.name);
        setClassId(structure.school_class_id ? String(structure.school_class_id) : '');
        setSessionId(structure.academic_session_id ? String(structure.academic_session_id) : '');
        setCategoryId(structure.fee_category_id ? String(structure.fee_category_id) : '');
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (studentId === null) {
            setError('Choose a student from the search results.');
            return;
        }
        setSaving(true);
        setError(null);
        const payload = {
            student_id: studentId,
            fee_structure_id: structureId ? Number(structureId) : null,
            fee_category_id: categoryId ? Number(categoryId) : null,
            school_class_id: classId ? Number(classId) : null,
            academic_session_id: sessionId ? Number(sessionId) : null,
            amount: Number(amount),
            discount_amount: Number(discount || 0),
            late_fee_amount: Number(lateFee || 0),
            issued_on: issuedOn,
            due_on: dueOn,
            description: description || null,
        };

        try {
            if (invoice) {
                await api.patch(`/api/institution/invoices/${invoice.id}`, payload);
            } else {
                await api.post('/api/institution/invoices', payload);
            }
            onSaved();
        } catch (reason: unknown) {
            setError(getErrorMessage(reason, 'Unable to save the invoice.'));
        } finally {
            setSaving(false);
        }
    }

    const total = Number(amount || 0) - Number(discount || 0) + Number(lateFee || 0);

    return (
        <Modal title={invoice ? `Edit invoice ${invoice.number}` : 'Create student invoice'} onClose={onClose} wide>
            {error && <Notice tone="error">{error}</Notice>}
            <form onSubmit={submit} className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="md:col-span-2">
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Student</label>
                        {studentId !== null ? (
                            <div className="flex h-11 items-center justify-between rounded-xl border border-blue-200 bg-blue-50 px-3 text-sm text-blue-900">
                                <span>{studentSearch} · {studentOptions.find((student) => student.id === studentId)?.admission_number}</span>
                                <button type="button" onClick={() => { setStudentId(null); setStudentSearch(''); setStudentOptions([]); }} className="text-xs font-semibold text-blue-700">Change</button>
                            </div>
                        ) : (
                            <>
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" />
                                    <input value={studentSearch} onChange={(event) => setStudentSearch(event.target.value)} className={`${fieldClass} pl-9`} placeholder="Search name or admission number" />
                                </div>
                                {studentOptions.length > 0 && (
                                    <div className="mt-1 max-h-40 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                                        {studentOptions.map((student) => (
                                            <button type="button" key={student.id} onClick={() => { setStudentId(student.id); setStudentSearch(student.name); setStudentOptions([student]); }} className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-blue-50">
                                                <span className="font-medium text-slate-800">{student.name}</span>
                                                <span className="text-xs text-slate-500">{student.admission_number}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Fee structure</label>
                        <select value={structureId} onChange={(event) => chooseStructure(event.target.value)} className={fieldClass}>
                            <option value="">Custom invoice</option>
                            {lookups?.fee_structures.map((structure) => (
                                <option key={structure.id} value={structure.id}>{structure.name} · {money(structure.amount)}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Fee category</label>
                        <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className={fieldClass}>
                            <option value="">Not specified</option>
                            {lookups?.fee_categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Class</label>
                        <select value={classId} onChange={(event) => setClassId(event.target.value)} className={fieldClass}>
                            <option value="">Not specified</option>
                            {lookups?.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Academic year</label>
                        <select value={sessionId} onChange={(event) => setSessionId(event.target.value)} className={fieldClass}>
                            <option value="">Not specified</option>
                            {lookups?.academic_sessions.map((item) => <option key={item.id} value={item.id}>{item.name}{item.is_current ? ' · Current' : ''}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Subtotal</label>
                        <input type="number" min="1" step="1" required value={amount} onChange={(event) => setAmount(event.target.value)} className={fieldClass} />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Discount</label>
                        <input type="number" min="0" step="1" value={discount} onChange={(event) => setDiscount(event.target.value)} className={fieldClass} />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Late fee</label>
                        <input type="number" min="0" step="1" value={lateFee} onChange={(event) => setLateFee(event.target.value)} className={fieldClass} />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Invoice date</label>
                        <input type="date" required value={issuedOn} onChange={(event) => setIssuedOn(event.target.value)} className={fieldClass} />
                    </div>
                    <div>
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Due date</label>
                        <input type="date" required min={issuedOn} value={dueOn} onChange={(event) => setDueOn(event.target.value)} className={fieldClass} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
                        <input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={255} className={fieldClass} placeholder="Optional note for this invoice" />
                    </div>
                </div>
                <div className="flex flex-col gap-3 rounded-xl bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm text-slate-600">Total due <span className="ml-2 text-xl font-bold text-slate-900">{money(total)}</span></div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className={softButtonClass}>Cancel</button>
                        <button type="submit" className={buttonClass} disabled={saving || total < 1}>
                            {saving ? 'Saving…' : invoice ? 'Save changes' : 'Issue invoice'}
                        </button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}

function InvoiceDocument({ invoice, currency }: { invoice: InvoiceRow; currency: string }) {
    return (
        <article className="mx-auto max-w-3xl bg-white p-8 text-slate-900">
            <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Student fee invoice</p>
                    <h1 className="mt-2 text-2xl font-bold">{invoice.number}</h1>
                    <p className="mt-1 text-sm text-slate-500">Issued {invoice.issued_on} · Due {invoice.due_on}</p>
                </div>
                <StatusBadge status={invoice.display_status} />
            </div>
            <div className="grid gap-6 py-6 sm:grid-cols-2">
                <div><p className="text-xs uppercase tracking-wide text-slate-500">Student</p><p className="mt-1 font-semibold">{invoice.student?.first_name} {invoice.student?.last_name}</p><p className="text-sm text-slate-600">Admission #{invoice.student?.admission_number}</p></div>
                <div><p className="text-xs uppercase tracking-wide text-slate-500">Class / academic year</p><p className="mt-1 font-semibold">{invoice.school_class?.name ?? '—'}</p><p className="text-sm text-slate-600">{invoice.academic_session?.name ?? '—'}</p></div>
            </div>
            <div className="border-y border-slate-200 py-4">
                <div className="flex justify-between py-2 text-sm"><span>{invoice.description || invoice.fee_category?.name || 'Fee subtotal'}</span><span>{money(invoice.base_amount || invoice.amount, currency)}</span></div>
                {invoice.discount_amount > 0 && <div className="flex justify-between py-2 text-sm text-emerald-700"><span>Discount</span><span>−{money(invoice.discount_amount, currency)}</span></div>}
                {invoice.late_fee_amount > 0 && <div className="flex justify-between py-2 text-sm"><span>Late fee</span><span>{money(invoice.late_fee_amount, currency)}</span></div>}
                <div className="mt-2 flex justify-between border-t border-slate-100 pt-4 font-semibold"><span>Total invoice amount</span><span>{money(invoice.amount, currency)}</span></div>
                <div className="flex justify-between py-2 text-sm text-emerald-700"><span>Paid to date</span><span>{money(invoice.paid_amount, currency)}</span></div>
                <div className="flex justify-between py-2 text-lg font-bold"><span>Balance due</span><span>{money(invoice.balance_due, currency)}</span></div>
            </div>
            <p className="mt-8 text-xs text-slate-500">Please retain this invoice for your records. Contact the institution accounts office for payment assistance.</p>
        </article>
    );
}

export function InvoicesPage() {
    const [result, setResult] = useState<PageResult<InvoiceRow> | null>(null);
    const [lookups, setLookups] = useState<FinanceLookups | null>(null);
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState('');
    const [classId, setClassId] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [page, setPage] = useState(1);
    const [reload, setReload] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [editing, setEditing] = useState<InvoiceRow | null | undefined>(undefined);
    const [detail, setDetail] = useState<InvoiceRow | null>(null);
    const [cancelTarget, setCancelTarget] = useState<InvoiceRow | null>(null);
    const [cancelReason, setCancelReason] = useState('');
    const [printing, setPrinting] = useState<InvoiceRow | null>(null);
    const { user } = useWorkspaceAuth();
    const canManage = user?.permissions.includes('finance.manage') ?? false;

    useEffect(() => {
        api.get<{ data: FinanceLookups }>('/api/institution/finance/lookups')
            .then(({ data }) => setLookups(data.data))
            .catch((reason: unknown) => setError(getErrorMessage(reason, 'Unable to load invoice options.')));
    }, []);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError(null);
        api.get<PageResult<InvoiceRow>>('/api/institution/invoices', {
            params: {
                search: search || undefined,
                status: status || undefined,
                school_class_id: classId || undefined,
                academic_session_id: sessionId || undefined,
                page,
                per_page: 15,
            },
        })
            .then(({ data }) => {
                if (active) setResult(data);
            })
            .catch((reason: unknown) => {
                if (active) setError(getErrorMessage(reason, 'Unable to load invoices.'));
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, [search, status, classId, sessionId, page, reload]);

    useEffect(() => {
        if (!printing) return;
        const timer = window.setTimeout(() => {
            window.print();
            setPrinting(null);
        }, 200);
        return () => window.clearTimeout(timer);
    }, [printing]);

    async function openDetail(invoice: InvoiceRow) {
        try {
            const { data } = await api.get<{ data: InvoiceRow }>(`/api/institution/invoices/${invoice.id}`);
            setDetail(data.data);
        } catch (reason: unknown) {
            setError(getErrorMessage(reason, 'Unable to open the invoice.'));
        }
    }

    async function cancelInvoice() {
        if (!cancelTarget) return;
        try {
            await api.post(`/api/institution/invoices/${cancelTarget.id}/cancel`, { reason: cancelReason });
            setCancelTarget(null);
            setCancelReason('');
            setNotice('Invoice cancelled and the ledger entry reversed.');
            setReload((value) => value + 1);
        } catch (reason: unknown) {
            setError(getErrorMessage(reason, 'Unable to cancel the invoice.'));
        }
    }

    return (
        <>
            <section className="space-y-5 print:hidden">
                <PageHeading
                    title="Invoices"
                    detail="Create, track and reconcile student fee invoices. Invoice balances stay in sync with collected payments."
                    action={canManage ? <button type="button" onClick={() => setEditing(null)} className={buttonClass}><Plus className="size-4" /> New invoice</button> : undefined}
                />
                {error && <Notice tone="error">{error}</Notice>}
                {notice && <Notice tone="success" onDismiss={() => setNotice(null)}>{notice}</Notice>}
                <div className="grid gap-3 sm:grid-cols-3">
                    <SummaryCard label="Invoices in view" value={String(result?.total ?? '—')} note="Matching your current filters" icon={Receipt} />
                    <SummaryCard label="Outstanding balance" value={money(result?.data.reduce((sum, invoice) => sum + invoice.balance_due, 0) ?? 0)} note="Current page total" icon={CircleDollarSign} tone="amber" />
                    <SummaryCard label="Overdue invoices" value={String(result?.data.filter((invoice) => invoice.display_status === 'overdue').length ?? '—')} note="Current page" icon={CalendarDays} tone="rose" />
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                    <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_180px_180px_180px]">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" />
                            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className={`${fieldClass} pl-9`} placeholder="Search invoice, student or admission #" />
                        </div>
                        <select aria-label="Invoice status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className={fieldClass}>
                            <option value="">All statuses</option><option value="unpaid">Unpaid</option><option value="partial">Partially paid</option><option value="overdue">Overdue</option><option value="paid">Paid</option><option value="cancelled">Cancelled</option>
                        </select>
                        <select aria-label="Filter by class" value={classId} onChange={(event) => { setClassId(event.target.value); setPage(1); }} className={fieldClass}>
                            <option value="">All classes</option>{lookups?.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                        <select aria-label="Filter by academic year" value={sessionId} onChange={(event) => { setSessionId(event.target.value); setPage(1); }} className={fieldClass}>
                            <option value="">All academic years</option>{lookups?.academic_sessions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                    </div>
                </div>
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    {loading ? <LoadingPanel label="Loading invoices…" /> : result?.data.length ? (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[980px] text-left text-sm">
                                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                                        <tr><th className="px-4 py-3 font-semibold">Invoice / student</th><th className="px-4 py-3 font-semibold">Class / year</th><th className="px-4 py-3 font-semibold">Total</th><th className="px-4 py-3 font-semibold">Paid / balance</th><th className="px-4 py-3 font-semibold">Due date</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 text-right font-semibold">Actions</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {result.data.map((invoice) => (
                                            <tr key={invoice.id} className="transition hover:bg-slate-50/80">
                                                <td className="px-4 py-3.5"><p className="font-semibold text-slate-900">{invoice.number}</p><p className="mt-0.5 text-slate-500">{invoice.student?.first_name} {invoice.student?.last_name} · {invoice.student?.admission_number}</p><p className="text-xs text-slate-400">{invoice.fee_category?.name ?? invoice.description ?? 'Student fees'}</p></td>
                                                <td className="px-4 py-3.5"><p className="text-slate-800">{invoice.school_class?.name ?? '—'}</p><p className="text-xs text-slate-500">{invoice.academic_session?.name ?? '—'}</p></td>
                                                <td className="px-4 py-3.5 font-semibold text-slate-900">{money(invoice.amount)}</td>
                                                <td className="px-4 py-3.5"><p className="text-slate-700">{money(invoice.paid_amount)} paid</p><p className="text-xs font-semibold text-amber-700">{money(invoice.balance_due)} due</p></td>
                                                <td className="px-4 py-3.5 text-slate-600">{invoice.due_on}</td>
                                                <td className="px-4 py-3.5"><StatusBadge status={invoice.display_status} /></td>
                                                <td className="px-4 py-3.5"><div className="flex justify-end gap-1">
                                                    <button type="button" onClick={() => void openDetail(invoice)} title="View invoice" className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700"><Eye className="size-4" /></button>
                                                    <button type="button" onClick={() => setPrinting(invoice)} title="Print or save as PDF" className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700"><Printer className="size-4" /></button>
                                                    {canManage && invoice.paid_amount === 0 && invoice.display_status !== 'cancelled' && <>
                                                        <button type="button" onClick={() => setEditing(invoice)} title="Edit invoice" className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700"><Pencil className="size-4" /></button>
                                                        <button type="button" onClick={() => setCancelTarget(invoice)} title="Cancel invoice" className="rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700"><X className="size-4" /></button>
                                                    </>}
                                                </div></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <Pagination page={result.current_page} lastPage={result.last_page} total={result.total} onChange={setPage} />
                        </>
                    ) : <EmptyState title="No invoices found" detail="Try changing the search or filters, or create a new invoice." />}
                </div>
            </section>
            {editing !== undefined && <InvoiceForm invoice={editing} lookups={lookups} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); setNotice(editing ? 'Invoice updated and ledger adjusted.' : 'Invoice issued successfully.'); setReload((value) => value + 1); }} />}
            {detail && <Modal title={`Invoice details · ${detail.number}`} onClose={() => setDetail(null)} wide>
                <InvoiceDocument invoice={detail} currency="NPR" />
                {detail.payments && detail.payments.length > 0 && <div className="mt-4 border-t border-slate-100 pt-4"><h3 className="mb-2 text-sm font-semibold text-slate-800">Payment history</h3>{detail.payments.map((payment) => <div key={payment.id} className="flex justify-between border-b border-slate-100 py-2 text-sm last:border-0"><span>{payment.receipt_number} · {payment.method} · {payment.paid_on}</span><span>{money(payment.amount)}</span></div>)}</div>}
                <div className="mt-4 flex justify-end"><button type="button" onClick={() => { setDetail(null); setPrinting(detail); }} className={softButtonClass}><Printer className="size-4" /> Print / Save PDF</button></div>
            </Modal>}
            {cancelTarget && <Modal title={`Cancel ${cancelTarget.number}`} onClose={() => { setCancelTarget(null); setCancelReason(''); }}>
                <p className="mb-3 text-sm text-slate-600">This reverses the invoice ledger entry. A cancelled invoice cannot receive payments.</p>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Reason</label>
                <textarea value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" maxLength={255} required />
                <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setCancelTarget(null)} className={softButtonClass}>Keep invoice</button><button type="button" onClick={() => void cancelInvoice()} disabled={!cancelReason.trim()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">Cancel invoice</button></div>
            </Modal>}
            {printing && <div className="hidden print:block"><InvoiceDocument invoice={printing} currency="NPR" /></div>}
        </>
    );
}

interface CollectionStudent extends StudentOption {
    invoices: Array<{
        id: number;
        number: string;
        description: string | null;
        fee_name?: string | null;
        amount: number;
        paid_amount: number;
        balance_due: number;
        due_on: string;
        display_status: string;
    }>;
}

function ReceiptDocument({ payment }: { payment: PaymentRow }) {
    return (
        <article className="mx-auto max-w-2xl bg-white p-8 text-slate-900">
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-5">
                <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Payment receipt</p><h1 className="mt-2 text-2xl font-bold">{payment.receipt_number}</h1></div>
                <CheckCircle2 className="size-8 text-emerald-600" />
            </div>
            <div className="grid gap-5 py-6 sm:grid-cols-2">
                <div><p className="text-xs uppercase tracking-wide text-slate-500">Student</p><p className="mt-1 font-semibold">{payment.invoice?.student?.first_name} {payment.invoice?.student?.last_name}</p><p className="text-sm text-slate-600">Admission #{payment.invoice?.student?.admission_number}</p></div>
                <div><p className="text-xs uppercase tracking-wide text-slate-500">Invoice</p><p className="mt-1 font-semibold">{payment.invoice?.number}</p><p className="text-sm text-slate-600">{payment.paid_on}</p></div>
                <div><p className="text-xs uppercase tracking-wide text-slate-500">Payment method</p><p className="mt-1 font-semibold capitalize">{payment.method.replaceAll('_', ' ')}</p><p className="text-sm text-slate-600">{payment.transaction_id ? `Transaction ${payment.transaction_id}` : 'No external transaction reference'}</p></div>
                <div><p className="text-xs uppercase tracking-wide text-slate-500">Received amount</p><p className="mt-1 text-2xl font-bold">{money(payment.amount)}</p></div>
            </div>
            <p className="border-t border-slate-200 pt-4 text-xs text-slate-500">This receipt confirms a recorded fee payment. Retain it for your records.</p>
        </article>
    );
}

export function FeeCollectionPage() {
    const location = useLocation();
    const initialSearch = (location.state as { search?: string } | null)?.search ?? '';
    const [query, setQuery] = useState(initialSearch);
    const [students, setStudents] = useState<CollectionStudent[]>([]);
    const [selected, setSelected] = useState<CollectionStudent | null>(null);
    const [methods, setMethods] = useState<FinanceLookups['payment_methods']>([]);
    const [invoiceId, setInvoiceId] = useState('');
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('');
    const [transactionId, setTransactionId] = useState('');
    const [paidOn, setPaidOn] = useState(todayString());
    const [loading, setLoading] = useState(false);
    const [collecting, setCollecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [receipt, setReceipt] = useState<PaymentRow | null>(null);
    const idempotencyKey = useRef<string>(crypto.randomUUID());

    useEffect(() => {
        api.get<{ data: FinanceLookups['payment_methods'] }>('/api/institution/payment-methods')
            .then(({ data }) => {
                const availableMethods = data.data.filter((item) => item.enabled !== false && item.is_active !== false);
                setMethods(availableMethods);
                setMethod(availableMethods[0]?.code ?? 'cash');
            })
            .catch((reason: unknown) => setError(getErrorMessage(reason, 'Unable to load payment methods.')));
    }, []);

    useEffect(() => {
        if (query.trim().length < 2) {
            setStudents([]);
            return;
        }
        let active = true;
        const timer = window.setTimeout(() => {
            setLoading(true);
            api.get<{ data: CollectionStudent[] }>('/api/institution/finance/students', { params: { search: query } })
                .then(({ data }) => {
                    if (active) setStudents(data.data);
                })
                .catch((reason: unknown) => {
                    if (active) setError(getErrorMessage(reason, 'Unable to search students.'));
                })
                .finally(() => {
                    if (active) setLoading(false);
                });
        }, 250);
        return () => { active = false; window.clearTimeout(timer); };
    }, [query]);

    useEffect(() => {
        if (!receipt) return;
        const timer = window.setTimeout(() => {
            window.print();
            setReceipt(null);
        }, 200);
        return () => window.clearTimeout(timer);
    }, [receipt]);

    function chooseInvoice(id: string) {
        setInvoiceId(id);
        const invoice = selected?.invoices.find((row) => String(row.id) === id);
        setAmount(invoice ? String(invoice.balance_due) : '');
    }

    async function collect(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!selected || !invoiceId) {
            setError('Select a student and invoice first.');
            return;
        }
        setCollecting(true);
        setError(null);
        try {
            const { data } = await api.post<{ data: PaymentRow }>(`/api/institution/invoices/${invoiceId}/payments`, {
                amount: Number(amount),
                paid_on: paidOn,
                method,
                transaction_id: transactionId.trim() || null,
                idempotency_key: idempotencyKey.current,
            });
            const payment = data.data;
            setReceipt(payment);
            setNotice(`Payment posted successfully. Receipt ${payment.receipt_number} is ready.`);
            idempotencyKey.current = crypto.randomUUID();
            setInvoiceId('');
            setAmount('');
            setTransactionId('');
            setSelected(null);
            setQuery('');
        } catch (reason: unknown) {
            setError(getErrorMessage(reason, 'Unable to collect this payment.'));
        } finally {
            setCollecting(false);
        }
    }

    return (
        <>
            <section className="space-y-5 print:hidden">
                <PageHeading title="Fee collection" detail="Find a student, review open invoices and record a full or partial payment with an automatic receipt." />
                {error && <Notice tone="error">{error}</Notice>}
                {notice && <Notice tone="success" onDismiss={() => setNotice(null)}>{notice}</Notice>}
                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)]">
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <div className="mb-4 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><Search className="size-5" /></span><div><h2 className="font-semibold text-slate-900">Find student</h2><p className="text-sm text-slate-500">Search by name or admission number</p></div></div>
                            <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" /><input value={query} onChange={(event) => { setQuery(event.target.value); setSelected(null); }} className={`${fieldClass} pl-9`} placeholder="e.g. Asha Rai or ADM-1024" /></div>
                            {loading && <p className="mt-3 text-sm text-slate-500">Searching students…</p>}
                            {!loading && query.trim().length >= 2 && !selected && (
                                <div className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100">
                                    {students.length ? students.map((student) => (
                                        <button type="button" key={student.id} onClick={() => setSelected(student)} className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition hover:bg-blue-50">
                                            <span><span className="block font-medium text-slate-800">{student.name}</span><span className="text-xs text-slate-500">{student.admission_number} · {student.class ?? 'No class'}</span></span>
                                            <span className="text-xs font-semibold text-blue-700">{student.invoices.length} open</span>
                                        </button>
                                    )) : <p className="px-3 py-4 text-sm text-slate-500">No students with outstanding invoices match that search.</p>}
                                </div>
                            )}
                        </div>
                        {selected && (
                            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5">
                                <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Selected student</p><h2 className="mt-1 text-lg font-bold text-slate-900">{selected.name}</h2><p className="text-sm text-slate-600">{selected.admission_number} · {selected.class ?? 'No class assigned'}</p></div><button type="button" onClick={() => setSelected(null)} className="rounded-lg p-2 text-slate-500 hover:bg-white" aria-label="Clear selected student"><X className="size-4" /></button></div>
                                <div className="mt-4 space-y-2">
                                    {selected.invoices.map((invoice) => (
                                        <button type="button" key={invoice.id} onClick={() => chooseInvoice(String(invoice.id))} className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition ${invoiceId === String(invoice.id) ? 'border-blue-500 bg-white ring-2 ring-blue-100' : 'border-white bg-white/70 hover:border-blue-200'}`}>
                                            <span><span className="block text-sm font-semibold text-slate-800">{invoice.number} · {invoice.fee_name ?? invoice.description ?? 'Student fees'}</span><span className="text-xs text-slate-500">Due {invoice.due_on} · {money(invoice.paid_amount)} paid</span></span>
                                            <span className="text-right"><span className="block font-bold text-slate-900">{money(invoice.balance_due)}</span><StatusBadge status={invoice.display_status} /></span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Wallet className="size-5" /></span><div><h2 className="font-semibold text-slate-900">Record payment</h2><p className="text-sm text-slate-500">Receipt is generated after posting</p></div></div>
                        <form onSubmit={(event) => void collect(event)} className="space-y-4">
                            <div><label className="mb-1.5 block text-sm font-medium text-slate-700">Invoice</label><select value={invoiceId} onChange={(event) => chooseInvoice(event.target.value)} className={fieldClass} required disabled={!selected}><option value="">Choose an outstanding invoice</option>{selected?.invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.number} · balance {money(invoice.balance_due)}</option>)}</select></div>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div><label className="mb-1.5 block text-sm font-medium text-slate-700">Amount</label><input value={amount} onChange={(event) => setAmount(event.target.value)} min="1" max={selected?.invoices.find((invoice) => String(invoice.id) === invoiceId)?.balance_due} step="1" type="number" required className={fieldClass} disabled={!invoiceId} /></div>
                                <div><label className="mb-1.5 block text-sm font-medium text-slate-700">Payment date</label><input value={paidOn} onChange={(event) => setPaidOn(event.target.value)} type="date" required className={fieldClass} /></div>
                            </div>
                            <div><label className="mb-1.5 block text-sm font-medium text-slate-700">Payment method</label><select value={method} onChange={(event) => setMethod(event.target.value)} className={fieldClass} required>{methods.map((item) => <option key={item.id} value={item.code}>{item.name}</option>)}</select>{methods.find((item) => item.code === method)?.instructions && <p className="mt-1.5 text-xs text-slate-500">{methods.find((item) => item.code === method)?.instructions}</p>}</div>
                            {method !== 'cash' && <div><label className="mb-1.5 block text-sm font-medium text-slate-700">Transaction ID <span className="font-normal text-slate-400">optional</span></label><input value={transactionId} onChange={(event) => setTransactionId(event.target.value)} maxLength={120} className={fieldClass} placeholder="Bank / wallet reference" /></div>}
                            <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">Payments are recorded once using a unique request key. Duplicate transaction IDs are rejected to protect the ledger.</div>
                            <button type="submit" className={`${buttonClass} w-full`} disabled={collecting || !invoiceId || Number(amount) < 1}><CreditCard className="size-4" />{collecting ? 'Posting payment…' : 'Collect payment & issue receipt'}</button>
                        </form>
                    </div>
                </div>
            </section>
            {receipt && <div className="hidden print:block"><ReceiptDocument payment={receipt} /></div>}
        </>
    );
}

export function PaymentsPage() {
    const [result, setResult] = useState<PageResult<PaymentRow> | null>(null);
    const [search, setSearch] = useState('');
    const [method, setMethod] = useState('');
    const [status, setStatus] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [page, setPage] = useState(1);
    const [reload, setReload] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [detail, setDetail] = useState<PaymentRow | null>(null);
    const [reverseTarget, setReverseTarget] = useState<PaymentRow | null>(null);
    const [reason, setReason] = useState('');
    const [printing, setPrinting] = useState<PaymentRow | null>(null);
    const [methods, setMethods] = useState<FinanceLookups['payment_methods']>([]);
    const { user } = useWorkspaceAuth();
    const canManage = user?.permissions.includes('finance.manage') ?? false;

    useEffect(() => {
        api.get<{ data: FinanceLookups['payment_methods'] }>('/api/institution/payment-methods').then(({ data }) => setMethods(data.data)).catch(() => undefined);
    }, []);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError(null);
        api.get<PageResult<PaymentRow>>('/api/institution/payments', { params: { search: search || undefined, method: method || undefined, status: status || undefined, from: from || undefined, to: to || undefined, page, per_page: 15 } })
            .then(({ data }) => { if (active) setResult(data); })
            .catch((requestError: unknown) => { if (active) setError(getErrorMessage(requestError, 'Unable to load payment history.')); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [search, method, status, from, to, page, reload]);

    useEffect(() => {
        if (!printing) return;
        const timer = window.setTimeout(() => { window.print(); setPrinting(null); }, 200);
        return () => window.clearTimeout(timer);
    }, [printing]);

    async function verify(payment: PaymentRow) {
        try {
            await api.post(`/api/institution/payments/${payment.id}/verify`);
            setNotice(`${payment.receipt_number} verified.`);
            setReload((value) => value + 1);
        } catch (requestError: unknown) {
            setError(getErrorMessage(requestError, 'Unable to verify payment.'));
        }
    }

    async function reverse() {
        if (!reverseTarget) return;
        try {
            await api.post(`/api/institution/payments/${reverseTarget.id}/reverse`, { reason });
            setNotice(`${reverseTarget.receipt_number} reversed and the invoice balance restored.`);
            setReverseTarget(null);
            setReason('');
            setReload((value) => value + 1);
        } catch (requestError: unknown) {
            setError(getErrorMessage(requestError, 'Unable to reverse payment.'));
        }
    }

    async function openPayment(payment: PaymentRow) {
        try {
            const { data } = await api.get<{ data: PaymentRow }>(`/api/institution/payments/${payment.id}`);
            setDetail(data.data);
        } catch (requestError: unknown) {
            setError(getErrorMessage(requestError, 'Unable to open payment details.'));
        }
    }

    return (
        <>
            <section className="space-y-5 print:hidden">
                <PageHeading title="Payments" detail="Audit every receipt, verify transaction references and manage authorized reversals." action={<Link to="/fee-collection" className={buttonClass}><Plus className="size-4" /> Collect fee</Link>} />
                {error && <Notice tone="error">{error}</Notice>}
                {notice && <Notice tone="success" onDismiss={() => setNotice(null)}>{notice}</Notice>}
                <div className="grid gap-3 sm:grid-cols-3">
                    <SummaryCard label="Transactions" value={String(result?.total ?? '—')} note="Matching your current filters" icon={CreditCard} />
                    <SummaryCard label="Recorded amount" value={money(result?.data.filter((item) => item.status === 'posted').reduce((sum, item) => sum + item.amount, 0) ?? 0)} note="Current page · posted payments" icon={CircleDollarSign} tone="teal" />
                    <SummaryCard label="Needs verification" value={String(result?.data.filter((item) => item.status === 'posted' && !item.verified_at).length ?? '—')} note="Current page" icon={ShieldCheck} tone="amber" />
                </div>
                <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_180px_160px_160px_180px] sm:p-4">
                    <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className={`${fieldClass} pl-9`} placeholder="Receipt, student, invoice or transaction ID" /></div>
                    <select aria-label="Filter payment method" value={method} onChange={(event) => { setMethod(event.target.value); setPage(1); }} className={fieldClass}><option value="">All payment methods</option>{methods.map((item) => <option key={item.id} value={item.code}>{item.name}</option>)}</select>
                    <select aria-label="Filter payment status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className={fieldClass}><option value="">All statuses</option><option value="posted">Posted</option><option value="reversed">Reversed</option></select>
                    <input aria-label="Payments from date" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} className={fieldClass} />
                    <input aria-label="Payments to date" type="date" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setPage(1); }} className={fieldClass} />
                </div>
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    {loading ? <LoadingPanel label="Loading payments…" /> : result?.data.length ? <>
                        <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm">
                            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-semibold">Payment ID</th><th className="px-4 py-3 font-semibold">Receipt / student</th><th className="px-4 py-3 font-semibold">Invoice</th><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Method / transaction</th><th className="px-4 py-3 font-semibold">Amount</th><th className="px-4 py-3 font-semibold">Verification</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 text-right font-semibold">Actions</th></tr></thead>
                            <tbody className="divide-y divide-slate-100">{result.data.map((payment) => <tr key={payment.id} className="hover:bg-slate-50/80">
                                <td className="px-4 py-3.5 font-mono text-xs text-slate-500">PAY-{payment.id}</td>
                                <td className="px-4 py-3.5"><p className="font-semibold text-slate-900">{payment.receipt_number}</p><p className="text-slate-500">{payment.invoice?.student?.first_name} {payment.invoice?.student?.last_name}</p><p className="text-xs text-slate-400">{payment.invoice?.student?.admission_number}</p></td>
                                <td className="px-4 py-3.5 text-slate-700">{payment.invoice?.number ?? '—'}</td>
                                <td className="px-4 py-3.5 text-slate-600">{payment.paid_on}</td>
                                <td className="px-4 py-3.5"><p className="capitalize text-slate-700">{payment.method.replaceAll('_', ' ')}</p><p className="max-w-44 truncate text-xs text-slate-500">{payment.transaction_id || '—'}</p></td>
                                <td className="px-4 py-3.5 font-semibold text-slate-900">{money(payment.amount)}</td>
                                <td className="px-4 py-3.5">{payment.verified_at ? <span className="text-xs font-medium text-teal-700">Verified{payment.verifier?.name ? ` · ${payment.verifier.name}` : ''}</span> : <span className="text-xs text-amber-700">Pending review</span>}</td>
                                <td className="px-4 py-3.5"><StatusBadge status={payment.status} /></td>
                                <td className="px-4 py-3.5"><div className="flex justify-end gap-1">
                                    <button type="button" onClick={() => void openPayment(payment)} title="View receipt" className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700"><Eye className="size-4" /></button>
                                    <button type="button" onClick={() => setPrinting(payment)} title="Print or save receipt as PDF" className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700"><Printer className="size-4" /></button>
                                    {canManage && payment.status === 'posted' && <>
                                        {!payment.verified_at && <button type="button" onClick={() => void verify(payment)} title="Verify transaction" className="rounded-lg p-2 text-teal-600 hover:bg-teal-50"><ShieldCheck className="size-4" /></button>}
                                        <button type="button" onClick={() => setReverseTarget(payment)} title="Reverse payment" className="rounded-lg p-2 text-rose-600 hover:bg-rose-50"><RotateCcw className="size-4" /></button>
                                    </>}
                                </div></td>
                            </tr>)}</tbody>
                        </table></div>
                        <Pagination page={result.current_page} lastPage={result.last_page} total={result.total} onChange={setPage} />
                    </> : <EmptyState title="No payments found" detail="Payments will appear here as soon as fee collections are posted." />}
                </div>
            </section>
            {detail && <Modal title={`Receipt details · ${detail.receipt_number}`} onClose={() => setDetail(null)}><ReceiptDocument payment={detail} /><div className="mt-4 flex justify-end"><button type="button" onClick={() => { setDetail(null); setPrinting(detail); }} className={softButtonClass}><Printer className="size-4" /> Print / Save PDF</button></div></Modal>}
            {reverseTarget && <Modal title={`Reverse ${reverseTarget.receipt_number}`} onClose={() => { setReverseTarget(null); setReason(''); }}>
                <p className="mb-3 text-sm text-slate-600">The payment will be marked reversed and its amount restored to the invoice balance. This action is recorded in the audit trail.</p>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Reason for reversal</label>
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={255} required className="min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100" />
                <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setReverseTarget(null)} className={softButtonClass}>Keep payment</button><button type="button" onClick={() => void reverse()} disabled={!reason.trim()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"><RotateCcw className="size-4" /> Reverse payment</button></div>
            </Modal>}
            {printing && <div className="hidden print:block"><ReceiptDocument payment={printing} /></div>}
        </>
    );
}

export function OutstandingFeesPage() {
    const [result, setResult] = useState<PageResult<InvoiceRow> | null>(null);
    const [lookups, setLookups] = useState<FinanceLookups | null>(null);
    const [search, setSearch] = useState('');
    const [classId, setClassId] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [overdue, setOverdue] = useState('');
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    useEffect(() => {
        api.get<{ data: FinanceLookups }>('/api/institution/finance/lookups').then(({ data }) => setLookups(data.data)).catch((reason: unknown) => setError(getErrorMessage(reason, 'Unable to load filters.')));
    }, []);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError(null);
        api.get<PageResult<InvoiceRow>>('/api/institution/outstanding-fees', {
            params: { search: search || undefined, school_class_id: classId || undefined, academic_session_id: sessionId || undefined, overdue: overdue || undefined, page, per_page: 15 },
        })
            .then(({ data }) => { if (active) setResult(data); })
            .catch((reason: unknown) => { if (active) setError(getErrorMessage(reason, 'Unable to load outstanding fees.')); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [search, classId, sessionId, overdue, page]);

    async function sendReminder(invoice: InvoiceRow) {
        try {
            const { data } = await api.post<{ message: string }>(`/api/institution/outstanding-fees/${invoice.id}/reminders`);
            setNotice(data.message);
        } catch (reason: unknown) {
            setError(getErrorMessage(reason, 'Unable to send fee reminder.'));
        }
    }

    const summary = result?.summary;

    return (
        <section className="space-y-5">
            <PageHeading title="Outstanding fees" detail="Monitor unpaid and partially paid invoices, identify overdue balances and send guardian reminders." action={<Link to="/fee-collection" className={buttonClass}><Plus className="size-4" /> Collect fee</Link>} />
            {error && <Notice tone="error">{error}</Notice>}
            {notice && <Notice tone="success" onDismiss={() => setNotice(null)}>{notice}</Notice>}
            <div className="grid gap-3 sm:grid-cols-3">
                <SummaryCard label="Open invoices" value={String(summary?.count ?? '—')} note="Current filters" icon={Receipt} />
                <SummaryCard label="Balance outstanding" value={money(summary?.balance_due ?? 0)} note="Across matching invoices" icon={CircleDollarSign} tone="amber" />
                <SummaryCard label="Overdue invoices" value={String(summary?.overdue_count ?? '—')} note="Due date has passed" icon={CalendarDays} tone="rose" />
            </div>
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[minmax(220px,1fr)_180px_200px_180px] sm:p-4">
                <div className="relative"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} className={`${fieldClass} pl-9`} placeholder="Search student or admission number" /></div>
                <select aria-label="Filter outstanding fees by class" value={classId} onChange={(event) => { setClassId(event.target.value); setPage(1); }} className={fieldClass}><option value="">All classes</option>{lookups?.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                <select aria-label="Filter outstanding fees by academic year" value={sessionId} onChange={(event) => { setSessionId(event.target.value); setPage(1); }} className={fieldClass}><option value="">All academic years</option>{lookups?.academic_sessions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                <select aria-label="Filter overdue status" value={overdue} onChange={(event) => { setOverdue(event.target.value); setPage(1); }} className={fieldClass}><option value="">All due dates</option><option value="1">Overdue only</option><option value="0">Not overdue</option></select>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {loading ? <LoadingPanel label="Loading outstanding invoices…" /> : result?.data.length ? <>
                    <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-semibold">Student</th><th className="px-4 py-3 font-semibold">Class</th><th className="px-4 py-3 font-semibold">Invoice amount</th><th className="px-4 py-3 font-semibold">Paid</th><th className="px-4 py-3 font-semibold">Balance</th><th className="px-4 py-3 font-semibold">Due date</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 text-right font-semibold">Actions</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">{result.data.map((invoice) => <tr key={invoice.id} className="hover:bg-slate-50/80">
                            <td className="px-4 py-3.5"><p className="font-semibold text-slate-900">{invoice.student?.first_name} {invoice.student?.last_name}</p><p className="text-xs text-slate-500">{invoice.student?.admission_number} · {invoice.number}</p></td>
                            <td className="px-4 py-3.5 text-slate-700">{invoice.school_class?.name ?? '—'}</td>
                            <td className="px-4 py-3.5 text-slate-700">{money(invoice.amount)}</td>
                            <td className="px-4 py-3.5 text-slate-700">{money(invoice.paid_amount)}</td>
                            <td className="px-4 py-3.5 font-semibold text-amber-700">{money(invoice.balance_due)}</td>
                            <td className="px-4 py-3.5 text-slate-600">{invoice.due_on}</td>
                            <td className="px-4 py-3.5"><StatusBadge status={invoice.display_status} /></td>
                            <td className="px-4 py-3.5"><div className="flex justify-end gap-2"><Link to="/fee-collection" state={{ search: invoice.student?.admission_number }} className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"><Wallet className="size-3.5" /> Collect</Link><button type="button" onClick={() => void sendReminder(invoice)} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100" title="Email a fee reminder to the guardian"><Mail className="size-3.5" /> Remind</button></div></td>
                        </tr>)}</tbody>
                    </table></div>
                    <Pagination page={result.current_page} lastPage={result.last_page} total={result.total} onChange={setPage} />
                </> : <EmptyState title="All fees are up to date" detail="No unpaid or partially paid student invoices match these filters." />}
            </div>
        </section>
    );
}

interface ReportResponse {
    currency: string;
    period: 'day' | 'month' | 'year';
    from: string;
    to: string;
    summary: {
        collection_total: number;
        invoiced_total: number;
        paid_total: number;
        outstanding_total: number;
        invoice_count: number;
    };
    trend: Array<{ period: string; amount: number }>;
    payment_methods: Array<{ method: string; amount: number }>;
    class_collections: Array<{ name: string; amount: number }>;
    student_collections: Array<{ student_id: number; name: string; admission_number: string; amount: number }>;
    outstanding_count: number;
}

export function FinancialReportsPage() {
    const [report, setReport] = useState<ReportResponse | null>(null);
    const [lookups, setLookups] = useState<FinanceLookups | null>(null);
    const [period, setPeriod] = useState<'day' | 'month' | 'year'>('month');
    const [from, setFrom] = useState(startOfMonthString);
    const [to, setTo] = useState(todayString());
    const [classId, setClassId] = useState('');
    const [sessionId, setSessionId] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reload, setReload] = useState(0);

    useEffect(() => {
        api.get<{ data: FinanceLookups }>('/api/institution/finance/lookups').then(({ data }) => setLookups(data.data)).catch((reason: unknown) => setError(getErrorMessage(reason, 'Unable to load report filters.')));
    }, []);

    useEffect(() => {
        let active = true;
        setLoading(true);
        setError(null);
        api.get<{ data: ReportResponse }>('/api/institution/financial-reports', { params: { period, from, to, school_class_id: classId || undefined, academic_session_id: sessionId || undefined } })
            .then(({ data }) => { if (active) setReport(data.data); })
            .catch((reason: unknown) => { if (active) setError(getErrorMessage(reason, 'Unable to load financial reports.')); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [period, from, to, classId, sessionId, reload]);

    function exportCsv(kind: 'payments' | 'outstanding') {
        const params = new URLSearchParams({ report: kind });
        if (from) params.set('from', from);
        if (to) params.set('to', to);
        if (classId) params.set('school_class_id', classId);
        if (sessionId) params.set('academic_session_id', sessionId);
        window.location.assign(`/api/institution/financial-reports/export?${params.toString()}`);
    }

    const paidOutstanding = report ? [
        { name: 'Paid', amount: report.summary.paid_total },
        { name: 'Outstanding', amount: report.summary.outstanding_total },
    ] : [];
    const chartData = report?.trend.map((item) => ({ period: item.period, amount: Number(item.amount) })) ?? [];
    const methodData = report?.payment_methods.map((item) => ({ name: item.method.replaceAll('_', ' '), amount: Number(item.amount) })) ?? [];

    return (
        <section className="space-y-5 print:hidden">
            <PageHeading title="Financial reports" detail="Review collections, outstanding balances and payment trends using live invoice and payment records." action={<div className="flex gap-2"><button type="button" onClick={() => window.print()} className={softButtonClass}><Printer className="size-4" /> Print / PDF</button><button type="button" onClick={() => exportCsv('payments')} className={buttonClass}><Download className="size-4" /> Export CSV</button></div>} />
            {error && <Notice tone="error">{error}</Notice>}
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-5 sm:p-4">
                <select aria-label="Report period" value={period} onChange={(event) => setPeriod(event.target.value as 'day' | 'month' | 'year')} className={fieldClass}><option value="day">Daily</option><option value="month">Monthly</option><option value="year">Yearly</option></select>
                <input aria-label="Report start date" value={from} onChange={(event) => setFrom(event.target.value)} type="date" className={fieldClass} />
                <input aria-label="Report end date" value={to} onChange={(event) => setTo(event.target.value)} type="date" className={fieldClass} />
                <select aria-label="Report class filter" value={classId} onChange={(event) => setClassId(event.target.value)} className={fieldClass}><option value="">All classes</option>{lookups?.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
                <select aria-label="Report academic year filter" value={sessionId} onChange={(event) => setSessionId(event.target.value)} className={fieldClass}><option value="">All academic years</option>{lookups?.academic_sessions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            </div>
            {loading ? <LoadingPanel label="Calculating reports from live records…" /> : report && <>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard label="Collections" value={money(report.summary.collection_total, report.currency)} note={`${report.from} to ${report.to}`} icon={CircleDollarSign} tone="teal" />
                    <SummaryCard label="Invoices issued" value={money(report.summary.invoiced_total, report.currency)} note={`${report.summary.invoice_count} invoices in period`} icon={FileText} />
                    <SummaryCard label="Paid to date" value={money(report.summary.paid_total, report.currency)} note="Net of reversed payments" icon={CheckCircle2} tone="blue" />
                    <SummaryCard label="Outstanding" value={money(report.summary.outstanding_total, report.currency)} note={`${report.outstanding_count} open invoices`} icon={Wallet} tone="amber" />
                </div>
                <div className="grid gap-5 xl:grid-cols-[1.4fr_0.9fr]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-slate-900">Collection trend</h2><p className="text-xs text-slate-500">Posted payments grouped by {period}</p></div><button type="button" onClick={() => setReload((value) => value + 1)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Refresh reports"><RefreshCw className="size-4" /></button></div>
                        {chartData.length ? <div className="h-72"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}><defs><linearGradient id="collectionFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2563eb" stopOpacity={0.28} /><stop offset="100%" stopColor="#2563eb" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} /><XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} /><Tooltip formatter={(value) => money(Number(value), report.currency)} /><Area type="monotone" dataKey="amount" name="Collected" stroke="#2563eb" strokeWidth={3} fill="url(#collectionFill)" /></AreaChart></ResponsiveContainer></div> : <EmptyState title="No collections in this period" detail="Posted fee payments will appear in the trend chart." />}
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <h2 className="font-semibold text-slate-900">Paid vs outstanding</h2><p className="text-xs text-slate-500">Current invoice balances</p>
                        <div className="h-60">
                            <ResponsiveContainer width="100%" height="100%"><BarChart data={paidOutstanding} margin={{ top: 20, right: 8, left: -14, bottom: 0 }}><CartesianGrid stroke="#e2e8f0" strokeDasharray="4 4" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} /><YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} /><Tooltip formatter={(value) => money(Number(value), report.currency)} /><Bar dataKey="amount" name="Amount" radius={[8, 8, 0, 0]}>{paidOutstanding.map((item, index) => <Cell key={item.name} fill={index === 0 ? '#14b8a6' : '#f59e0b'} />)}</Bar></BarChart></ResponsiveContainer>
                        </div>
                    </div>
                </div>
                <div className="grid gap-5 xl:grid-cols-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-semibold text-slate-900">Payment methods</h2><p className="text-xs text-slate-500">Collection by method</p>{methodData.length ? <div className="h-60"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={methodData} dataKey="amount" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={3}>{methodData.map((item, index) => <Cell key={item.name} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip formatter={(value) => money(Number(value), report.currency)} /></PieChart></ResponsiveContainer></div> : <EmptyState title="No payment data" detail="Method totals appear after fee collection." />}{methodData.map((item, index) => <div key={item.name} className="flex items-center justify-between border-t border-slate-100 py-2 text-sm"><span className="flex items-center gap-2 capitalize text-slate-600"><span className="size-2.5 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />{item.name}</span><span className="font-medium text-slate-900">{money(item.amount, report.currency)}</span></div>)}</div>
                    <ReportList title="Class-wise collections" rows={report.class_collections.map((item) => ({ label: item.name, amount: item.amount }))} currency={report.currency} />
                    <ReportList title="Student-wise collections" rows={report.student_collections.map((item) => ({ label: `${item.name} · ${item.admission_number}`, amount: item.amount }))} currency={report.currency} />
                </div>
                <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div><p className="font-semibold text-slate-900">Download detailed data</p><p className="text-sm text-slate-500">CSV files open in spreadsheet apps such as Excel and contain the selected filters.</p></div>
                    <div className="flex flex-wrap gap-2"><button type="button" onClick={() => exportCsv('payments')} className={softButtonClass}><Download className="size-4" /> Collections CSV</button><button type="button" onClick={() => exportCsv('outstanding')} className={softButtonClass}><Download className="size-4" /> Outstanding CSV</button></div>
                </div>
            </>}
        </section>
    );
}

function ReportList({ title, rows, currency }: { title: string; rows: Array<{ label: string; amount: number }>; currency: string }) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-semibold text-slate-900">{title}</h2>
            <div className="mt-3 divide-y divide-slate-100">
                {rows.length ? rows.map((row) => <div key={row.label} className="flex items-center justify-between gap-3 py-2.5 text-sm"><span className="min-w-0 truncate text-slate-600">{row.label}</span><span className="shrink-0 font-semibold text-slate-900">{money(row.amount, currency)}</span></div>) : <p className="py-5 text-sm text-slate-500">No report data for this period.</p>}
            </div>
        </div>
    );
}
