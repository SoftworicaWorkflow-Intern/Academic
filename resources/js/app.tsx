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
    BookOpen,
    Building2,
    Check,
    ChevronRight,
    Eye,
    EyeOff,
    GraduationCap,
    LayoutDashboard,
    LockKeyhole,
    LogOut,
    Menu,
    School,
    ShieldCheck,
    Users,
    X,
} from 'lucide-react';
import {
    BrowserRouter,
    Link,
    Navigate,
    Route,
    Routes,
    useLocation,
    useNavigate,
} from 'react-router-dom';
import { api, getErrorMessage, type AuthUser, type InstitutionDashboard, type PlatformDashboard } from './api';

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
                        path="/admin/*"
                        element={
                            <ProtectedRoute audience="platform">
                                <PlatformDashboardPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/dashboard"
                        element={
                            <ProtectedRoute audience="institution">
                                <InstitutionDashboardPage />
                            </ProtectedRoute>
                        }
                    />
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
                                <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-5 text-blue-900">
                                    Contact your institution administrator or platform support to reset your access.
                                </p>
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

interface NavigationItem {
    label: string;
    to: string;
    icon: typeof LayoutDashboard;
}

const platformNavigation: NavigationItem[] = [
    { label: 'Overview', to: '/admin/dashboard', icon: LayoutDashboard },
    { label: 'Institutions', to: '/admin/institutions', icon: Building2 },
    { label: 'Users', to: '/admin/users', icon: Users },
];

const institutionNavigation: NavigationItem[] = [
    { label: 'Overview', to: '/dashboard', icon: LayoutDashboard },
    { label: 'Students', to: '/students', icon: GraduationCap },
    { label: 'Academics', to: '/academics', icon: BookOpen },
];

function WorkspaceLayout({
    audience,
    title,
    subtitle,
    children,
}: {
    audience: AuthUser['audience'];
    title: string;
    subtitle: string;
    children: ReactNode;
}) {
    const { user, setUser } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [menuOpen, setMenuOpen] = useState(false);
    const [logoutError, setLogoutError] = useState<string | null>(null);
    const navigation = audience === 'platform' ? platformNavigation : institutionNavigation;
    const isPlatform = audience === 'platform';

    async function handleLogout() {
        setLogoutError(null);

        try {
            await api.post('/api/logout');
            setUser(null);
            navigate('/', { replace: true });
        } catch (requestError: unknown) {
            setLogoutError(getErrorMessage(requestError, 'Unable to sign out. Please try again.'));
        }
    }

    return (
        <div className="min-h-screen bg-[#f5f7fb] text-slate-900 lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
            {menuOpen && (
                <button
                    aria-label="Close navigation"
                    className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden"
                    onClick={() => setMenuOpen(false)}
                />
            )}
            <aside className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-slate-200 bg-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="flex h-20 items-center border-b border-slate-100 px-5">
                    <Brand />
                    <button
                        aria-label="Close navigation"
                        className="ml-auto rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
                        onClick={() => setMenuOpen(false)}
                    >
                        <X className="size-4" />
                    </button>
                </div>

                <div className="px-4 pt-6">
                    <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {isPlatform ? 'Platform management' : 'Institution workspace'}
                    </p>
                    <nav className="space-y-1">
                        {navigation.map((item) => {
                            const Icon = item.icon;
                            const active = location.pathname === item.to
                                || (item.to !== '/dashboard' && location.pathname.startsWith(`${item.to}/`));

                            return (
                                <Link
                                    key={item.label}
                                    to={item.to}
                                    onClick={() => setMenuOpen(false)}
                                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? 'bg-blue-50 text-blue-800' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                                >
                                    <Icon className={`size-[18px] ${active ? 'text-blue-700' : 'text-slate-400'}`} />
                                    {item.label}
                                    {active && <ChevronRight className="ml-auto size-4 text-blue-500" />}
                                </Link>
                            );
                        })}
                    </nav>
                </div>

                <div className="mt-auto p-4">
                    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                            <ShieldCheck className="size-4 text-emerald-600" />
                            Protected workspace
                        </div>
                        <p className="mt-2 text-xs leading-5 text-slate-500">
                            {isPlatform ? 'Platform access is restricted to authorized staff.' : 'Your workspace is isolated to your institution.'}
                        </p>
                    </div>
                </div>
            </aside>

            <div className="min-w-0">
                <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-7">
                    <div className="flex min-w-0 items-center gap-3">
                        <button
                            aria-label="Open navigation"
                            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
                            onClick={() => setMenuOpen(true)}
                        >
                            <Menu className="size-5" />
                        </button>
                        <span className="hidden text-xs text-slate-400 sm:inline">{isPlatform ? 'Platform' : user?.institution?.name}</span>
                        <ChevronRight className="hidden size-3.5 text-slate-300 sm:block" />
                        <span className="truncate text-sm font-semibold text-slate-800">{title}</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="hidden text-right sm:block">
                            <p className="text-xs font-semibold text-slate-800">{user?.name}</p>
                            <p className="text-[11px] text-slate-400">{user?.roles[0]?.replaceAll('-', ' ')}</p>
                        </div>
                        <span className="flex size-9 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold uppercase text-blue-800">
                            {user?.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('')}
                        </span>
                        <button
                            onClick={handleLogout}
                            aria-label="Sign out"
                            title="Sign out"
                            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-blue-700"
                        >
                            <LogOut className="size-4" />
                        </button>
                    </div>
                </header>

                <main className="mx-auto max-w-[1440px] px-4 py-7 sm:px-7 sm:py-9">
                    {logoutError && (
                        <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {logoutError}
                        </div>
                    )}
                    <div className="mb-7">
                        <p className="text-sm text-slate-500">{subtitle}</p>
                        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
                    </div>
                    {children}
                </main>
            </div>
        </div>
    );
}

function PlatformDashboardPage() {
    const [dashboard, setDashboard] = useState<PlatformDashboard | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        api.get<{ data: PlatformDashboard }>('/api/admin/dashboard')
            .then(({ data }) => {
                if (isMounted) {
                    setDashboard(data.data);
                }
            })
            .catch((requestError: unknown) => {
                if (isMounted) {
                    setError(getErrorMessage(requestError, 'Unable to load platform metrics.'));
                }
            });

        return () => {
            isMounted = false;
        };
    }, []);

    return (
        <WorkspaceLayout
            audience="platform"
            title="Platform overview"
            subtitle="A real-time view of your academic platform."
        >
            {error ? (
                <ErrorPanel message={error} />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="Institutions" value={dashboard?.institutions_total} icon={<Building2 className="size-5" />} loading={!dashboard} />
                    <MetricCard label="Active institutions" value={dashboard?.institutions_active} icon={<School className="size-5" />} loading={!dashboard} />
                    <MetricCard label="Registered users" value={dashboard?.users_total} icon={<Users className="size-5" />} loading={!dashboard} />
                    <MetricCard label="Active accounts" value={dashboard?.users_active} icon={<Check className="size-5" />} loading={!dashboard} />
                </div>
            )}
            <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <div className="flex items-start gap-4">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                        <Building2 className="size-5" />
                    </span>
                    <div>
                        <h2 className="text-sm font-semibold text-slate-900">Platform workspace</h2>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                            Platform and institution access use separate permissions and layouts. Institution onboarding and subscription management will be added in the next phase.
                        </p>
                    </div>
                </div>
            </div>
        </WorkspaceLayout>
    );
}

function InstitutionDashboardPage() {
    const [dashboard, setDashboard] = useState<InstitutionDashboard | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        api.get<{ data: InstitutionDashboard }>('/api/institution/dashboard')
            .then(({ data }) => {
                if (isMounted) {
                    setDashboard(data.data);
                }
            })
            .catch((requestError: unknown) => {
                if (isMounted) {
                    setError(getErrorMessage(requestError, 'Unable to load your institution workspace.'));
                }
            });

        return () => {
            isMounted = false;
        };
    }, []);

    return (
        <WorkspaceLayout
            audience="institution"
            title="Institution overview"
            subtitle={dashboard?.institution.name ?? 'Your institution workspace.'}
        >
            {error ? (
                <ErrorPanel message={error} />
            ) : dashboard ? (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
                    <section className="rounded-2xl border border-slate-200 bg-white p-6">
                        <div className="flex items-start gap-4">
                            <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                                <School className="size-6" />
                            </span>
                            <div className="min-w-0">
                                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Your institution</p>
                                <h2 className="mt-1 truncate text-xl font-semibold text-slate-900">{dashboard.institution.name}</h2>
                                <p className="mt-1 text-sm text-slate-500">
                                    {dashboard.institution.type} <span className="px-1 text-slate-300">·</span> {dashboard.institution.institution_code}
                                </p>
                            </div>
                        </div>
                        <div className="mt-7 border-t border-slate-100 pt-5">
                            <p className="text-sm font-medium text-slate-800">Workspace ready</p>
                            <p className="mt-1 text-sm leading-6 text-slate-500">
                                You are signed in as {dashboard.user.name}. Academic modules will appear here as they are enabled.
                            </p>
                        </div>
                    </section>
                    <section className="rounded-2xl border border-blue-100 bg-blue-50/70 p-6">
                        <div className="flex size-10 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm">
                            <ShieldCheck className="size-5" />
                        </div>
                        <h2 className="mt-4 text-sm font-semibold text-slate-900">Institution data stays separate</h2>
                        <p className="mt-2 text-sm leading-6 text-slate-600">
                            This workspace is resolved from your signed-in account. Institution context is never accepted from a browser-submitted ID.
                        </p>
                    </section>
                </div>
            ) : (
                <div className="h-40 animate-pulse rounded-2xl bg-white" />
            )}
        </WorkspaceLayout>
    );
}

function MetricCard({
    label,
    value,
    icon,
    loading,
}: {
    label: string;
    value: number | undefined;
    icon: ReactNode;
    loading: boolean;
}) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">{icon}</span>
                <span className="text-xs font-medium text-slate-400">All time</span>
            </div>
            <p className="mt-5 text-sm text-slate-500">{label}</p>
            {loading ? (
                <div className="mt-2 h-8 w-20 animate-pulse rounded-md bg-slate-100" />
            ) : (
                <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{value?.toLocaleString()}</p>
            )}
        </div>
    );
}

function ErrorPanel({ message }: { message: string }) {
    return (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
            {message}
        </div>
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
