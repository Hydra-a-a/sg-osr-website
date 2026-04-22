'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, LogOut, Menu, Shield, ShieldAlert, User, X } from 'lucide-react';
import AlertBanner from './AlertBanner';
import { SiteConfig } from '@/lib/slideConfig';
import {
    deriveEffectivePortalRole,
    hasLeaderPrivilege,
    hasOfficerPrivilege,
    LEADER_ATTEMPT_COOKIE,
    OFFICER_ATTEMPT_COOKIE,
    PORTAL_MODE_COOKIE,
    shouldShowLeaderAccessDeniedNotice,
    shouldShowOfficerAccessNotice,
} from '@/lib/portal-mode';

const baseNavLinks = [
    { href: '/', label: 'Home' },
    { href: '/student-government', label: 'Student Gov' },
    { href: '/directory', label: 'Directory' },
    { href: '/services', label: 'Services' },
    { href: '/news', label: 'News' },
    { href: '/transparency', label: 'Transparency' },
    { href: '/hub', label: 'Student Hub' },
];

function readCookieValue(name: string): string {
    return readCookieValueFromSnapshot(typeof document === 'undefined' ? '' : document.cookie, name);
}

function readCookieValueFromSnapshot(cookieSnapshot: string, name: string): string {
    if (typeof document === 'undefined') {
        return cookieSnapshot ? '' : '';
    }

    const cookie = cookieSnapshot
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`));

    return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : '';
}

function getCookieSnapshot(): string {
    if (typeof document === 'undefined') {
        return '';
    }

    return document.cookie;
}

function subscribeNoop(): () => void {
    return () => {};
}

function readForcedMobileLayout(): boolean {
    if (typeof document === 'undefined') {
        return false;
    }

    return document.documentElement.dataset.mobileDesktopMode === 'true';
}

export default function NavbarClient({ config }: { config: SiteConfig }) {
    const pathname = usePathname();
    const { data: session, status } = useSession();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [forceMobileLayout, setForceMobileLayout] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [authLoadTimedOutPath, setAuthLoadTimedOutPath] = useState<string | null>(null);
    const [dismissedLeaderNotice, setDismissedLeaderNotice] = useState(false);
    const [dismissedOfficerNotice, setDismissedOfficerNotice] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);
    const cookieSnapshot = useSyncExternalStore(subscribeNoop, getCookieSnapshot, () => '');
    const cookieState = useMemo(() => ({
        portalMode: readCookieValueFromSnapshot(cookieSnapshot, PORTAL_MODE_COOKIE),
        leaderAttempt: readCookieValueFromSnapshot(cookieSnapshot, LEADER_ATTEMPT_COOKIE),
        officerAttempt: readCookieValueFromSnapshot(cookieSnapshot, OFFICER_ATTEMPT_COOKIE),
    }), [cookieSnapshot]);
    const portalMode = cookieState.portalMode;
    const leaderAttempt = cookieState.leaderAttempt;
    const officerAttempt = cookieState.officerAttempt;

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 12);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
                setProfileOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!mobileOpen) {
            document.body.style.overflow = '';
            return;
        }

        document.body.style.overflow = 'hidden';
        const onEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setMobileOpen(false);
            }
        };

        window.addEventListener('keydown', onEscape);
        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', onEscape);
        };
    }, [mobileOpen]);

    useEffect(() => {
        if (status !== 'loading') {
            return;
        }

        const activePath = pathname || '/';
        const timeoutId = window.setTimeout(() => {
            setAuthLoadTimedOutPath(activePath);
        }, 3000);

        return () => window.clearTimeout(timeoutId);
    }, [pathname, status]);

    useEffect(() => {
        const syncForcedMobileLayout = () => {
            setForceMobileLayout(readForcedMobileLayout());
        };

        syncForcedMobileLayout();
        window.addEventListener('viewport-mode-change', syncForcedMobileLayout as EventListener);

        return () => {
            window.removeEventListener('viewport-mode-change', syncForcedMobileLayout as EventListener);
        };
    }, []);

    const navLinks = [...baseNavLinks];
    if (config.electionsActive) {
        navLinks.push({ href: '/elections', label: 'Elections' });
    }

    const effectiveRole = deriveEffectivePortalRole(session?.user?.role, portalMode);
    const isPrivilegedAccount = hasLeaderPrivilege(session?.user?.role);
    const isOfficerAccount = hasOfficerPrivilege(session?.user?.role);
    const isLeader = effectiveRole === 'leader' || effectiveRole === 'officer';
    const isOfficer = effectiveRole === 'officer';

    const shouldShowLeaderDeniedNotice = status === 'authenticated'
        && Boolean(session?.user)
        && !dismissedLeaderNotice
        && shouldShowLeaderAccessDeniedNotice(session?.user?.role, leaderAttempt);
    const shouldShowOfficerDeniedNotice = status === 'authenticated'
        && Boolean(session?.user)
        && !dismissedOfficerNotice
        && shouldShowOfficerAccessNotice(session?.user?.role, effectiveRole, officerAttempt);
    const showAuthLoadingPlaceholder = status === 'loading' && authLoadTimedOutPath !== (pathname || '/');

    const switchPortalMode = (mode: 'student' | 'leader' | 'officer') => {
        const secure = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `${PORTAL_MODE_COOKIE}=${mode}; Path=/; Max-Age=1209600; SameSite=Lax${secure}`;
        setProfileOpen(false);
        setMobileOpen(false);
        window.location.reload();
    };

    const clearPortalCookies = (resetPortalMode: boolean) => {
        const secure = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `${LEADER_ATTEMPT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
        document.cookie = `${OFFICER_ATTEMPT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;

        if (resetPortalMode) {
            document.cookie = `${PORTAL_MODE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
        }
    };

    const handleSignOut = () => {
        clearPortalCookies(true);
        signOut({ callbackUrl: '/' });
    };

    const isActiveNavLink = (href: string): boolean => {
        if (href === '/') {
            return pathname === '/';
        }

        return pathname === href || pathname.startsWith(`${href}/`);
    };

    return (
        <header className="sticky top-0 z-50">
            {shouldShowLeaderDeniedNotice && (
                <div className="portal-notice portal-notice-amber">
                    <div className="container-main flex items-start gap-2 py-2 text-sm">
                        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                        <p className="flex-1">Your account has Student Leader Access, but you are currently in Student Mode. Switch modes to access leadership tools.</p>
                        <button
                            type="button"
                            className="font-semibold underline underline-offset-4"
                            onClick={() => switchPortalMode('leader')}
                        >
                            Go to Leader Mode
                        </button>
                        <button
                            type="button"
                            className="px-2 text-xs"
                            onClick={() => {
                                clearPortalCookies(false);
                                setDismissedLeaderNotice(true);
                            }}
                            aria-label="Dismiss access notice"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            {shouldShowOfficerDeniedNotice && (
                <div className="portal-notice portal-notice-red">
                    <div className="container-main flex items-start gap-2 py-2 text-sm">
                        <ShieldAlert size={16} className="mt-0.5 shrink-0" />
                        <p className="flex-1">You are an Officer, but you are currently in {effectiveRole === 'leader' ? 'Leader' : 'Student'} Mode. Switch to Officer Mode to access administrative features.</p>
                        <button
                            type="button"
                            className="font-semibold underline underline-offset-4"
                            onClick={() => switchPortalMode('officer')}
                        >
                            Enable Officer Mode
                        </button>
                        <button
                            type="button"
                            className="px-2 text-xs"
                            onClick={() => {
                                clearPortalCookies(false);
                                setDismissedOfficerNotice(true);
                            }}
                            aria-label="Dismiss access notice"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}

            {config.alertBanner && <AlertBanner message={config.alertBanner} />}

            <nav className={`portal-nav-shell relative transition-[background,box-shadow] duration-300 ${scrolled ? 'portal-nav-shell-scrolled' : ''}`}>
                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[rgba(247,217,150,0.32)] to-transparent" />

                <div className="container-main flex h-[4.75rem] items-center justify-between">
                    <Link href="/" className="flex items-center gap-3 no-underline" onClick={() => { setMobileOpen(false); setProfileOpen(false); }}>
                        <div className="relative h-11 w-11 overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-[0_14px_35px_-26px_rgba(247,217,150,0.65)]">
                            <Image
                                src="/images/OSR_LOGO.jpg"
                                alt="RTU Student Government Portal"
                                fill
                                sizes="44px"
                                className="object-cover"
                            />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">RTU</p>
                            <span className="block truncate text-sm font-semibold text-white md:text-base">
                                Student Government Portal
                            </span>
                        </div>
                    </Link>

                    {!forceMobileLayout && (
                        <div className="hidden md:flex items-center gap-2">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`portal-nav-link text-sm font-medium ${isActiveNavLink(link.href) ? 'portal-nav-link-active' : ''}`}
                                aria-current={isActiveNavLink(link.href) ? 'page' : undefined}
                                onClick={() => setProfileOpen(false)}
                            >
                                {link.label}
                            </Link>
                        ))}

                        {showAuthLoadingPlaceholder ? (
                            <div className="ml-2 h-9 w-9 rounded-full bg-white/10 animate-pulse" />
                        ) : session?.user ? (
                            <div className="relative ml-2" ref={profileRef}>
                                <button
                                    type="button"
                                    onClick={() => setProfileOpen((open) => !open)}
                                    className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5 text-white transition-colors hover:border-[rgba(247,217,150,0.28)]"
                                    aria-label="User menu"
                                >
                                    {session.user.image ? (
                                        <Image
                                            src={session.user.image}
                                            alt=""
                                            width={40}
                                            height={40}
                                            className="h-full w-full rounded-full object-cover"
                                        />
                                    ) : (
                                        <User size={18} />
                                    )}
                                </button>

                                <AnimatePresence>
                                    {profileOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -8, scale: 0.98 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -8, scale: 0.98 }}
                                            transition={{ duration: 0.16 }}
                                            className="portal-dropdown absolute right-0 mt-3 w-72 overflow-hidden rounded-2xl"
                                        >
                                            <div className="border-b border-white/8 bg-white/4 p-4">
                                                <p className="truncate text-sm font-semibold text-white">{session.user.name || 'Student'}</p>
                                                <p className="mt-0.5 truncate text-xs text-slate-400">{session.user.email}</p>
                                                {isOfficer ? (
                                                    <span className="pill-label pill-label-tight mt-3 bg-red-500/12 text-red-200 border border-red-400/20">
                                                        <ShieldAlert size={10} /> Officer
                                                    </span>
                                                ) : isLeader ? (
                                                    <span className="pill-label pill-label-tight mt-3 bg-amber-500/12 text-amber-100 border border-amber-300/18">
                                                        <Shield size={10} /> Student Leader
                                                    </span>
                                                ) : null}
                                            </div>

                                            {isPrivilegedAccount && (
                                                <div className="border-b border-white/8 px-4 py-3">
                                                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Access Mode</p>
                                                    <div className="mt-3 flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => switchPortalMode('student')}
                                                            disabled={effectiveRole === 'student'}
                                                            className="flex-1 rounded-xl border border-white/8 bg-white/4 px-2 py-2 text-xs font-medium text-slate-200 disabled:opacity-60 disabled:cursor-default"
                                                        >
                                                            Student
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => switchPortalMode('leader')}
                                                            disabled={effectiveRole === 'leader'}
                                                            className="flex-1 rounded-xl border border-amber-300/20 bg-amber-500/10 px-2 py-2 text-xs font-medium text-amber-100 disabled:opacity-60 disabled:cursor-default"
                                                        >
                                                            Leader
                                                        </button>
                                                        {isOfficerAccount && (
                                                            <button
                                                                type="button"
                                                                onClick={() => switchPortalMode('officer')}
                                                                disabled={effectiveRole === 'officer'}
                                                                className="flex-1 rounded-xl border border-red-400/22 bg-red-500/10 px-2 py-2 text-xs font-medium text-red-100 disabled:opacity-60 disabled:cursor-default"
                                                            >
                                                                Officer
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            <div className="p-2">
                                                <button
                                                    type="button"
                                                    onClick={handleSignOut}
                                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-200 transition-colors hover:bg-red-500/10"
                                                >
                                                    <LogOut size={16} />
                                                    Sign Out
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ) : (
                            <Link href="/login" className="btn-primary ml-2 px-5 text-sm no-underline" onClick={() => setProfileOpen(false)}>
                                Sign In
                            </Link>
                        )}
                        </div>
                    )}

                    <button
                        type="button"
                        className={`${forceMobileLayout ? 'flex' : 'md:hidden flex'} h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white`}
                        onClick={() => setMobileOpen((open) => !open)}
                        aria-label="Toggle navigation"
                        aria-expanded={mobileOpen}
                        aria-controls="mobile-nav-panel"
                    >
                        {mobileOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>

                <AnimatePresence>
                    {mobileOpen && (
                        <>
                            <motion.button
                                type="button"
                                aria-label="Close mobile navigation"
                                className={`${forceMobileLayout ? '' : 'md:hidden'} fixed inset-0 top-[4.75rem] z-40 bg-[#07111d]/45`}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setMobileOpen(false)}
                            />
                            <motion.div
                                id="mobile-nav-panel"
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                className={`portal-mobile-panel ${forceMobileLayout ? '' : 'md:hidden'} relative z-50 overflow-hidden border-t border-white/8`}
                            >
                                <div className="container-main flex flex-col gap-2 py-4">
                                    {navLinks.map((link) => (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            className={`portal-nav-link text-base ${isActiveNavLink(link.href) ? 'portal-nav-link-active' : ''}`}
                                            aria-current={isActiveNavLink(link.href) ? 'page' : undefined}
                                            onClick={() => setMobileOpen(false)}
                                        >
                                            {link.label}
                                        </Link>
                                    ))}

                                    {session?.user ? (
                                        <div className="mt-2 rounded-2xl border border-white/8 bg-white/4 p-4">
                                            <div className="flex items-center gap-3">
                                                {session.user.image ? (
                                                    <Image src={session.user.image} alt="" width={36} height={36} className="rounded-full" />
                                                ) : (
                                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white">
                                                        <User size={16} />
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="text-sm font-semibold text-white">{session.user.name || 'Student'}</p>
                                                    {isOfficer ? (
                                                        <span className="pill-label pill-label-tight mt-1 bg-red-500/12 text-red-200 border border-red-400/20">Officer</span>
                                                    ) : isLeader ? (
                                                        <span className="pill-label pill-label-tight mt-1 bg-amber-500/12 text-amber-100 border border-amber-300/18">Student Leader</span>
                                                    ) : null}
                                                </div>
                                            </div>

                                            {isPrivilegedAccount && (
                                                <div className="mt-4 grid grid-cols-2 gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => switchPortalMode('student')}
                                                        disabled={effectiveRole === 'student'}
                                                        className="rounded-xl border border-white/8 bg-white/4 px-2 py-2 text-xs font-medium text-slate-200 disabled:opacity-60 disabled:cursor-default"
                                                    >
                                                        Student Mode
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => switchPortalMode('leader')}
                                                        disabled={effectiveRole === 'leader'}
                                                        className="rounded-xl border border-amber-300/20 bg-amber-500/10 px-2 py-2 text-xs font-medium text-amber-100 disabled:opacity-60 disabled:cursor-default"
                                                    >
                                                        Leader Mode
                                                    </button>
                                                    {isOfficerAccount && (
                                                        <button
                                                            type="button"
                                                            onClick={() => switchPortalMode('officer')}
                                                            disabled={effectiveRole === 'officer'}
                                                            className="col-span-2 rounded-xl border border-red-400/22 bg-red-500/10 px-2 py-2 text-xs font-medium text-red-100 disabled:opacity-60 disabled:cursor-default"
                                                        >
                                                            Officer Mode
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => { setMobileOpen(false); handleSignOut(); }}
                                                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/18 bg-red-500/10 py-2 text-sm text-red-100"
                                            >
                                                <LogOut size={16} />
                                                Sign Out
                                            </button>
                                        </div>
                                    ) : (
                                        <Link href="/login" className="btn-primary mt-2 text-center text-sm no-underline" onClick={() => setMobileOpen(false)}>
                                            Sign In
                                        </Link>
                                    )}
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </nav>
        </header>
    );
}
