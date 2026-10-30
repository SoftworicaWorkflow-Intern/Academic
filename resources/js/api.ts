import axios from 'axios';

export interface AuthUser {
    id: number;
    name: string;
    email: string;
    roles: string[];
    permissions: string[];
    audience: 'platform' | 'institution';
    redirect_to: '/admin/dashboard' | '/dashboard';
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
    users_total: number;
    users_active: number;
}

export interface InstitutionDashboard {
    institution: NonNullable<AuthUser['institution']>;
    user: {
        name: string;
        roles: string[];
    };
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
        const validationMessage = error.response?.data.errors?.login?.[0];

        return validationMessage ?? error.response?.data.message ?? fallback;
    }

    return fallback;
}
