'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Menu, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { adminNavigationGroups } from './admin-navigation';

type AdminWorkspaceShellProps = {
    children: ReactNode;
    alphaNotice?: ReactNode;
};

function isActivePath(pathname: string, href: string): boolean {
    return href === '/services/admin'
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminWorkspaceShell({ children, alphaNotice }: AdminWorkspaceShellProps) {
    const pathname = usePathname() || '/services/admin';
    const [mobileOpen, setMobileOpen] = useState(false);
    const [collapsed, setCollapsed] = useState(false);
    const drawerRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!mobileOpen) return undefined;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setMobileOpen(false);
        };
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', onKeyDown);
        drawerRef.current?.querySelector<HTMLElement>('a,button')?.focus();

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [mobileOpen]);

    function renderNavigation(isCollapsed: boolean) {
        return (
        <nav aria-label="Admin workspace" className="flex flex-1 flex-col gap-7 overflow-y-auto px-3 py-5">
            {adminNavigationGroups.map((group) => (
                <div key={group.label}>
                    <p className={`mb-2 px-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500 ${isCollapsed ? 'lg:sr-only' : ''}`}>
                        {group.label}
                    </p>
                    <div className="space-y-1">
                        {group.items.map((item) => {
                            const Icon = item.icon;
                            const active = isActivePath(pathname, item.href);

                            return (
                                <Link
                                    key={item.key}
                                    href={item.href}
                                    onClick={() => setMobileOpen(false)}
                                    aria-current={active ? 'page' : undefined}
                                    title={isCollapsed ? item.label : undefined}
                                    className={`group flex min-h-11 items-center gap-3 border px-3 py-2.5 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 ${active
                                        ? 'border-amber-200/35 bg-amber-200/[0.1] text-amber-50'
                                        : 'border-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.05] hover:text-white'}`}
                                >
                                    <Icon size={17} aria-hidden="true" className="shrink-0" />
                                    <span className={isCollapsed ? 'lg:sr-only' : ''}>{item.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            ))}
        </nav>
        );
    }

    return (
        <div className="min-h-dvh bg-[#09111f] text-slate-100">
            <div className="flex min-h-dvh">
                <aside
                    className={`hidden shrink-0 flex-col border-r border-white/10 bg-[#0c1729] lg:flex ${collapsed ? 'w-[4.75rem]' : 'w-64'}`}
                >
                    <div className="flex min-h-16 items-center justify-between border-b border-white/10 px-3">
                        <Link href="/services/admin" className={`flex items-center gap-3 text-sm font-semibold text-white ${collapsed ? 'lg:mx-auto' : ''}`}>
                            <span className="grid size-8 place-items-center border border-amber-200/30 bg-amber-200/10 text-amber-100">OSR</span>
                            <span className={collapsed ? 'lg:sr-only' : ''}>Admin workspace</span>
                        </Link>
                        <button
                            type="button"
                            onClick={() => setCollapsed((value) => !value)}
                            className="grid size-9 place-items-center text-slate-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
                            aria-label={collapsed ? 'Expand admin sidebar' : 'Collapse admin sidebar'}
                        >
                            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
                        </button>
                    </div>
                    {renderNavigation(collapsed)}
                    <div className="border-t border-white/10 p-3">
                        <Link href="/" className="flex min-h-11 items-center gap-3 border border-white/10 px-3 py-2.5 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">
                            <ArrowLeft size={17} aria-hidden="true" />
                            <span className={collapsed ? 'lg:sr-only' : ''}>Back to portal</span>
                        </Link>
                    </div>
                </aside>

                {mobileOpen ? (
                    <>
                        <button type="button" aria-label="Close admin navigation" className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileOpen(false)} />
                        <aside ref={drawerRef} className="fixed inset-y-0 left-0 z-50 flex w-[min(18rem,88vw)] flex-col border-r border-white/10 bg-[#0c1729] shadow-2xl lg:hidden" aria-label="Admin workspace navigation">
                            <div className="flex min-h-16 items-center justify-between border-b border-white/10 px-4">
                                <p className="text-sm font-semibold text-white">Admin workspace</p>
                                <button type="button" onClick={() => setMobileOpen(false)} className="grid size-9 place-items-center text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200" aria-label="Close admin navigation">
                                    <X size={18} />
                                </button>
                            </div>
                            {renderNavigation(false)}
                        </aside>
                    </>
                ) : null}

                <div className="min-w-0 flex-1">
                    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#09111f]/95 backdrop-blur">
                        <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
                            <button type="button" onClick={() => setMobileOpen(true)} className="grid size-10 place-items-center border border-white/10 text-slate-200 lg:hidden" aria-label="Open admin navigation">
                                <Menu size={19} />
                            </button>
                            <div className="min-w-0">
                                <p className="truncate text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-amber-200">RTU officer workspace</p>
                            </div>
                        </div>
                        {alphaNotice ? <div className="border-t border-red-300/20">{alphaNotice}</div> : null}
                    </header>
                    <div className="min-w-0 px-4 pb-16 pt-5 sm:px-6 lg:px-8 lg:pt-7">{children}</div>
                </div>
            </div>
        </div>
    );
}
