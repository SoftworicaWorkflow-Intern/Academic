import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, KeyRound, LogOut, Menu, Palette, Settings, UserRound } from 'lucide-react';
import NepaliDate from 'nepali-date-converter';
import { Link } from 'react-router-dom';
import type { AuthUser } from './api';

interface TopNavbarProps {
    user: AuthUser | null;
    onOpenMenu: () => void;
    onLogout: () => void;
}

export function TopNavbar({ user, onOpenMenu, onLogout }: TopNavbarProps) {
    const [now, setNow] = useState(() => new Date());
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
    const barRef = useRef<HTMLElement>(null);
    const profilePath = user?.audience === 'platform' ? '/admin/profile' : '/profile';
    const passwordPath = user?.audience === 'platform' ? '/admin/settings' : '/settings';

    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 1000);

        return () => window.clearInterval(timer);
    }, []);

    useEffect(() => {
        document.documentElement.classList.toggle('dark', dark);
        localStorage.setItem('theme', dark ? 'dark' : 'light');
    }, [dark]);

    useEffect(() => {
        function close(event: MouseEvent) {
            if (!barRef.current?.contains(event.target as Node)) {
                setSettingsOpen(false);
                setProfileOpen(false);
            }
        }

        document.addEventListener('mousedown', close);

        return () => document.removeEventListener('mousedown', close);
    }, []);

    const time = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kathmandu',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    }).format(now);
    const nepalDay = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kathmandu',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(now);
    const bsDate = new NepaliDate(new Date(`${nepalDay}T12:00:00+05:45`)).format('DD MMMM YYYY', 'en');
    const role = user?.roles[0]?.replaceAll('-', ' ') ?? 'Member';
    const initials = user?.name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'U';

    return (
        <header ref={barRef} className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-3 sm:px-5 dark:border-slate-800 dark:bg-slate-950">
            <button className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800" aria-label="Open navigation" onClick={onOpenMenu}>
                <Menu className="size-5" />
            </button>
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
                <div className="min-w-0 text-right">
                    <p className="text-sm font-semibold tracking-wide text-slate-800 tabular-nums dark:text-slate-100">{time}</p>
                    <p className="truncate text-xs text-slate-500">{bsDate}</p>
                </div>
                <div className="relative">
                    <button
                        aria-label="Settings"
                        aria-expanded={settingsOpen}
                        onClick={() => {
                            setSettingsOpen((open) => !open);
                            setProfileOpen(false);
                        }}
                        className="flex size-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                        <Settings className="size-5" />
                    </button>
                    <Dropdown open={settingsOpen}>
                        <MenuLink to={profilePath} icon={<UserRound className="size-4" />} label="Profile settings" onClick={() => setSettingsOpen(false)} />
                        <MenuLink to={passwordPath} icon={<KeyRound className="size-4" />} label="Change password" onClick={() => setSettingsOpen(false)} />
                        <button type="button" onClick={() => setDark((value) => !value)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                            <Palette className="size-4" />
                            Theme preferences
                            <span className="ml-auto text-xs text-slate-400">{dark ? 'Dark' : 'Light'}</span>
                        </button>
                        <MenuLink to={passwordPath} icon={<Settings className="size-4" />} label="Account settings" onClick={() => setSettingsOpen(false)} />
                    </Dropdown>
                </div>
                <div className="relative">
                    <button
                        aria-expanded={profileOpen}
                        onClick={() => {
                            setProfileOpen((open) => !open);
                            setSettingsOpen(false);
                        }}
                        className="flex items-center gap-2 rounded-full bg-slate-100 py-1 pr-2 pl-1 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                    >
                        <span className="flex size-8 items-center justify-center rounded-full bg-blue-700 text-xs font-semibold text-white">{initials}</span>
                        <span className="hidden text-left sm:block">
                            <span className="block max-w-40 truncate text-sm font-medium text-slate-800 dark:text-slate-100">{user?.name}</span>
                            <span className="block max-w-40 truncate text-[11px] capitalize text-slate-500">{role}</span>
                        </span>
                        <ChevronDown className="size-4 text-slate-500" />
                    </button>
                    <Dropdown open={profileOpen}>
                        <MenuLink to={profilePath} icon={<UserRound className="size-4" />} label="View profile" onClick={() => setProfileOpen(false)} />
                        <MenuLink to={profilePath} icon={<UserRound className="size-4" />} label="Edit profile" onClick={() => setProfileOpen(false)} />
                        <MenuLink to={passwordPath} icon={<KeyRound className="size-4" />} label="Change password" onClick={() => setProfileOpen(false)} />
                        <button type="button" onClick={onLogout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
                            <LogOut className="size-4" />
                            Log out
                        </button>
                    </Dropdown>
                </div>
            </div>
        </header>
    );
}

function Dropdown({ open, children }: { open: boolean; children: ReactNode }) {
    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.16 }}
                    className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
}

function MenuLink({ to, icon, label, onClick }: { to: string; icon: ReactNode; label: string; onClick: () => void }) {
    return (
        <Link to={to} onClick={onClick} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
            {icon}
            {label}
        </Link>
    );
}
