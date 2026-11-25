import axios from 'axios';
import {
    createContext,
    type FormEvent,
    type ReactNode,
    useContext,
    useEffect,
    useState,
} from 'react';
import {
    Activity,
    ArrowRight,
    Eye,
    EyeOff,
    GraduationCap,
    LockKeyhole,
    School,
    ShieldCheck,
    X,
} from 'lucide-react';
import {
    BrowserRouter,
    Link,
    Navigate,
    Route,
    Routes,
    useNavigate,
} from 'react-router-dom';
import { api, getErrorMessage, type AuthUser } from './api';
import {
    AcademicsPage,
    AccountantPage,
    AttendancePage,
    BillSettingsPage,
    InstitutionApp,
    InstitutionCreate,
    InstitutionDetail,
    InstitutionHome,
    InstitutionList,
    InvoicesPage,
    MarksPage,
    NoticesPage,
    PaymentsPage,
    PlansPage,
    PlatformApp,
    PlatformHome,
    SettingsPage,
    StudentsPage,
    TeachersPage,
    publishAuth,
} from './workspace';
import { StaffPage } from './staff-page';
import { PendingPage, RecordPage } from './records';

interface AuthContextValue {
    user: AuthUser | null;
    setUser: (user: AuthUser | null) => void;
    loading: boolean;
    error: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error('useAuth must be used within AuthProvider.');
    }

    return context;
}

function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        api.get<{ user: AuthUser }>('/api/user')
            .then(({ data }) => {
                if (isMounted) {
                    setUser(data.user);
                }
            })
            .catch((requestError: unknown) => {
                if (!isMounted) {
                    return;
                }

                if (axios.isAxiosError(requestError) && requestError.response?.status === 401) {
                    setUser(null);
                    return;
                }

                setError(getErrorMessage(requestError, 'Unable to verify your sign-in. Please refresh and try again.'));
            })
            .finally(() => {
                if (isMounted) {
                    setLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, []);

    publishAuth({ user, setUser });

    return (
        <AuthContext.Provider value={{ user, setUser, loading, error }}>
            {children}
        </AuthContext.Provider>
    );
}

function LoadingScreen() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                <span className="size-5 animate-spin rounded-full border-2 border-blue-100 border-t-blue-700" />
                <span className="text-sm font-medium">Checking your workspace…</span>
            </div>
        </div>
    );
}

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/" element={<LoginPage />} />
                    <Route
                        element={
                            <ProtectedRoute audience="platform">
                                <PlatformApp />
                            </ProtectedRoute>
                        }
                    >
                        <Route path="/admin/dashboard" element={<PlatformHome />} />
                        <Route path="/admin/institutions" element={<InstitutionList />} />
                        <Route path="/admin/institutions/create" element={<InstitutionCreate />} />
                        <Route path="/admin/institutions/:id" element={<InstitutionDetail />} />
                        <Route path="/admin/plans" element={<PlansPage />} />
                        <Route path="/admin/users" element={<RecordPage title="Institution users" detail="Accounts across every institution." url="/api/admin/users" />} />
                        <Route path="/admin/institution-categories" element={<RecordPage title="Institution categories" detail="Counts use the institution type stored on each campus." url="/api/admin/institution-categories" />} />
                        <Route path="/admin/subscriptions" element={<RecordPage title="Subscriptions" detail="Active and historical institution subscriptions." url="/api/admin/subscriptions" />} />
                        <Route path="/admin/subscriptions/expiring" element={<RecordPage title="Expiring subscriptions" detail="Active subscriptions that end within 30 days." url="/api/admin/subscriptions?expiring=1" />} />
                        <Route path="/admin/modules" element={<RecordPage title="Module management" detail="Modules enabled for each institution." url="/api/admin/modules" />} />
                        <Route path="/admin/roles" element={<PendingPage title="Roles and permissions" detail="Platform roles are Platform Super Admin, IT Administrator, and IT Support. Institution roles are managed inside each school." />} />
                        <Route path="/admin/support" element={<PendingPage title="Support and requests" detail="A support ticket inbox is not stored yet. Institution activity is available in Activity Logs." />} />
                        <Route path="/admin/reports" element={<PlatformHome />} />
                        <Route path="/admin/activity-logs" element={<RecordPage title="Activity logs" detail="Sensitive platform and institution actions." url="/api/admin/activity-logs" />} />
                        <Route path="/admin/profile" element={<SettingsPage />} />
                        <Route path="/admin/settings" element={<SettingsPage />} />
                        <Route path="/admin/maintenance" element={<PendingPage title="Backup and maintenance" detail="Scheduled backups are not configured in this environment. Database migrations remain the source of schema changes." />} />
                    </Route>
                    <Route
                        element={
                            <ProtectedRoute audience="institution">
                                <InstitutionApp />
                            </ProtectedRoute>
                        }
                    >
                        <Route path="/dashboard" element={<InstitutionHome />} />
                        <Route path="/students" element={<StudentsPage />} />
                        <Route path="/students/create" element={<StudentsPage />} />
                        <Route path="/teachers" element={<TeachersPage />} />
                        <Route path="/staff" element={<StaffPage />} />
                        <Route path="/academics" element={<AcademicsPage />} />
                        <Route path="/classes" element={<AcademicsPage />} />
                        <Route path="/subjects" element={<AcademicsPage />} />
                        <Route path="/academic-sessions" element={<AcademicsPage />} />
                        <Route path="/sections" element={<AcademicsPage />} />
                        <Route path="/timetable" element={<PendingPage title="Timetable" detail="Class and subject assignments exist. A period-by-period timetable is not stored yet." />} />
                        <Route path="/attendance" element={<AttendancePage />} />
                        <Route path="/attendance/students" element={<AttendancePage />} />
                        <Route path="/attendance/teachers" element={<PendingPage title="Teacher attendance" detail="Student attendance is recorded today. Teacher attendance records are not stored yet." />} />
                        <Route path="/attendance/reports" element={<RecordPage title="Attendance reports" detail="Recent student attendance for this institution." url="/api/institution/attendance" />} />
                        <Route path="/invoices" element={<InvoicesPage />} />
                        <Route path="/fee-structures" element={<InvoicesPage />} />
                        <Route path="/payments" element={<PaymentsPage />} />
                        <Route path="/fee-collection" element={<PaymentsPage />} />
                        <Route path="/outstanding-fees" element={<InvoicesPage />} />
                        <Route path="/accounting/transactions" element={<RecordPage title="Income and expenses" detail="Posted journal entries for this institution." url="/api/institution/ledger" />} />
                        <Route path="/accounting/cashbook" element={<RecordPage title="Cashbook and bank" detail="Journal lines posted to cash and bank." url="/api/institution/ledger" />} />
                        <Route path="/accounting/reports" element={<AccountantPage />} />
                        <Route path="/notices" element={<NoticesPage />} />
                        <Route path="/documents" element={<PendingPage title="Documents" detail="Document storage for this institution is not enabled yet." />} />
                        <Route path="/users" element={<RecordPage title="User management" detail="People who can sign in to this institution." url="/api/institution/users" />} />
                        <Route path="/roles" element={<RecordPage title="Roles and permissions" detail="Roles configured for this institution." url="/api/institution/roles" />} />
                        <Route path="/reports" element={<InstitutionHome />} />
                        <Route path="/bill-settings" element={<BillSettingsPage />} />
                        <Route path="/accountant/dashboard" element={<AccountantPage />} />
                        <Route path="/teacher/dashboard" element={<MarksPage />} />
                        <Route path="/marks" element={<MarksPage />} />
                        <Route path="/examinations" element={<MarksPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="/profile" element={<SettingsPage />} />
                    </Route>
                    <Route path="*" element={<WorkspaceRedirect />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    );
}

function ProtectedRoute({ audience, children }: { audience: AuthUser['audience']; children: ReactNode }) {
    const { user, loading, error } = useAuth();

    if (loading) {
        return <LoadingScreen />;
    }

    if (error) {
        return <ErrorScreen message={error} />;
    }

    if (!user) {
        return <Navigate to="/" replace />;
    }

    if (user.audience !== audience) {
        return <Navigate to={user.redirect_to} replace />;
    }

    return children;
}

function WorkspaceRedirect() {
    const { user, loading, error } = useAuth();

    if (loading) {
        return <LoadingScreen />;
    }

    if (error) {
        return <ErrorScreen message={error} />;
    }

    return <Navigate to={user?.redirect_to ?? '/'} replace />;
}

function LoginPage() {
    const { user, loading, error: sessionError, setUser } = useAuth();
    const navigate = useNavigate();
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [remember, setRemember] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [helpOpen, setHelpOpen] = useState(false);

    if (loading) {
        return <LoadingScreen />;
    }

    if (user) {
        return <Navigate to={user.redirect_to} replace />;
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError(null);
        setSubmitting(true);

        try {
            await api.get('/sanctum/csrf-cookie');
            const { data } = await api.post<{ user: AuthUser }>('/api/login', {
                login,
                password,
                remember,
            });

            setUser(data.user);
            navigate(data.user.redirect_to, { replace: true });
        } catch (requestError: unknown) {
            setError(getErrorMessage(requestError, 'Sign-in failed. Please try again.'));
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="min-h-screen bg-[#f5f7fb] text-slate-900">
            <div className="grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
                <section className="relative hidden overflow-hidden bg-[#102a56] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
                    <div className="absolute -right-32 -top-32 size-[28rem] rounded-full border border-white/10" />
                    <div className="absolute -right-16 -top-16 size-[20rem] rounded-full border border-white/10" />
                    <div className="absolute -bottom-56 -left-32 size-[36rem] rounded-full bg-blue-500/10 blur-2xl" />

                    <Brand dark />

                    <div className="relative z-10 max-w-xl">
                        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-blue-100">
                            <ShieldCheck className="size-4" />
                            A connected campus, in one place
                        </div>
                        <h1 className="max-w-lg text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
                            More time for learning. Less time managing.
                        </h1>
                        <p className="mt-5 max-w-lg text-base leading-7 text-blue-100/80">
                            A secure academic workspace for the people who make education happen.
                        </p>

                        <div className="mt-10 grid max-w-lg grid-cols-2 gap-3">
                            <FeatureTile icon={<School className="size-4" />} title="One campus" detail="A workspace for your institution" />
                            <FeatureTile icon={<Activity className="size-4" />} title="Clear overview" detail="Your work, organized and in reach" />
                        </div>
                    </div>

                    <p className="relative z-10 text-xs text-blue-100/55">
                        Secure access for education teams
                    </p>
                </section>

                <section className="flex min-h-screen flex-col justify-center px-5 py-10 sm:px-10 lg:px-14 xl:px-24">
                    <div className="mx-auto w-full max-w-md">
                        <div className="mb-10 lg:hidden">
                            <Brand />
                        </div>

                        <div className="mb-8">
                            <div className="mb-5 inline-flex size-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                                <LockKeyhole className="size-5" />
                            </div>
                            <h2 className="text-3xl font-semibold tracking-tight">Welcome back</h2>
                            <p className="mt-2 text-sm leading-6 text-slate-500">
                                Sign in to continue to your secure workspace.
                            </p>
                        </div>

                        {(error || sessionError) && (
                            <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                {error ?? sessionError}
                            </div>
                        )}

                        <form className="space-y-5" onSubmit={handleSubmit}>
                            <div>
                                <label htmlFor="login" className="mb-2 block text-sm font-medium text-slate-700">
                                    Email or username
                                </label>
                                <input
                                    id="login"
                                    name="login"
                                    autoComplete="username"
                                    required
                                    value={login}
                                    onChange={(event) => setLogin(event.target.value)}
                                    className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                    placeholder="you@institution.edu"
                                />
                            </div>

                            <div>
                                <div className="mb-2 flex items-center justify-between">
                                    <label htmlFor="password" className="text-sm font-medium text-slate-700">
                                        Password
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setHelpOpen((open) => !open)}
                                        className="text-xs font-medium text-blue-700 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
                                    >
                                        Forgot password?
                                    </button>
                                </div>
                                <div className="relative">
                                    <input
                                        id="password"
                                        name="password"
                                        type={showPassword ? 'text' : 'password'}
                                        autoComplete="current-password"
                                        required
                                        value={password}
                                        onChange={(event) => setPassword(event.target.value)}
                                        className="h-12 w-full rounded-xl border border-slate-200 bg-white px-4 pr-12 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                        placeholder="Enter your password"
                                    />
                                    <button
                                        type="button"
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        onClick={() => setShowPassword((visible) => !visible)}
                                        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-700"
                                    >
                                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                                    </button>
                                </div>
                            </div>

                            {helpOpen && (
                                <ForgotPassword />
                            )}

                            <label className="flex w-fit cursor-pointer items-center gap-2.5 text-sm text-slate-600">
                                <input
                                    type="checkbox"
                                    checked={remember}
                                    onChange={(event) => setRemember(event.target.checked)}
                                    className="size-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                                />
                                Keep me signed in
                            </label>

                            <button
                                type="submit"
                                disabled={submitting}
                                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {submitting ? (
                                    <>
                                        <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                                        Signing in…
                                    </>
                                ) : (
                                    <>
                                        Sign in <ArrowRight className="size-4" />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-8 flex items-center gap-2 text-xs text-slate-400">
                            <ShieldCheck className="size-4" />
                            Your account and institution data are protected.
                        </div>
                    </div>
                    <p className="mt-auto pt-12 text-center text-xs text-slate-400">
                        Academic workspace · Secure sign-in
                    </p>
                </section>
            </div>
        </main>
    );
}

function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState<string | null>(null);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const { data } = await api.post<{ message: string }>('/api/forgot-password', { email });
        setMessage(data.message);
    }

    return (
        <form onSubmit={submit} className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
            <p className="text-sm text-blue-900">Enter your account email. If it matches a user, a reset link is sent.</p>
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required className="mt-2 h-10 w-full rounded-lg border border-blue-100 px-3 text-sm" />
            <button className="mt-2 text-sm font-semibold text-blue-800">Send reset link</button>
            {message && <p className="mt-2 text-sm text-blue-900">{message}</p>}
        </form>
    );
}

function FeatureTile({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-3 inline-flex size-8 items-center justify-center rounded-lg bg-white/10 text-blue-100">
                {icon}
            </div>
            <p className="text-sm font-medium">{title}</p>
            <p className="mt-1 text-xs leading-5 text-blue-100/65">{detail}</p>
        </div>
    );
}

function Brand({ dark = false }: { dark?: boolean }) {
    return (
        <Link to="/" className="inline-flex w-fit items-center gap-3" aria-label="Campus OS home">
            <span className={`flex size-10 items-center justify-center rounded-xl ${dark ? 'bg-white/10 text-white' : 'bg-blue-700 text-white'}`}>
                <GraduationCap className="size-5" />
            </span>
            <span>
                <span className={`block text-sm font-semibold tracking-wide ${dark ? 'text-white' : 'text-slate-900'}`}>Campus OS</span>
                <span className={`block text-xs ${dark ? 'text-blue-100/65' : 'text-slate-500'}`}>Academic workspace</span>
            </span>
        </Link>
    );
}
function ErrorScreen({ message }: { message: string }) {
    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
            <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
                <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-rose-50 text-rose-700">
                    <X className="size-5" />
                </div>
                <h1 className="mt-4 text-lg font-semibold text-slate-900">We couldn’t verify your session</h1>
                <p className="mt-2 text-sm leading-6 text-slate-500">{message}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
                >
                    Try again <ArrowRight className="size-4" />
                </button>
            </div>
        </main>
    );
}

export default App;
