import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export interface NavItem {
    label: string;
    to: string;
    permission?: string | null;
    any?: string[];
}

export interface NavGroup {
    label: string;
    icon: LucideIcon;
    items: NavItem[];
}

export function AppSidebar({
    groups,
    collapsed,
    onNavigate,
}: {
    groups: NavGroup[];
    collapsed: boolean;
    onNavigate: () => void;
}) {
    const location = useLocation();
    const paths = groups.flatMap((group) => group.items.map((item) => item.to));
    const [openGroups, setOpenGroups] = useState<string[]>([]);

    useEffect(() => {
        const active = groups.filter((group) => group.items.some((item) => isActive(location.pathname, item.to, paths))).map((group) => group.label);
        setOpenGroups((current) => {
            const next = Array.from(new Set([...current, ...active]));

            return next.length === current.length && next.every((label, index) => label === current[index]) ? current : next;
        });
    }, [location.pathname, groups, paths]);

    return (
        <nav className="space-y-3 overflow-y-auto px-3 pb-6" aria-label="Sidebar">
            {groups.map((group) => {
                const Icon = group.icon;
                const expanded = openGroups.includes(group.label);
                const groupActive = group.items.some((item) => isActive(location.pathname, item.to, paths));

                if (group.items.length === 1) {
                    const item = group.items[0];
                    const active = isActive(location.pathname, item.to, paths);

                    return (
                        <Link
                            key={group.label}
                            to={item.to}
                            title={collapsed ? item.label : undefined}
                            onClick={onNavigate}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium ${active ? 'bg-blue-50 text-blue-800' : 'text-slate-700 hover:bg-slate-100'}`}
                        >
                            <Icon className="size-4 shrink-0" />
                            {!collapsed && item.label}
                        </Link>
                    );
                }

                return (
                    <section key={group.label}>
                        <button
                            type="button"
                            aria-expanded={expanded}
                            title={collapsed ? group.label : undefined}
                            onClick={() => setOpenGroups((current) => current.includes(group.label) ? current.filter((label) => label !== group.label) : [...current, group.label])}
                            className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-medium ${groupActive ? 'text-blue-800' : 'text-slate-700 hover:bg-slate-100'}`}
                        >
                            <Icon className="size-4 shrink-0" />
                            {!collapsed && <span className="truncate">{group.label}</span>}
                            {!collapsed && <ChevronDown className={`ml-auto size-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />}
                        </button>
                        <AnimatePresence initial={false}>
                            {expanded && !collapsed && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.18 }}
                                    className="overflow-hidden"
                                >
                                    <div className="mt-1 space-y-0.5 pl-4">
                                        {group.items.map((item) => {
                                            const active = isActive(location.pathname, item.to, paths);

                                            return (
                                                <Link
                                                    key={item.to}
                                                    to={item.to}
                                                    onClick={onNavigate}
                                                    className={`block rounded-lg px-3 py-2 text-sm ${active ? 'bg-blue-50 font-medium text-blue-800' : 'text-slate-600 hover:bg-slate-100'}`}
                                                >
                                                    {item.label}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        {collapsed && (
                            <div className="mt-1 space-y-1">
                                {group.items.map((item) => (
                                    <Link key={item.to} to={item.to} title={item.label} onClick={onNavigate} className={`block rounded-lg px-3 py-2 text-center text-xs ${isActive(location.pathname, item.to, paths) ? 'bg-blue-50 text-blue-800' : 'text-slate-500 hover:bg-slate-100'}`}>
                                        {item.label.slice(0, 1)}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </section>
                );
            })}
        </nav>
    );
}

function isActive(pathname: string, to: string, all: string[]): boolean {
    if (pathname === to) {
        return true;
    }

    if (!pathname.startsWith(`${to}/`)) {
        return false;
    }

    return !all.some((other) => other !== to && other.startsWith(to) && (pathname === other || pathname.startsWith(`${other}/`)));
}

export function visibleGroups(groups: NavGroup[], permissions: string[], roles: string[]): NavGroup[] {
    return groups
        .map((group) => ({
            ...group,
            items: group.items.filter((item) => {
                if (item.permission === 'institution-admin') {
                    return roles.includes('institution-admin');
                }

                if (item.any && item.any.length > 0) {
                    return item.any.some((permission) => permissions.includes(permission));
                }

                return !item.permission || permissions.includes(item.permission);
            }),
        }))
        .filter((group) => group.items.length > 0);
}

export function NotePage({ title, detail, children }: { title: string; detail: string; children?: ReactNode }) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{detail}</p>
            {children}
        </section>
    );
}
