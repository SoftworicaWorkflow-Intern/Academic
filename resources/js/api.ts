import axios from 'axios';

export interface AuthUser {
    id: number;
    name: string;
    email: string;
    roles: string[];
    permissions: string[];
    audience: 'platform' | 'institution';
    redirect_to: '/admin/dashboard' | '/dashboard' | '/accountant/dashboard' | '/teacher/dashboard';
    institution: {
        id: number;
        name: string;
        institution_code: string;
        type: string;
    } | null;
}

export interface PlatformDashboard {
    institutions_total: number;
    institutions_active: number;
    institutions_inactive: number;
    schools_total: number;
    colleges_total: number;
    users_total: number;
    users_active: number;
    subscriptions_active: number;
    subscriptions_expiring: number;
    monthly_recurring_revenue: number;
    recent_institutions: Array<{
        id: number;
        name: string;
        institution_code: string;
        type: string;
        status: string;
    }>;
}

export interface InstitutionDashboard {
    institution: NonNullable<AuthUser['institution']>;
    user: {
        name: string;
        roles: string[];
    };
    students_total: number;
    teachers_total: number;
    invoices_open: number;
    fees_outstanding: number;
    currency: string;
}

export const api = axios.create({
    baseURL: '/',
    withCredentials: true,
    withXSRFToken: true,
    headers: {
        Accept: 'application/json',
    },
});

export function getErrorMessage(error: unknown, fallback: string): string {
    if (axios.isAxiosError<{ message?: string; errors?: Record<string, string[]> }>(error)) {
        const errors = error.response?.data.errors;
        const validationMessage = errors ? Object.values(errors)[0]?.[0] : undefined;

        return validationMessage ?? error.response?.data.message ?? fallback;
    }

    return fallback;
}
