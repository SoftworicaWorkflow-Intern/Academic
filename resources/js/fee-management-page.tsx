import React, { useEffect, useState, useMemo } from 'react';
import {
    AlertCircle,
    Award,
    Banknote,
    BookOpen,
    Building2,
    Calendar,
    Check,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    CreditCard,
    DollarSign,
    Edit3,
    Eye,
    Filter,
    Layers,
    Percent,
    Plus,
    RefreshCw,
    Search,
    ShieldAlert,
    Trash2,
    Users,
    Wallet,
    X,
} from 'lucide-react';
import { api, getErrorMessage } from './api';

// Types
export interface FeeCategoryRow {
    id: number;
    name: string;
    code: string;
    kind: string;
    billing_type: 'one_time' | 'recurring';
    default_amount: number;
    fine_amount: number;
    due_day: number | null;
    description: string | null;
    is_active: boolean;
    fee_structures_count?: number;
    created_at?: string;
}

export interface FeeStructureRow {
    id: number;
    name: string;
    amount: number;
    fee_category_id: number | null;
    academic_session_id: number | null;
    school_class_id: number | null;
    section_id: number | null;
    fee_type: 'compulsory' | 'optional';
    payment_schedule: 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | 'one_time';
    billing_type: 'one_time' | 'recurring';
    due_day: number | null;
    due_date: string | null;
    description: string | null;
    is_active: boolean;
    category?: { id: number; name: string; code: string; kind: string } | null;
    academic_session?: { id: number; name: string; code: string; status: string } | null;
    school_class?: { id: number; name: string; code: string } | null;
    section?: { id: number; name: string } | null;
    invoices_count?: number;
}

export interface ScholarshipRow {
    id: number;
    name: string;
    code: string | null;
    category: 'merit' | 'need_based' | 'sibling' | 'staff_child' | 'sports' | 'general';
    discount_type: 'percent' | 'fixed';
    value: number;
    eligibility_rules: string | null;
    is_active: boolean;
}

export interface LateFeeSettingRow {
    id?: number;
    enabled: boolean;
    penalty_type: 'fixed' | 'percentage';
    penalty_value: number;
    grace_days: number;
    penalty_start_date: string | null;
    description: string | null;
}

export interface PaymentMethodRow {
    id: number;
    name: string;
    code: string;
    enabled: boolean;
    instructions: string | null;
    account_details: string | null;
    is_active?: boolean;
}

export interface FeeSummary {
    total_categories: number;
    active_fee_structures: number;
    total_fee_structures: number;
    active_academic_years: number;
    total_scholarships: number;
    late_fees_enabled: boolean;
    currency: string;
}

interface DropdownItem {
    id: number;
    name: string;
    code?: string;
    status?: string;
    school_class_id?: number;
}

const KIND_LABELS: Record<string, string> = {
    admission: 'Admission Fee',
    tuition: 'Monthly Tuition Fee',
    examination: 'Examination Fee',
    library: 'Library Fee',
    transport: 'Transportation Fee',
    computer_lab: 'Computer Lab Fee',
    sports: 'Sports Fee',
    hostel: 'Hostel Fee',
    other: 'Other Fees',
    laboratory: 'Laboratory Fee',
    fine: 'Fine / Penalty',
};

const SCHEDULE_LABELS: Record<string, string> = {
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    half_yearly: 'Half-Yearly',
    yearly: 'Yearly',
    one_time: 'One Time',
};

const SCHOLARSHIP_CATEGORY_LABELS: Record<string, string> = {
    sibling: 'Sibling Discount',
    merit: 'Merit Scholarship',
    need_based: 'Need-based / Financial Aid',
    staff_child: 'Staff Child Benefit',
    sports: 'Sports Quota',
    general: 'General Discount',
};

export function FeeManagementPage() {
    const [activeTab, setActiveTab] = useState<'structures' | 'categories' | 'scholarships' | 'late_fees' | 'payment_methods'>('structures');
    const [summary, setSummary] = useState<FeeSummary | null>(null);
    const [loadingSummary, setLoadingSummary] = useState(true);

    // Global Notification
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Auxiliary options for selects
    const [academicSessions, setAcademicSessions] = useState<DropdownItem[]>([]);
    const [classes, setClasses] = useState<DropdownItem[]>([]);
    const [sections, setSections] = useState<DropdownItem[]>([]);
    const [categoriesList, setCategoriesList] = useState<FeeCategoryRow[]>([]);

    const currency = summary?.currency ?? 'NPR';

    function showNotice(type: 'success' | 'error', message: string) {
        setNotification({ type, message });
        setTimeout(() => setNotification((prev) => (prev?.message === message ? null : prev)), 5000);
    }

    async function loadSummary() {
        setLoadingSummary(true);
        try {
            const { data } = await api.get<{ data: FeeSummary }>('/api/institution/fee-summary');
            setSummary(data.data);
        } catch {
            // fallback
        } finally {
            setLoadingSummary(false);
        }
    }

    async function loadAuxiliaryData() {
        try {
            const [sessionsRes, classesRes, catRes] = await Promise.all([
                api.get<{ data: DropdownItem[] }>('/api/institution/academic-sessions'),
                api.get<{ data: DropdownItem[] }>('/api/institution/classes'),
                api.get<{ data: FeeCategoryRow[] }>('/api/institution/fee-categories', { params: { per_page: 100 } }),
            ]);

            setAcademicSessions(sessionsRes.data.data ?? []);
            setClasses(classesRes.data.data ?? []);
            setCategoriesList(catRes.data.data ?? []);
        } catch {
            // silent catch
        }
    }

    useEffect(() => {
        loadSummary();
        loadAuxiliaryData();
    }, []);

    // -------------------------------------------------------------
    // TAB 1: FEE STRUCTURES STATE & LOGIC
    // -------------------------------------------------------------
    const [structures, setStructures] = useState<FeeStructureRow[]>([]);
    const [structuresPagination, setStructuresPagination] = useState({ current_page: 1, last_page: 1, total: 0 });
    const [structuresLoading, setStructuresLoading] = useState(false);
    const [structureSearch, setStructureSearch] = useState('');
    const [structureFilterSession, setStructureFilterSession] = useState('');
    const [structureFilterClass, setStructureFilterClass] = useState('');
    const [structureFilterCategory, setStructureFilterCategory] = useState('');
    const [structureFilterType, setStructureFilterType] = useState('');
    const [structureFilterSchedule, setStructureFilterSchedule] = useState('');

    const [structureModalOpen, setStructureModalOpen] = useState(false);
    const [editingStructure, setEditingStructure] = useState<FeeStructureRow | null>(null);
    const [viewingStructure, setViewingStructure] = useState<FeeStructureRow | null>(null);
    const [structureDeleteTarget, setStructureDeleteTarget] = useState<FeeStructureRow | null>(null);

    const [structureForm, setStructureForm] = useState({
        name: '',
        amount: 0,
        fee_category_id: '',
        academic_session_id: '',
        school_class_id: '',
        section_id: '',
        fee_type: 'compulsory',
        payment_schedule: 'monthly',
        due_day: '',
        due_date: '',
        description: '',
        is_active: true,
    });

    async function loadStructures(page = 1) {
        setStructuresLoading(true);
        try {
            const params: Record<string, string | number> = { page, per_page: 12 };
            if (structureSearch) params.search = structureSearch;
            if (structureFilterSession) params.academic_session_id = structureFilterSession;
            if (structureFilterClass) params.school_class_id = structureFilterClass;
            if (structureFilterCategory) params.fee_category_id = structureFilterCategory;
            if (structureFilterType) params.fee_type = structureFilterType;
            if (structureFilterSchedule) params.payment_schedule = structureFilterSchedule;

            const { data } = await api.get<{ data: FeeStructureRow[]; current_page: number; last_page: number; total: number }>(
                '/api/institution/fee-structures',
                { params },
            );
            setStructures(data.data ?? []);
            setStructuresPagination({
                current_page: data.current_page ?? 1,
                last_page: data.last_page ?? 1,
                total: data.total ?? 0,
            });
        } catch (error: unknown) {
            showNotice('error', getErrorMessage(error, 'Unable to load fee structures.'));
        } finally {
            setStructuresLoading(false);
        }
    }

    useEffect(() => {
        if (activeTab === 'structures') {
            loadStructures(1);
        }
    }, [
        activeTab,
        structureSearch,
        structureFilterSession,
        structureFilterClass,
        structureFilterCategory,
        structureFilterType,
        structureFilterSchedule,
    ]);

    function openCreateStructure() {
        setEditingStructure(null);
        setStructureForm({
            name: '',
            amount: 0,
            fee_category_id: categoriesList[0]?.id ? String(categoriesList[0].id) : '',
            academic_session_id: academicSessions[0]?.id ? String(academicSessions[0].id) : '',
            school_class_id: '',
            section_id: '',
            fee_type: 'compulsory',
            payment_schedule: 'monthly',
            due_day: '10',
            due_date: '',
            description: '',
            is_active: true,
        });
        setStructureModalOpen(true);
    }

    function openEditStructure(item: FeeStructureRow) {
        setEditingStructure(item);
        setStructureForm({
            name: item.name,
            amount: item.amount,
            fee_category_id: item.fee_category_id ? String(item.fee_category_id) : '',
            academic_session_id: item.academic_session_id ? String(item.academic_session_id) : '',
            school_class_id: item.school_class_id ? String(item.school_class_id) : '',
            section_id: item.section_id ? String(item.section_id) : '',
            fee_type: item.fee_type,
            payment_schedule: item.payment_schedule,
            due_day: item.due_day ? String(item.due_day) : '',
            due_date: item.due_date ? item.due_date.slice(0, 10) : '',
            description: item.description ?? '',
            is_active: item.is_active,
        });
        setStructureModalOpen(true);
    }

    async function handleSaveStructure(e: React.FormEvent) {
        e.preventDefault();
        try {
            const payload = {
                name: structureForm.name.trim(),
                amount: Number(structureForm.amount),
                fee_category_id: structureForm.fee_category_id ? Number(structureForm.fee_category_id) : null,
                academic_session_id: structureForm.academic_session_id ? Number(structureForm.academic_session_id) : null,
                school_class_id: structureForm.school_class_id ? Number(structureForm.school_class_id) : null,
                section_id: structureForm.section_id ? Number(structureForm.section_id) : null,
                fee_type: structureForm.fee_type,
                payment_schedule: structureForm.payment_schedule,
                due_day: structureForm.due_day ? Number(structureForm.due_day) : null,
                due_date: structureForm.due_date || null,
                description: structureForm.description.trim() || null,
                is_active: structureForm.is_active,
            };

            if (editingStructure) {
                await api.patch(`/api/institution/fee-structures/${editingStructure.id}`, payload);
                showNotice('success', `Fee structure "${payload.name}" updated successfully.`);
            } else {
                await api.post('/api/institution/fee-structures', payload);
                showNotice('success', `Fee structure "${payload.name}" created successfully.`);
            }

            setStructureModalOpen(false);
            loadStructures(structuresPagination.current_page);
            loadSummary();
        } catch (error: unknown) {
            showNotice('error', getErrorMessage(error, 'Failed to save fee structure.'));
        }
    }

    async function confirmDeleteStructure() {
        if (!structureDeleteTarget) return;
        try {
            await api.delete(`/api/institution/fee-structures/${structureDeleteTarget.id}`);
            showNotice('success', `Fee structure "${structureDeleteTarget.name}" deleted.`);
            setStructureDeleteTarget(null);
            loadStructures(structuresPagination.current_page);
            loadSummary();
        } catch (error: unknown) {
            showNotice('error', getErrorMessage(error, 'Unable to delete fee structure.'));
        }
    }

    // -------------------------------------------------------------
    // TAB 2: FEE CATEGORIES STATE & LOGIC
    // -------------------------------------------------------------
    const [categories, setCategories] = useState<FeeCategoryRow[]>([]);
    const [categoriesLoading, setCategoriesLoading] = useState(false);
    const [categorySearch, setCategorySearch] = useState('');
    const [categoryFilterKind, setCategoryFilterKind] = useState('');
    const [categoryModalOpen, setCategoryModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<FeeCategoryRow | null>(null);
    const [categoryDeleteTarget, setCategoryDeleteTarget] = useState<FeeCategoryRow | null>(null);

    const [categoryForm, setCategoryForm] = useState({
        name: '',
        code: '',
        kind: 'tuition',
        billing_type: 'recurring',
        default_amount: 0,
        fine_amount: 0,
        due_day: '10',
        description: '',
        is_active: true,
    });

    async function loadCategories() {
        setCategoriesLoading(true);
        try {
            const params: Record<string, string | number> = { per_page: 50 };
            if (categorySearch) params.search = categorySearch;
            if (categoryFilterKind) params.kind = categoryFilterKind;

            const { data } = await api.get<{ data: FeeCategoryRow[] }>('/api/institution/fee-categories', { params });
            setCategories(data.data ?? []);
            setCategoriesList(data.data ?? []);
        } catch (error: unknown) {
            showNotice('error', getErrorMessage(error, 'Unable to load fee categories.'));
        } finally {
            setCategoriesLoading(false);
        }
    }

    useEffect(() => {
        if (activeTab === 'categories') {
            loadCategories();
        }
    }, [activeTab, categorySearch, categoryFilterKind]);

    function openCreateCategory() {
        setEditingCategory(null);
        setCategoryForm({
            name: '',
            code: '',
            kind: 'tuition',
            billing_type: 'recurring',
            default_amount: 0,
            fine_amount: 0,
            due_day: '10',
            description: '',
            is_active: true,
        });
        setCategoryModalOpen(true);
    }

    function openEditCategory(item: FeeCategoryRow) {
        setEditingCategory(item);
        setCategoryForm({
            name: item.name,
            code: item.code,
            kind: item.kind,
            billing_type: item.billing_type,
            default_amount: item.default_amount,
            fine_amount: item.fine_amount,
            due_day: item.due_day ? String(item.due_day) : '',
            description: item.description ?? '',
            is_active: item.is_active,
        });
        setCategoryModalOpen(true);
    }

    async function handleSaveCategory(e: React.FormEvent) {
        e.preventDefault();
        try {
            const payload = {
                name: categoryForm.name.trim(),
                code: categoryForm.code.trim().toUpperCase(),
                kind: categoryForm.kind,
                billing_type: categoryForm.billing_type,
                default_amount: Number(categoryForm.default_amount),
                fine_amount: Number(categoryForm.fine_amount || 0),
                due_day: categoryForm.due_day ? Number(categoryForm.due_day) : null,
                description: categoryForm.description.trim() || null,
                is_active: categoryForm.is_active,
            };

            if (editingCategory) {
                await api.patch(`/api/institution/fee-categories/${editingCategory.id}`, payload);
                showNotice('success', `Fee category "${payload.name}" updated.`);
            } else {
                await api.post('/api/institution/fee-categories', payload);
                showNotice('success', `Fee category "${payload.name}" created.`);
            }

            setCategoryModalOpen(false);
            loadCategories();
            loadSummary();
        } catch (error: unknown) {
            showNotice('error', getErrorMessage(error, 'Failed to save fee category.'));
        }
    }

    async function confirmDeleteCategory() {
        if (!categoryDeleteTarget) return;
        try {
            await api.delete(`/api/institution/fee-categories/${categoryDeleteTarget.id}`);
            showNotice('success', `Fee category "${categoryDeleteTarget.name}" deleted.`);
            setCategoryDeleteTarget(null);
            loadCategories();
            loadSummary();
        } catch (error: unknown) {
            showNotice('error', getErrorMessage(error, 'Unable to delete fee category.'));
        }
    }

    // -------------------------------------------------------------
    // TAB 3: SCHOLARSHIPS & DISCOUNTS STATE & LOGIC
    // -------------------------------------------------------------
    const [scholarships, setScholarships] = useState<ScholarshipRow[]>([]);
    const [scholarshipsLoading, setScholarshipsLoading] = useState(false);
    const [scholarshipSearch, setScholarshipSearch] = useState('');
    const [scholarshipFilterCategory, setScholarshipFilterCategory] = useState('');
    const [scholarshipModalOpen, setScholarshipModalOpen] = useState(false);
    const [editingScholarship, setEditingScholarship] = useState<ScholarshipRow | null>(null);
    const [scholarshipDeleteTarget, setScholarshipDeleteTarget] = useState<ScholarshipRow | null>(null);

    const [scholarshipForm, setScholarshipForm] = useState({
        name: '',
        code: '',
        category: 'sibling',
        discount_type: 'percent',
        value: 10,
        eligibility_rules: '',
        is_active: true,
    });

    async function loadScholarships() {
        setScholarshipsLoading(true);
        try {
            const params: Record<string, string | number> = { per_page: 50 };
            if (scholarshipSearch) params.search = scholarshipSearch;
            if (scholarshipFilterCategory) params.category = scholarshipFilterCategory;

            const { data } = await api.get<{ data: ScholarshipRow[] }>('/api/institution/scholarships', { params });
            setScholarships(data.data ?? []);
        } catch (error: unknown) {
            showNotice('error', getErrorMessage(error, 'Unable to load scholarships.'));
        } finally {
            setScholarshipsLoading(false);
        }
    }

    useEffect(() => {
        if (activeTab === 'scholarships') {
            loadScholarships();
        }
    }, [activeTab, scholarshipSearch, scholarshipFilterCategory]);

    function openCreateScholarship() {
        setEditingScholarship(null);
        setScholarshipForm({
            name: '',
            code: '',
            category: 'sibling',
            discount_type: 'percent',
            value: 15,
            eligibility_rules: 'Applicable for 2nd and subsequent siblings enrolled in the same academic year.',
            is_active: true,
        });
        setScholarshipModalOpen(true);
    }

    function openEditScholarship(item: ScholarshipRow) {
        setEditingScholarship(item);
        setScholarshipForm({
            name: item.name,
            code: item.code ?? '',
            category: item.category,
            discount_type: item.discount_type,
            value: item.value,
            eligibility_rules: item.eligibility_rules ?? '',
            is_active: item.is_active,
        });
        setScholarshipModalOpen(true);
    }

    async function handleSaveScholarship(e: React.FormEvent) {
        e.preventDefault();
        try {
            const payload = {
                name: scholarshipForm.name.trim(),
                code: scholarshipForm.code.trim().toUpperCase() || null,
                category: scholarshipForm.category,
                discount_type: scholarshipForm.discount_type,
                value: Number(scholarshipForm.value),
                eligibility_rules: scholarshipForm.eligibility_rules.trim() || null,
                is_active: scholarshipForm.is_active,
            };

            if (editingScholarship) {
                await api.patch(`/api/institution/scholarships/${editingScholarship.id}`, payload);
                showNotice('success', `Discount rule "${payload.name}" updated.`);
            } else {
                await api.post('/api/institution/scholarships', payload);
                showNotice('success', `Discount rule "${payload.name}" created.`);
            }

            setScholarshipModalOpen(false);
            loadScholarships();
            loadSummary();
        } catch (error: unknown) {
            showNotice('error', getErrorMessage(error, 'Failed to save discount rule.'));
        }
    }

    async function confirmDeleteScholarship() {
        if (!scholarshipDeleteTarget) return;
        try {
            await api.delete(`/api/institution/scholarships/${scholarshipDeleteTarget.id}`);
            showNotice('success', `Discount "${scholarshipDeleteTarget.name}" deleted.`);
            setScholarshipDeleteTarget(null);
            loadScholarships();
            loadSummary();
        } catch (error: unknown) {
            showNotice('error', getErrorMessage(error, 'Unable to delete discount rule.'));
        }
    }

    // -------------------------------------------------------------
    // TAB 4: LATE FEE SETTINGS STATE & LOGIC
    // -------------------------------------------------------------
    const [lateFeeSetting, setLateFeeSetting] = useState<LateFeeSettingRow>({
        enabled: false,
        penalty_type: 'fixed',
        penalty_value: 100,
        grace_days: 7,
        penalty_start_date: null,
        description: 'Late fee charged if payment is not completed after grace days.',
    });
    const [lateFeeLoading, setLateFeeLoading] = useState(false);
    const [lateFeeSaving, setLateFeeSaving] = useState(false);

    async function loadLateFeeSettings() {
        setLateFeeLoading(true);
        try {
            const { data } = await api.get<{ data: LateFeeSettingRow }>('/api/institution/late-fee-settings');
            if (data.data) {
                setLateFeeSetting({
                    ...data.data,
                    penalty_start_date: data.data.penalty_start_date ? data.data.penalty_start_date.slice(0, 10) : null,
                });
            }
        } catch (error: unknown) {
            showNotice('error', getErrorMessage(error, 'Unable to load late fee settings.'));
        } finally {
            setLateFeeLoading(false);
        }
    }

    useEffect(() => {
        if (activeTab === 'late_fees') {
            loadLateFeeSettings();
        }
    }, [activeTab]);

    async function handleSaveLateFeeSettings(e: React.FormEvent) {
        e.preventDefault();
        setLateFeeSaving(true);
        try {
            const payload = {
                enabled: lateFeeSetting.enabled,
                penalty_type: lateFeeSetting.penalty_type,
                penalty_value: Number(lateFeeSetting.penalty_value),
                grace_days: Number(lateFeeSetting.grace_days),
                penalty_start_date: lateFeeSetting.penalty_start_date || null,
                description: lateFeeSetting.description || null,
            };

            await api.post('/api/institution/late-fee-settings', payload);
            showNotice('success', 'Late fee and penalty rules saved successfully.');
            loadSummary();
        } catch (error: unknown) {
            showNotice('error', getErrorMessage(error, 'Failed to save late fee settings.'));
        } finally {
            setLateFeeSaving(false);
        }
    }

    // -------------------------------------------------------------
    // TAB 5: PAYMENT CONFIGURATION STATE & LOGIC
    // -------------------------------------------------------------
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([]);
    const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);
    const [editingPaymentMethod, setEditingPaymentMethod] = useState<PaymentMethodRow | null>(null);
    const [paymentMethodModalOpen, setPaymentMethodModalOpen] = useState(false);
    const [paymentMethodForm, setPaymentMethodForm] = useState({
        name: '',
        instructions: '',
        account_details: '',
        enabled: true,
    });

    async function loadPaymentMethods() {
        setPaymentMethodsLoading(true);
        try {
            const { data } = await api.get<{ data: PaymentMethodRow[] }>('/api/institution/payment-methods');
            setPaymentMethods(data.data ?? []);
        } catch (error: unknown) {
            showNotice('error', getErrorMessage(error, 'Unable to load payment methods.'));
        } finally {
            setPaymentMethodsLoading(false);
        }
    }

    useEffect(() => {
        if (activeTab === 'payment_methods') {
            loadPaymentMethods();
        }
    }, [activeTab]);

    function openEditPaymentMethod(item: PaymentMethodRow) {
        setEditingPaymentMethod(item);
        setPaymentMethodForm({
            name: item.name,
            instructions: item.instructions ?? '',
            account_details: item.account_details ?? '',
            enabled: item.enabled,
        });
        setPaymentMethodModalOpen(true);
    }

    async function handleSavePaymentMethod(e: React.FormEvent) {
        e.preventDefault();
        if (!editingPaymentMethod) return;
        try {
            await api.patch(`/api/institution/payment-methods/${editingPaymentMethod.id}`, {
                name: paymentMethodForm.name.trim(),
                instructions: paymentMethodForm.instructions.trim() || null,
                account_details: paymentMethodForm.account_details.trim() || null,
                enabled: paymentMethodForm.enabled,
            });
            showNotice('success', `Payment method "${editingPaymentMethod.name}" updated.`);
            setPaymentMethodModalOpen(false);
            loadPaymentMethods();
        } catch (error: unknown) {
            showNotice('error', getErrorMessage(error, 'Failed to update payment method.'));
        }
    }

    async function togglePaymentMethod(item: PaymentMethodRow) {
        try {
            await api.patch(`/api/institution/payment-methods/${item.id}`, {
                enabled: !item.enabled,
            });
            showNotice('success', `${item.name} is now ${!item.enabled ? 'enabled' : 'disabled'}.`);
            loadPaymentMethods();
        } catch (error: unknown) {
            showNotice('error', getErrorMessage(error, 'Failed to update payment method status.'));
        }
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Fee & Billing Configuration</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Configure school fee categories, class & section structures, scholarship discounts, late fines, and payment methods.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                    <button
                        type="button"
                        onClick={openCreateCategory}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-700"
                    >
                        <Plus className="size-4 text-slate-500" />
                        Add Fee Category
                    </button>
                    <button
                        type="button"
                        onClick={openCreateStructure}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-blue-700"
                    >
                        <Plus className="size-4" />
                        Add Fee Structure
                    </button>
                </div>
            </div>

            {/* Notification Banner */}
            {notification && (
                <div
                    className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                        notification.type === 'success'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-rose-200 bg-rose-50 text-rose-800'
                    }`}
                >
                    <div className="flex items-center gap-2.5">
                        {notification.type === 'success' ? (
                            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                        ) : (
                            <AlertCircle className="size-4 shrink-0 text-rose-600" />
                        )}
                        <span>{notification.message}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setNotification(null)}
                        className="rounded p-1 text-slate-400 hover:text-slate-600"
                    >
                        <X className="size-4" />
                    </button>
                </div>
            )}

            {/* Metric Summary Cards */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Fee Categories</span>
                        <div className="flex size-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                            <Layers className="size-4" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-2xl font-bold tracking-tight text-slate-900">
                            {loadingSummary ? '…' : summary?.total_categories ?? 0}
                        </span>
                        <span className="text-xs text-slate-500">configured</span>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Fee Structures</span>
                        <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                            <DollarSign className="size-4" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-2xl font-bold tracking-tight text-slate-900">
                            {loadingSummary ? '…' : summary?.active_fee_structures ?? 0}
                        </span>
                        <span className="text-xs text-emerald-700">active rules</span>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Academic Years</span>
                        <div className="flex size-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                            <Calendar className="size-4" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-2xl font-bold tracking-tight text-slate-900">
                            {loadingSummary ? '…' : summary?.active_academic_years ?? 0}
                        </span>
                        <span className="text-xs text-slate-500">current sessions</span>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Discounts & Fines</span>
                        <div className="flex size-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                            <Percent className="size-4" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-2xl font-bold tracking-tight text-slate-900">
                            {loadingSummary ? '…' : summary?.total_scholarships ?? 0}
                        </span>
                        <span className="text-xs text-slate-500">
                            {summary?.late_fees_enabled ? '· Late fee ON' : '· Late fee OFF'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="border-b border-slate-200">
                <nav className="-mb-px flex flex-wrap gap-2 sm:gap-6" aria-label="Fee Tabs">
                    {[
                        { key: 'structures', label: 'Fee Structures', icon: Layers },
                        { key: 'categories', label: 'Fee Categories', icon: Building2 },
                        { key: 'scholarships', label: 'Discounts & Scholarships', icon: Award },
                        { key: 'late_fees', label: 'Late Fee & Fine Rules', icon: Clock },
                        { key: 'payment_methods', label: 'Payment Configuration', icon: Wallet },
                    ].map((tab) => {
                        const Icon = tab.icon;
                        const isCurrent = activeTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                type="button"
                                onClick={() => setActiveTab(tab.key as any)}
                                className={`inline-flex items-center gap-2 border-b-2 py-3.5 text-sm font-medium transition ${
                                    isCurrent
                                        ? 'border-blue-700 text-blue-800'
                                        : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
                                }`}
                            >
                                <Icon className={`size-4 ${isCurrent ? 'text-blue-700' : 'text-slate-400'}`} />
                                {tab.label}
                            </button>
                        );
                    })}
                </nav>
            </div>

            {/* ============================================================== */}
            {/* TAB 1: FEE STRUCTURES                                          */}
            {/* ============================================================== */}
            {activeTab === 'structures' && (
                <div className="space-y-4">
                    {/* Filters & Search */}
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                            <div className="relative sm:col-span-2">
                                <Search className="absolute left-3.5 top-3 size-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search by name, class, category…"
                                    value={structureSearch}
                                    onChange={(e) => setStructureSearch(e.target.value)}
                                    className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>

                            <select
                                value={structureFilterSession}
                                onChange={(e) => setStructureFilterSession(e.target.value)}
                                className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            >
                                <option value="">All Academic Years</option>
                                {academicSessions.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.name} {s.status === 'active' ? '(Current)' : ''}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={structureFilterClass}
                                onChange={(e) => setStructureFilterClass(e.target.value)}
                                className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            >
                                <option value="">All Classes</option>
                                {classes.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={structureFilterCategory}
                                onChange={(e) => setStructureFilterCategory(e.target.value)}
                                className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            >
                                <option value="">All Categories</option>
                                {categoriesList.map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </option>
                                ))}
                            </select>

                            <select
                                value={structureFilterSchedule}
                                onChange={(e) => setStructureFilterSchedule(e.target.value)}
                                className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            >
                                <option value="">All Schedules</option>
                                <option value="monthly">Monthly</option>
                                <option value="quarterly">Quarterly</option>
                                <option value="half_yearly">Half-Yearly</option>
                                <option value="yearly">Yearly</option>
                                <option value="one_time">One Time</option>
                            </select>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm">
                                <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-600">
                                    <tr>
                                        <th className="px-5 py-3.5">Fee Name & Details</th>
                                        <th className="px-4 py-3.5">Category</th>
                                        <th className="px-4 py-3.5">Assigned Target</th>
                                        <th className="px-4 py-3.5">Amount</th>
                                        <th className="px-4 py-3.5">Type & Schedule</th>
                                        <th className="px-4 py-3.5">Due Rule</th>
                                        <th className="px-4 py-3.5">Status</th>
                                        <th className="px-5 py-3.5 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {structuresLoading ? (
                                        <tr>
                                            <td colSpan={8} className="py-12 text-center text-sm text-slate-500">
                                                <RefreshCw className="mx-auto mb-2 size-5 animate-spin text-blue-600" />
                                                Loading fee structures…
                                            </td>
                                        </tr>
                                    ) : structures.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="py-12 text-center">
                                                <Layers className="mx-auto mb-2 size-8 text-slate-300" />
                                                <p className="font-medium text-slate-700">No fee structures found</p>
                                                <p className="mt-1 text-xs text-slate-400">
                                                    Create your first fee structure to define tuition, exam fees, or lab charges.
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={openCreateStructure}
                                                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-800"
                                                >
                                                    <Plus className="size-3.5" />
                                                    Add Fee Structure
                                                </button>
                                            </td>
                                        </tr>
                                    ) : (
                                        structures.map((item) => (
                                            <tr key={item.id} className="transition hover:bg-slate-50/50">
                                                <td className="px-5 py-4">
                                                    <div className="font-semibold text-slate-900">{item.name}</div>
                                                    {item.description && (
                                                        <div className="mt-0.5 max-w-xs truncate text-xs text-slate-500">
                                                            {item.description}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-slate-700">
                                                    {item.category?.name ? (
                                                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                                                            {item.category.name}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">General</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4 text-slate-700">
                                                    <div className="font-medium text-slate-800">
                                                        {item.school_class?.name ? item.school_class.name : 'All Classes'}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        {item.section?.name ? `Section ${item.section.name}` : 'All Sections'}
                                                        {item.academic_session?.name ? ` · ${item.academic_session.name}` : ''}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 font-semibold text-slate-900">
                                                    {currency} {item.amount.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <span
                                                            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                                                                item.fee_type === 'compulsory'
                                                                    ? 'bg-blue-50 text-blue-700'
                                                                    : 'bg-slate-100 text-slate-700'
                                                            }`}
                                                        >
                                                            {item.fee_type === 'compulsory' ? 'Compulsory' : 'Optional'}
                                                        </span>
                                                        <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">
                                                            {SCHEDULE_LABELS[item.payment_schedule] ?? item.payment_schedule}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-4 text-xs text-slate-600">
                                                    {item.payment_schedule === 'one_time' && item.due_date ? (
                                                        <span>Due: {item.due_date.slice(0, 10)}</span>
                                                    ) : item.due_day ? (
                                                        <span>Day {item.due_day} of cycle</span>
                                                    ) : (
                                                        <span className="text-slate-400">Standard</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-4">
                                                    <span
                                                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                                            item.is_active
                                                                ? 'bg-emerald-50 text-emerald-700'
                                                                : 'bg-slate-100 text-slate-600'
                                                        }`}
                                                    >
                                                        <span
                                                            className={`size-1.5 rounded-full ${
                                                                item.is_active ? 'bg-emerald-600' : 'bg-slate-400'
                                                            }`}
                                                        />
                                                        {item.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <button
                                                            type="button"
                                                            title="View details"
                                                            onClick={() => setViewingStructure(item)}
                                                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                                                        >
                                                            <Eye className="size-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            title="Edit structure"
                                                            onClick={() => openEditStructure(item)}
                                                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-700"
                                                        >
                                                            <Edit3 className="size-4" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            title="Delete structure"
                                                            onClick={() => setStructureDeleteTarget(item)}
                                                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                                                        >
                                                            <Trash2 className="size-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination footer */}
                        {structuresPagination.total > 0 && (
                            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-xs text-slate-500">
                                <div>
                                    Showing page <span className="font-semibold text-slate-700">{structuresPagination.current_page}</span> of{' '}
                                    <span className="font-semibold text-slate-700">{structuresPagination.last_page}</span> (
                                    {structuresPagination.total} total items)
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        disabled={structuresPagination.current_page <= 1}
                                        onClick={() => loadStructures(structuresPagination.current_page - 1)}
                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                                    >
                                        <ChevronLeft className="size-3.5" /> Previous
                                    </button>
                                    <button
                                        type="button"
                                        disabled={structuresPagination.current_page >= structuresPagination.last_page}
                                        onClick={() => loadStructures(structuresPagination.current_page + 1)}
                                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                                    >
                                        Next <ChevronRight className="size-3.5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* TAB 2: FEE CATEGORIES                                          */}
            {/* ============================================================== */}
            {activeTab === 'categories' && (
                <div className="space-y-4">
                    {/* Filter Bar */}
                    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-1 flex-wrap items-center gap-3">
                            <div className="relative min-w-[220px]">
                                <Search className="absolute left-3.5 top-3 size-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search categories…"
                                    value={categorySearch}
                                    onChange={(e) => setCategorySearch(e.target.value)}
                                    className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>

                            <select
                                value={categoryFilterKind}
                                onChange={(e) => setCategoryFilterKind(e.target.value)}
                                className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            >
                                <option value="">All Kinds</option>
                                {Object.entries(KIND_LABELS).map(([k, label]) => (
                                    <option key={k} value={k}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <button
                            type="button"
                            onClick={openCreateCategory}
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
                        >
                            <Plus className="size-4" />
                            Add Fee Category
                        </button>
                    </div>

                    {/* Table */}
                    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                        <table className="min-w-full text-left text-sm">
                            <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-600">
                                <tr>
                                    <th className="px-5 py-3.5">Category Name & Code</th>
                                    <th className="px-4 py-3.5">Category Kind</th>
                                    <th className="px-4 py-3.5">Billing Type</th>
                                    <th className="px-4 py-3.5">Default Amount</th>
                                    <th className="px-4 py-3.5">Default Late Fine</th>
                                    <th className="px-4 py-3.5">Linked Structures</th>
                                    <th className="px-4 py-3.5">Status</th>
                                    <th className="px-5 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {categoriesLoading ? (
                                    <tr>
                                        <td colSpan={8} className="py-12 text-center text-sm text-slate-500">
                                            <RefreshCw className="mx-auto mb-2 size-5 animate-spin text-blue-600" />
                                            Loading fee categories…
                                        </td>
                                    </tr>
                                ) : categories.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-12 text-center text-slate-500">
                                            No fee categories found.
                                        </td>
                                    </tr>
                                ) : (
                                    categories.map((cat) => (
                                        <tr key={cat.id} className="transition hover:bg-slate-50/50">
                                            <td className="px-5 py-4">
                                                <div className="font-semibold text-slate-900">{cat.name}</div>
                                                <div className="text-xs font-mono text-slate-500">{cat.code}</div>
                                            </td>
                                            <td className="px-4 py-4 text-slate-700">
                                                <span className="inline-flex items-center rounded-lg bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                                                    {KIND_LABELS[cat.kind] ?? cat.kind}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 text-xs capitalize text-slate-600">
                                                {cat.billing_type === 'recurring' ? 'Recurring (Monthly)' : 'One Time'}
                                            </td>
                                            <td className="px-4 py-4 font-semibold text-slate-900">
                                                {currency} {cat.default_amount.toLocaleString()}
                                            </td>
                                            <td className="px-4 py-4 text-slate-600">
                                                {cat.fine_amount ? `${currency} ${cat.fine_amount.toLocaleString()}` : '—'}
                                            </td>
                                            <td className="px-4 py-4 text-slate-600">
                                                {cat.fee_structures_count ?? 0} structures
                                            </td>
                                            <td className="px-4 py-4">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                                        cat.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                                    }`}
                                                >
                                                    <span className={`size-1.5 rounded-full ${cat.is_active ? 'bg-emerald-600' : 'bg-slate-400'}`} />
                                                    {cat.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        title="Edit category"
                                                        onClick={() => openEditCategory(cat)}
                                                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-700"
                                                    >
                                                        <Edit3 className="size-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title="Delete category"
                                                        onClick={() => setCategoryDeleteTarget(cat)}
                                                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* TAB 3: DISCOUNTS & SCHOLARSHIPS                                */}
            {/* ============================================================== */}
            {activeTab === 'scholarships' && (
                <div className="space-y-4">
                    {/* Filter Bar */}
                    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-1 flex-wrap items-center gap-3">
                            <div className="relative min-w-[220px]">
                                <Search className="absolute left-3.5 top-3 size-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search discount rules…"
                                    value={scholarshipSearch}
                                    onChange={(e) => setScholarshipSearch(e.target.value)}
                                    className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>

                            <select
                                value={scholarshipFilterCategory}
                                onChange={(e) => setScholarshipFilterCategory(e.target.value)}
                                className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            >
                                <option value="">All Categories</option>
                                {Object.entries(SCHOLARSHIP_CATEGORY_LABELS).map(([key, label]) => (
                                    <option key={key} value={key}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <button
                            type="button"
                            onClick={openCreateScholarship}
                            className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
                        >
                            <Plus className="size-4" />
                            Add Discount / Scholarship
                        </button>
                    </div>

                    {/* Table */}
                    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                        <table className="min-w-full text-left text-sm">
                            <thead className="border-b border-slate-200 bg-slate-50/75 text-xs font-semibold text-slate-600">
                                <tr>
                                    <th className="px-5 py-3.5">Name & Code</th>
                                    <th className="px-4 py-3.5">Category</th>
                                    <th className="px-4 py-3.5">Discount Amount</th>
                                    <th className="px-4 py-3.5">Eligibility Rules</th>
                                    <th className="px-4 py-3.5">Status</th>
                                    <th className="px-5 py-3.5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {scholarshipsLoading ? (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-sm text-slate-500">
                                            <RefreshCw className="mx-auto mb-2 size-5 animate-spin text-blue-600" />
                                            Loading discount rules…
                                        </td>
                                    </tr>
                                ) : scholarships.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-slate-500">
                                            No discounts or scholarships found.
                                        </td>
                                    </tr>
                                ) : (
                                    scholarships.map((s) => (
                                        <tr key={s.id} className="transition hover:bg-slate-50/50">
                                            <td className="px-5 py-4">
                                                <div className="font-semibold text-slate-900">{s.name}</div>
                                                {s.code && <div className="text-xs font-mono text-slate-500">{s.code}</div>}
                                            </td>
                                            <td className="px-4 py-4 text-slate-700">
                                                <span className="inline-flex items-center rounded-lg bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
                                                    {SCHOLARSHIP_CATEGORY_LABELS[s.category] ?? s.category}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4 font-semibold text-slate-900">
                                                {s.discount_type === 'percent' ? `${s.value}% off` : `${currency} ${s.value.toLocaleString()} off`}
                                            </td>
                                            <td className="px-4 py-4 max-w-sm text-xs text-slate-600">
                                                {s.eligibility_rules || 'No specific criteria set'}
                                            </td>
                                            <td className="px-4 py-4">
                                                <span
                                                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                                        s.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                                    }`}
                                                >
                                                    <span className={`size-1.5 rounded-full ${s.is_active ? 'bg-emerald-600' : 'bg-slate-400'}`} />
                                                    {s.is_active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        title="Edit discount"
                                                        onClick={() => openEditScholarship(s)}
                                                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-700"
                                                    >
                                                        <Edit3 className="size-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        title="Delete discount"
                                                        onClick={() => setScholarshipDeleteTarget(s)}
                                                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* TAB 4: LATE FEE & FINE RULES                                   */}
            {/* ============================================================== */}
            {activeTab === 'late_fees' && (
                <div className="max-w-3xl space-y-6">
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                        <div className="mb-6 flex items-start justify-between border-b border-slate-100 pb-5">
                            <div>
                                <h2 className="text-base font-semibold text-slate-900">Late Fee Policy & Billing Penalties</h2>
                                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                                    Define automatic late fines applied when fees remain unpaid past the due date and grace period.
                                </p>
                            </div>
                            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                                <Clock className="size-5" />
                            </div>
                        </div>

                        {lateFeeLoading ? (
                            <div className="py-8 text-center text-sm text-slate-500">
                                <RefreshCw className="mx-auto mb-2 size-5 animate-spin text-blue-600" />
                                Loading late fee policy…
                            </div>
                        ) : (
                            <form onSubmit={handleSaveLateFeeSettings} className="space-y-6">
                                {/* Enable / Disable Toggle */}
                                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                                    <div>
                                        <div className="text-sm font-semibold text-slate-900">Enable Late Fee Charges</div>
                                        <div className="text-xs text-slate-500">
                                            When enabled, system applies penalty calculations to overdue student fee invoices.
                                        </div>
                                    </div>
                                    <label className="relative inline-flex cursor-pointer items-center">
                                        <input
                                            type="checkbox"
                                            checked={lateFeeSetting.enabled}
                                            onChange={(e) => setLateFeeSetting({ ...lateFeeSetting, enabled: e.target.checked })}
                                            className="peer sr-only"
                                        />
                                        <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:size-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-700 peer-checked:after:translate-x-full peer-focus:outline-none" />
                                    </label>
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">Penalty Type</label>
                                        <select
                                            value={lateFeeSetting.penalty_type}
                                            onChange={(e) =>
                                                setLateFeeSetting({
                                                    ...lateFeeSetting,
                                                    penalty_type: e.target.value as 'fixed' | 'percentage',
                                                })
                                            }
                                            className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        >
                                            <option value="fixed">Fixed Penalty Amount ({currency})</option>
                                            <option value="percentage">Percentage Penalty (%) of Overdue Amount</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                                            Penalty Value {lateFeeSetting.penalty_type === 'fixed' ? `(${currency})` : '(%)'}
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            value={lateFeeSetting.penalty_value}
                                            onChange={(e) =>
                                                setLateFeeSetting({ ...lateFeeSetting, penalty_value: Number(e.target.value) })
                                            }
                                            className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                                            Grace Period (Days After Due Date)
                                        </label>
                                        <input
                                            type="number"
                                            min={0}
                                            max={90}
                                            value={lateFeeSetting.grace_days}
                                            onChange={(e) =>
                                                setLateFeeSetting({ ...lateFeeSetting, grace_days: Number(e.target.value) })
                                            }
                                            className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        />
                                        <p className="mt-1 text-[11px] text-slate-500">
                                            Number of calendar days after the due date before penalty is calculated.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                                            Penalty Effective / Cutoff Date (Optional)
                                        </label>
                                        <input
                                            type="date"
                                            value={lateFeeSetting.penalty_start_date ?? ''}
                                            onChange={(e) =>
                                                setLateFeeSetting({ ...lateFeeSetting, penalty_start_date: e.target.value || null })
                                            }
                                            className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        />
                                        <p className="mt-1 text-[11px] text-slate-500">
                                            Optional hard date trigger for penalty enforcement across the institution.
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-slate-700">
                                        Policy Description & Instructions (Shown on Invoices)
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={lateFeeSetting.description ?? ''}
                                        onChange={(e) =>
                                            setLateFeeSetting({ ...lateFeeSetting, description: e.target.value })
                                        }
                                        placeholder="Explain late fee terms printed on billing receipts..."
                                        className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>

                                <div className="flex justify-end pt-2">
                                    <button
                                        type="submit"
                                        disabled={lateFeeSaving}
                                        className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 disabled:opacity-50"
                                    >
                                        {lateFeeSaving ? (
                                            <>
                                                <RefreshCw className="size-4 animate-spin" /> Saving…
                                            </>
                                        ) : (
                                            'Save Late Fee Settings'
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* TAB 5: PAYMENT CONFIGURATION                                   */}
            {/* ============================================================== */}
            {activeTab === 'payment_methods' && (
                <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-base font-semibold text-slate-900">Supported Payment Channels & Instructions</h2>
                                <p className="text-xs text-slate-500">
                                    Configure banking information, eSewa, Khalti, and cash collection rules displayed to guardians and cashiers.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={loadPaymentMethods}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                            >
                                <RefreshCw className="size-3.5" /> Refresh Methods
                            </button>
                        </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        {paymentMethodsLoading ? (
                            <div className="col-span-2 py-12 text-center text-sm text-slate-500">
                                <RefreshCw className="mx-auto mb-2 size-5 animate-spin text-blue-600" />
                                Loading payment methods…
                            </div>
                        ) : (
                            paymentMethods.map((method) => (
                                <div
                                    key={method.id}
                                    className={`flex flex-col justify-between rounded-2xl border p-5 transition ${
                                        method.enabled
                                            ? 'border-slate-200 bg-white shadow-sm'
                                            : 'border-slate-200/60 bg-slate-50/70 opacity-75'
                                    }`}
                                >
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className={`flex size-10 items-center justify-center rounded-xl ${
                                                        method.code === 'esewa'
                                                            ? 'bg-emerald-100 text-emerald-800'
                                                            : method.code === 'khalti'
                                                            ? 'bg-purple-100 text-purple-800'
                                                            : method.code === 'bank'
                                                            ? 'bg-blue-100 text-blue-800'
                                                            : method.code === 'cash'
                                                            ? 'bg-amber-100 text-amber-800'
                                                            : 'bg-slate-100 text-slate-800'
                                                    }`}
                                                >
                                                    {method.code === 'cash' ? (
                                                        <Banknote className="size-5" />
                                                    ) : method.code === 'bank' ? (
                                                        <Building2 className="size-5" />
                                                    ) : (
                                                        <Wallet className="size-5" />
                                                    )}
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-slate-900">{method.name}</h3>
                                                    <span className="font-mono text-xs uppercase text-slate-400">
                                                        Code: {method.code}
                                                    </span>
                                                </div>
                                            </div>

                                            <label className="relative inline-flex cursor-pointer items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={method.enabled}
                                                    onChange={() => togglePaymentMethod(method)}
                                                    className="peer sr-only"
                                                />
                                                <div className="peer h-5 w-9 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:size-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full peer-focus:outline-none" />
                                            </label>
                                        </div>

                                        <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs">
                                            <div>
                                                <span className="font-medium text-slate-600">Instructions:</span>
                                                <p className="mt-0.5 text-slate-500">
                                                    {method.instructions || 'No special payer instructions specified.'}
                                                </p>
                                            </div>
                                            {method.account_details && (
                                                <div>
                                                    <span className="font-medium text-slate-600">Account / Merchant:</span>
                                                    <p className="mt-0.5 rounded-lg bg-slate-50 p-2 font-mono text-[11px] text-slate-700">
                                                        {method.account_details}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                                        <span
                                            className={`font-medium ${method.enabled ? 'text-emerald-700' : 'text-slate-400'}`}
                                        >
                                            {method.enabled ? '● Active Channel' : '○ Disabled'}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => openEditPaymentMethod(method)}
                                            className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:text-blue-800"
                                        >
                                            <Edit3 className="size-3.5" /> Configure
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* MODAL: CREATE / EDIT FEE STRUCTURE                             */}
            {/* ============================================================== */}
            {structureModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
                    <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
                        <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">
                                    {editingStructure ? 'Edit Fee Structure' : 'Create New Fee Structure'}
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Assign specific fee schedules to academic years, classes, and sections.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setStructureModalOpen(false)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveStructure} className="space-y-4">
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-700">Structure Title *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Grade 10 Monthly Tuition Fee"
                                    value={structureForm.name}
                                    onChange={(e) => setStructureForm({ ...structureForm, name: e.target.value })}
                                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-700">Fee Category</label>
                                    <select
                                        value={structureForm.fee_category_id}
                                        onChange={(e) => {
                                            const catId = e.target.value;
                                            const selectedCat = categoriesList.find((c) => String(c.id) === catId);
                                            setStructureForm((prev) => ({
                                                ...prev,
                                                fee_category_id: catId,
                                                amount: prev.amount === 0 && selectedCat?.default_amount ? selectedCat.default_amount : prev.amount,
                                                due_day: prev.due_day === '' && selectedCat?.due_day ? String(selectedCat.due_day) : prev.due_day,
                                            }));
                                        }}
                                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    >
                                        <option value="">General (No Category)</option>
                                        {categoriesList.map((cat) => (
                                            <option key={cat.id} value={cat.id}>
                                                {cat.name} ({currency} {cat.default_amount})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-700">Amount ({currency}) *</label>
                                    <input
                                        type="number"
                                        min={0}
                                        required
                                        value={structureForm.amount}
                                        onChange={(e) => setStructureForm({ ...structureForm, amount: Number(e.target.value) })}
                                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-3">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-700">Academic Year</label>
                                    <select
                                        value={structureForm.academic_session_id}
                                        onChange={(e) => setStructureForm({ ...structureForm, academic_session_id: e.target.value })}
                                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    >
                                        <option value="">All Academic Years</option>
                                        {academicSessions.map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {s.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-700">Class</label>
                                    <select
                                        value={structureForm.school_class_id}
                                        onChange={(e) => setStructureForm({ ...structureForm, school_class_id: e.target.value, section_id: '' })}
                                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    >
                                        <option value="">All Classes</option>
                                        {classes.map((c) => (
                                            <option key={c.id} value={c.id}>
                                                {c.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-700">Section</label>
                                    <select
                                        value={structureForm.section_id}
                                        onChange={(e) => setStructureForm({ ...structureForm, section_id: e.target.value })}
                                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    >
                                        <option value="">All Sections</option>
                                        {sections
                                            .filter((s) => !structureForm.school_class_id || s.school_class_id === Number(structureForm.school_class_id))
                                            .map((s) => (
                                                <option key={s.id} value={s.id}>
                                                    Section {s.name}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-700">Fee Type *</label>
                                    <select
                                        value={structureForm.fee_type}
                                        onChange={(e) => setStructureForm({ ...structureForm, fee_type: e.target.value as any })}
                                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    >
                                        <option value="compulsory">Compulsory (Applied to all enrolled students)</option>
                                        <option value="optional">Optional (Selected per student request, e.g. Transport, Hostel)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-700">Payment Schedule *</label>
                                    <select
                                        value={structureForm.payment_schedule}
                                        onChange={(e) => setStructureForm({ ...structureForm, payment_schedule: e.target.value as any })}
                                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    >
                                        <option value="monthly">Monthly</option>
                                        <option value="quarterly">Quarterly</option>
                                        <option value="half_yearly">Half-Yearly</option>
                                        <option value="yearly">Yearly</option>
                                        <option value="one_time">One Time</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-700">Due Day of Month (1 - 28)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={28}
                                        placeholder="e.g. 10 (10th of every month)"
                                        value={structureForm.due_day}
                                        onChange={(e) => setStructureForm({ ...structureForm, due_day: e.target.value })}
                                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-700">Due Date (One-Time Specific)</label>
                                    <input
                                        type="date"
                                        value={structureForm.due_date}
                                        onChange={(e) => setStructureForm({ ...structureForm, due_date: e.target.value })}
                                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-700">Description / Note</label>
                                <textarea
                                    rows={2}
                                    placeholder="Optional description printed on student statements or bills..."
                                    value={structureForm.description}
                                    onChange={(e) => setStructureForm({ ...structureForm, description: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>

                            <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={structureForm.is_active}
                                    onChange={(e) => setStructureForm({ ...structureForm, is_active: e.target.checked })}
                                    className="size-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                                />
                                Active (Available when generating and collecting invoices)
                            </label>

                            <div className="mt-6 flex justify-end gap-2.5 border-t border-slate-100 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setStructureModalOpen(false)}
                                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-xl bg-blue-700 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
                                >
                                    {editingStructure ? 'Save Changes' : 'Create Fee Structure'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* MODAL: VIEW STRUCTURE DETAILS                                  */}
            {/* ============================================================== */}
            {viewingStructure && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
                        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">{viewingStructure.name}</h3>
                                <p className="text-xs text-slate-500">Fee Structure Overview</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setViewingStructure(null)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        <div className="space-y-3.5 text-sm">
                            <div className="flex justify-between border-b border-slate-100 py-1.5">
                                <span className="text-slate-500">Amount:</span>
                                <span className="font-semibold text-slate-900">
                                    {currency} {viewingStructure.amount.toLocaleString()}
                                </span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 py-1.5">
                                <span className="text-slate-500">Category:</span>
                                <span className="font-medium text-slate-800">
                                    {viewingStructure.category?.name ?? 'General'}
                                </span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 py-1.5">
                                <span className="text-slate-500">Academic Year:</span>
                                <span className="font-medium text-slate-800">
                                    {viewingStructure.academic_session?.name ?? 'All Sessions'}
                                </span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 py-1.5">
                                <span className="text-slate-500">Target Class:</span>
                                <span className="font-medium text-slate-800">
                                    {viewingStructure.school_class?.name ?? 'All Classes'}
                                </span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 py-1.5">
                                <span className="text-slate-500">Target Section:</span>
                                <span className="font-medium text-slate-800">
                                    {viewingStructure.section?.name ? `Section ${viewingStructure.section.name}` : 'All Sections'}
                                </span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 py-1.5">
                                <span className="text-slate-500">Fee Type:</span>
                                <span className="font-medium capitalize text-slate-800">{viewingStructure.fee_type}</span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 py-1.5">
                                <span className="text-slate-500">Payment Schedule:</span>
                                <span className="font-medium text-slate-800">
                                    {SCHEDULE_LABELS[viewingStructure.payment_schedule] ?? viewingStructure.payment_schedule}
                                </span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 py-1.5">
                                <span className="text-slate-500">Due Rule:</span>
                                <span className="text-slate-800">
                                    {viewingStructure.due_date
                                        ? `Due date: ${viewingStructure.due_date.slice(0, 10)}`
                                        : viewingStructure.due_day
                                        ? `Day ${viewingStructure.due_day} of month`
                                        : 'Standard'}
                                </span>
                            </div>
                            <div className="flex justify-between border-b border-slate-100 py-1.5">
                                <span className="text-slate-500">Issued Invoices Count:</span>
                                <span className="font-semibold text-slate-900">{viewingStructure.invoices_count ?? 0}</span>
                            </div>
                            {viewingStructure.description && (
                                <div className="pt-2">
                                    <span className="block text-xs font-semibold text-slate-500">Description:</span>
                                    <p className="mt-1 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-700">
                                        {viewingStructure.description}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setViewingStructure(null)}
                                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* MODAL: CREATE / EDIT FEE CATEGORY                              */}
            {/* ============================================================== */}
            {categoryModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
                    <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
                        <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">
                                    {editingCategory ? 'Edit Fee Category' : 'Add Fee Category'}
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Create standard categories like Tuition, Admission, Examination, Library, etc.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setCategoryModalOpen(false)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveCategory} className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-700">Category Name *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Monthly Tuition Fee"
                                        value={categoryForm.name}
                                        onChange={(e) => {
                                            const name = e.target.value;
                                            setCategoryForm((prev) => ({
                                                ...prev,
                                                name,
                                                code: prev.code === '' ? name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 15) : prev.code,
                                            }));
                                        }}
                                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-700">Unique Code *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. TUITION, ADMISSION"
                                        value={categoryForm.code}
                                        onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value.toUpperCase() })}
                                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-mono outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-700">Category Kind *</label>
                                    <select
                                        value={categoryForm.kind}
                                        onChange={(e) => setCategoryForm({ ...categoryForm, kind: e.target.value })}
                                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    >
                                        <option value="admission">Admission Fee</option>
                                        <option value="tuition">Monthly Tuition Fee</option>
                                        <option value="examination">Examination Fee</option>
                                        <option value="library">Library Fee</option>
                                        <option value="transport">Transportation Fee</option>
                                        <option value="computer_lab">Computer Lab Fee</option>
                                        <option value="sports">Sports Fee</option>
                                        <option value="hostel">Hostel Fee</option>
                                        <option value="other">Other Fees</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-700">Billing Type *</label>
                                    <select
                                        value={categoryForm.billing_type}
                                        onChange={(e) => setCategoryForm({ ...categoryForm, billing_type: e.target.value as any })}
                                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    >
                                        <option value="recurring">Recurring (Monthly / Termly)</option>
                                        <option value="one_time">One Time (Admission, Event, Reg)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-3">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-700">Default Amount ({currency})</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={categoryForm.default_amount}
                                        onChange={(e) => setCategoryForm({ ...categoryForm, default_amount: Number(e.target.value) })}
                                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-700">Late Fine ({currency})</label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={categoryForm.fine_amount}
                                        onChange={(e) => setCategoryForm({ ...categoryForm, fine_amount: Number(e.target.value) })}
                                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-700">Due Day (1 - 28)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        max={28}
                                        value={categoryForm.due_day}
                                        onChange={(e) => setCategoryForm({ ...categoryForm, due_day: e.target.value })}
                                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-700">Description</label>
                                <textarea
                                    rows={2}
                                    placeholder="Optional description of what this fee covers..."
                                    value={categoryForm.description}
                                    onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>

                            <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={categoryForm.is_active}
                                    onChange={(e) => setCategoryForm({ ...categoryForm, is_active: e.target.checked })}
                                    className="size-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                                />
                                Active category
                            </label>

                            <div className="mt-6 flex justify-end gap-2.5 border-t border-slate-100 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setCategoryModalOpen(false)}
                                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-xl bg-blue-700 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
                                >
                                    {editingCategory ? 'Save Changes' : 'Create Category'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* MODAL: CREATE / EDIT SCHOLARSHIP / DISCOUNT                    */}
            {/* ============================================================== */}
            {scholarshipModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
                    <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
                        <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">
                                    {editingScholarship ? 'Edit Discount / Scholarship' : 'Add Discount / Scholarship'}
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Configure student discounts, sibling rebates, and merit criteria.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setScholarshipModalOpen(false)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveScholarship} className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-700">Scheme Name *</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Sibling Discount 20%"
                                        value={scholarshipForm.name}
                                        onChange={(e) => setScholarshipForm({ ...scholarshipForm, name: e.target.value })}
                                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-700">Code</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. SIBLING20"
                                        value={scholarshipForm.code}
                                        onChange={(e) => setScholarshipForm({ ...scholarshipForm, code: e.target.value.toUpperCase() })}
                                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm font-mono outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-700">Category *</label>
                                    <select
                                        value={scholarshipForm.category}
                                        onChange={(e) => setScholarshipForm({ ...scholarshipForm, category: e.target.value as any })}
                                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    >
                                        <option value="sibling">Sibling Discount</option>
                                        <option value="merit">Merit Scholarship</option>
                                        <option value="need_based">Need-based / Financial Aid</option>
                                        <option value="staff_child">Staff Child Benefit</option>
                                        <option value="sports">Sports Quota</option>
                                        <option value="general">General Discount</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-slate-700">Discount Type *</label>
                                    <select
                                        value={scholarshipForm.discount_type}
                                        onChange={(e) => setScholarshipForm({ ...scholarshipForm, discount_type: e.target.value as any })}
                                        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                    >
                                        <option value="percent">Percentage (%) Off</option>
                                        <option value="fixed">Fixed Deduction Amount ({currency})</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-700">
                                    Deduction Value {scholarshipForm.discount_type === 'percent' ? '(%) *' : `(${currency}) *`}
                                </label>
                                <input
                                    type="number"
                                    min={1}
                                    max={scholarshipForm.discount_type === 'percent' ? 100 : undefined}
                                    required
                                    value={scholarshipForm.value}
                                    onChange={(e) => setScholarshipForm({ ...scholarshipForm, value: Number(e.target.value) })}
                                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-700">Eligibility Criteria & Rules</label>
                                <textarea
                                    rows={3}
                                    placeholder="e.g. Applied automatically to the second child of same guardian. Minimum attendance 80%."
                                    value={scholarshipForm.eligibility_rules}
                                    onChange={(e) => setScholarshipForm({ ...scholarshipForm, eligibility_rules: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>

                            <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={scholarshipForm.is_active}
                                    onChange={(e) => setScholarshipForm({ ...scholarshipForm, is_active: e.target.checked })}
                                    className="size-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                                />
                                Active discount scheme
                            </label>

                            <div className="mt-6 flex justify-end gap-2.5 border-t border-slate-100 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setScholarshipModalOpen(false)}
                                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-xl bg-blue-700 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
                                >
                                    {editingScholarship ? 'Save Changes' : 'Create Discount'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* MODAL: CONFIGURE PAYMENT METHOD                                */}
            {/* ============================================================== */}
            {paymentMethodModalOpen && editingPaymentMethod && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
                    <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
                        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900">Configure {editingPaymentMethod.name}</h3>
                                <p className="text-xs text-slate-500">
                                    Set instructions, QR / merchant identifiers, and cashier notes.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setPaymentMethodModalOpen(false)}
                                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                            >
                                <X className="size-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSavePaymentMethod} className="space-y-4">
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-700">Display Name</label>
                                <input
                                    type="text"
                                    required
                                    value={paymentMethodForm.name}
                                    onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, name: e.target.value })}
                                    className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-700">Payment Instructions</label>
                                <textarea
                                    rows={3}
                                    placeholder="Instructions given to payers (e.g. Deposit to bank, scan QR on receipt)..."
                                    value={paymentMethodForm.instructions}
                                    onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, instructions: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-700">
                                    Account / Merchant Details
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="e.g. A/C: 01234567890123, Bank: Global IME, Branch: Kathmandu"
                                    value={paymentMethodForm.account_details}
                                    onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, account_details: e.target.value })}
                                    className="w-full rounded-xl border border-slate-200 p-2.5 text-sm font-mono text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                />
                            </div>

                            <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={paymentMethodForm.enabled}
                                    onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, enabled: e.target.checked })}
                                    className="size-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                                />
                                Enable this payment channel in fee collection
                            </label>

                            <div className="mt-6 flex justify-end gap-2.5 border-t border-slate-100 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setPaymentMethodModalOpen(false)}
                                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="rounded-xl bg-blue-700 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
                                >
                                    Save Instructions
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* CONFIRMATION DIALOG: DELETE FEE STRUCTURE                      */}
            {/* ============================================================== */}
            {structureDeleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                        <div className="flex items-center gap-3 text-rose-600">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-rose-50">
                                <Trash2 className="size-5" />
                            </div>
                            <h3 className="text-base font-bold text-slate-900">Delete Fee Structure?</h3>
                        </div>
                        <p className="mt-3 text-sm text-slate-600">
                            Are you sure you want to delete <span className="font-semibold text-slate-900">"{structureDeleteTarget.name}"</span>?
                            This action cannot be undone if no invoices are linked to it.
                        </p>
                        <div className="mt-6 flex justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={() => setStructureDeleteTarget(null)}
                                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDeleteStructure}
                                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700"
                            >
                                Yes, Delete Structure
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* CONFIRMATION DIALOG: DELETE FEE CATEGORY                       */}
            {/* ============================================================== */}
            {categoryDeleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                        <div className="flex items-center gap-3 text-rose-600">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-rose-50">
                                <Trash2 className="size-5" />
                            </div>
                            <h3 className="text-base font-bold text-slate-900">Delete Fee Category?</h3>
                        </div>
                        <p className="mt-3 text-sm text-slate-600">
                            Are you sure you want to delete <span className="font-semibold text-slate-900">"{categoryDeleteTarget.name}"</span>?
                            Categories linked to existing fee structures cannot be deleted.
                        </p>
                        <div className="mt-6 flex justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={() => setCategoryDeleteTarget(null)}
                                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDeleteCategory}
                                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700"
                            >
                                Yes, Delete Category
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================== */}
            {/* CONFIRMATION DIALOG: DELETE SCHOLARSHIP                        */}
            {/* ============================================================== */}
            {scholarshipDeleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                        <div className="flex items-center gap-3 text-rose-600">
                            <div className="flex size-10 items-center justify-center rounded-xl bg-rose-50">
                                <Trash2 className="size-5" />
                            </div>
                            <h3 className="text-base font-bold text-slate-900">Delete Discount Rule?</h3>
                        </div>
                        <p className="mt-3 text-sm text-slate-600">
                            Are you sure you want to delete <span className="font-semibold text-slate-900">"{scholarshipDeleteTarget.name}"</span>?
                        </p>
                        <div className="mt-6 flex justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={() => setScholarshipDeleteTarget(null)}
                                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDeleteScholarship}
                                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-700"
                            >
                                Yes, Delete Discount
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
