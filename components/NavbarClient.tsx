'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { usePathname } from 'next/navigation';
import type { Session } from 'next-auth';
import { ChevronRight, LogOut, Menu, Shield, ShieldAlert, User, X } from 'lucide-react';
import AlertBanner from './AlertBanner';
import { SiteConfig } from '@/lib/slideConfig';
import { getAccessVisibilityState } from '@/lib/access-visibility';
import {
    OFFICER_ATTEMPT_COOKIE,
    PORTAL_MODE_COOKIE,
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

export default function NavbarClient({ config, session }: { config: SiteConfig; session?: Session | null }) {
    const pathname = usePathname();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [forceMobileLayout, setForceMobileLayout] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [dismissedOfficerNotice, setDismissedOfficerNotice] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);
    const cookieSnapshot = useSyncExternalStore(subscribeNoop, getCookieSnapshot, () => '');
    const cookieState = useMemo(() => ({
        portalMode: readCookieValueFromSnapshot(cookieSnapshot, PORTAL_MODE_COOKIE),
        officerAttempt: readCookieValueFromSnapshot(cookieSnapshot, OFFICER_ATTEMPT_COOKIE),
    }), [cookieSnapshot]);
    const portalMode = cookieState.portalMode;
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

    const visibility = getAccessVisibilityState(session?.user?.role, portalMode, '');
    const { effectiveRole, canSeeLeaderFeatures, canSeeOfficerFeatures, actualRole } = visibility;
    const isPrivilegedAccount = actualRole !== 'student';
    const isOfficerAccount = actualRole === 'officer';
    const isLeader = canSeeLeaderFeatures;
    const isOfficer = canSeeOfficerFeatures;

    const shouldShowOfficerDeniedNotice = Boolean(session?.user)
        && !dismissedOfficerNotice
        && shouldShowOfficerAccessNotice(session?.user?.role, effectiveRole, officerAttempt);
    const switchPortalMode = (mode: 'student' | 'leader' | 'officer') => {
        const secure = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `${PORTAL_MODE_COOKIE}=${mode}; Path=/; Max-Age=1209600; SameSite=Lax${secure}`;
        setProfileOpen(false);
        setMobileOpen(false);
        window.location.reload();
    };

    const clearPortalCookies = (resetPortalMode: boolean) => {
        const secure = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `${OFFICER_ATTEMPT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;

        if (resetPortalMode) {
            document.cookie = `${PORTAL_MODE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
        }
    };

    const handleSignOut = async () => {
        clearPortalCookies(true);
        const { signOut } = await import('next-auth/react');
        await signOut({ callbackUrl: '/' });
    };

    const isActiveNavLink = (href: string): boolean => {
        if (href === '/') {
            return pathname === '/';
        }

        return pathname === href || pathname.startsWith(`${href}/`);
    };

    return (
        <header className="sticky top-0 z-50">
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

            <nav className={`portal-nav-shell portal-nav-shell-framed relative transition-[background,box-shadow] duration-300 ${scrolled ? 'portal-nav-shell-scrolled' : ''}`}>
                <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[rgba(247,217,150,0.32)] to-transparent" />

                <div className="container-main portal-nav-bar flex min-h-[4.1rem] items-center justify-between gap-3 py-2 md:py-0">
                    <Link href="/" className="portal-brand-link flex min-w-0 flex-1 items-center gap-3 pr-1 no-underline" onClick={() => { setMobileOpen(false); setProfileOpen(false); }}>
                        <div className="relative h-10 w-10 overflow-hidden rounded-full border border-[rgba(247,217,150,0.46)] bg-[rgba(247,217,150,0.08)] shadow-[0_14px_35px_-26px_rgba(247,217,150,0.65)]">
                            <Image
                                src="/images/RTU_SSC.jpg"
                                alt="RTU Student Government Portal"
                                fill
                                sizes="40px"
                                className="object-contain"
                            />
                        </div>
                        <div className="portal-brand-copy min-w-0">
                            <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-[rgba(203,213,225,0.78)]">RTU</p>
                            <span className="portal-brand-title block text-sm font-semibold text-[rgba(241,245,249,0.95)] md:text-[0.97rem]">
                                Student Government Portal
                            </span>
                        </div>
                    </Link>

                    {!forceMobileLayout && (
                        <div className="hidden lg:flex items-center gap-2">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`portal-nav-link portal-nav-link-desktop text-sm font-medium ${isActiveNavLink(link.href) ? 'portal-nav-link-active' : ''}`}
                                aria-current={isActiveNavLink(link.href) ? 'page' : undefined}
                                onClick={() => setProfileOpen(false)}
                            >
                                {link.label}
                            </Link>
                        ))}

                        {session?.user ? (
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

                                {profileOpen && (
                                        <div className="portal-dropdown portal-account-menu portal-account-menu-open absolute right-0 mt-3 w-72 overflow-hidden">
                                            <div className="flex items-center gap-3 border-b border-white/8 bg-white/4 p-4">
                                                {session.user.image ? (
                                                    <Image src={session.user.image} alt="" width={36} height={36} className="rounded-full" />
                                                ) : (
                                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
                                                        <User size={16} />
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-semibold text-white">{session.user.name || 'Student'}</p>
                                                    <p className="mt-0.5 truncate text-xs text-slate-400">{session.user.email}</p>
                                                    {isOfficer ? (
                                                        <p className="portal-account-role portal-account-role-officer"><ShieldAlert size={13} /> Officer access</p>
                                                    ) : isLeader ? (
                                                        <p className="portal-account-role portal-account-role-leader"><Shield size={13} /> Student leader access</p>
                                                    ) : null}
                                                </div>
                                            </div>

                                            {isPrivilegedAccount && (
                                                <fieldset className="portal-account-mode">
                                                    <legend>Access mode</legend>
                                                    <div className="portal-account-mode-list">
                                                        <button
                                                            type="button"
                                                            onClick={() => switchPortalMode('student')}
                                                            disabled={effectiveRole === 'student'}
                                                            className={`portal-account-mode-button ${effectiveRole === 'student' ? 'portal-account-mode-button-active' : ''}`}
                                                        >
                                                            Student mode
                                                            {effectiveRole === 'student' ? <span>Current</span> : null}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => switchPortalMode('leader')}
                                                            disabled={effectiveRole === 'leader'}
                                                            className={`portal-account-mode-button portal-account-mode-button-leader ${effectiveRole === 'leader' ? 'portal-account-mode-button-active' : ''}`}
                                                        >
                                                            Leader mode
                                                            {effectiveRole === 'leader' ? <span>Current</span> : null}
                                                        </button>
                                                        {isOfficerAccount && (
                                                            <button
                                                                type="button"
                                                                onClick={() => switchPortalMode('officer')}
                                                                disabled={effectiveRole === 'officer'}
                                                                className={`portal-account-mode-button portal-account-mode-button-officer ${effectiveRole === 'officer' ? 'portal-account-mode-button-active' : ''}`}
                                                            >
                                                                Officer mode
                                                                {effectiveRole === 'officer' ? <span>Current</span> : null}
                                                            </button>
                                                        )}
                                                    </div>
                                                </fieldset>
                                            )}

                                            <div className="px-4 pb-3">
                                                <button
                                                    type="button"
                                                    onClick={handleSignOut}
                                                    className="portal-account-signout"
                                                >
                                                    <LogOut size={16} />
                                                    Sign Out
                                                </button>
                                            </div>
                                        </div>
                                )}
                            </div>
                        ) : (
                            <Link href="/login" className="portal-signin-btn ml-2 px-5 text-sm no-underline" onClick={() => setProfileOpen(false)}>
                                Sign In
                            </Link>
                        )}
                        </div>
                    )}

                    <button
                        type="button"
                        className={`${forceMobileLayout ? 'flex' : 'lg:hidden flex'} h-10 w-10 shrink-0 items-center justify-center rounded-md border border-white/10 bg-white/5 text-white transition-colors hover:border-[rgba(247,217,150,0.35)] hover:bg-white/10`}
                        onClick={() => setMobileOpen((open) => !open)}
                        aria-label="Toggle navigation"
                        aria-expanded={mobileOpen}
                        aria-controls="mobile-nav-panel"
                    >
                        {mobileOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>

                    {mobileOpen && (
                        <>
                            <button
                                type="button"
                                aria-label="Close mobile navigation"
                                className={`${forceMobileLayout ? '' : 'lg:hidden'} portal-mobile-scrim fixed inset-0 top-[4.75rem] z-40 bg-[#07111d]/45`}
                                onClick={() => setMobileOpen(false)}
                            />
                            <div
                                id="mobile-nav-panel"
                                className={`portal-mobile-panel portal-mobile-panel-open ${forceMobileLayout ? '' : 'lg:hidden'} relative z-50 overflow-hidden border-t border-white/8`}
                            >
                                <div className="container-main py-2">
                                    <nav className="portal-mobile-nav-list" aria-label="Mobile primary navigation">
                                        {navLinks.map((link) => (
                                            <Link
                                                key={link.href}
                                                href={link.href}
                                                className={`portal-mobile-nav-link ${isActiveNavLink(link.href) ? 'portal-mobile-nav-link-active' : ''}`}
                                                aria-current={isActiveNavLink(link.href) ? 'page' : undefined}
                                                onClick={() => setMobileOpen(false)}
                                            >
                                                <span>{link.label}</span>
                                                <ChevronRight size={16} aria-hidden="true" />
                                            </Link>
                                        ))}
                                    </nav>

                                    {session?.user ? (
                                        <section className="portal-mobile-account" aria-labelledby="mobile-account-heading">
                                            <div className="flex items-center gap-3">
                                                {session.user.image ? (
                                                    <Image src={session.user.image} alt="" width={36} height={36} className="rounded-full" />
                                                ) : (
                                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white">
                                                        <User size={16} />
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <p id="mobile-account-heading" className="truncate text-sm font-semibold text-white">{session.user.name || 'Student'}</p>
                                                    {isOfficer ? (
                                                        <p className="portal-account-role portal-account-role-officer"><ShieldAlert size={13} /> Officer access</p>
                                                    ) : isLeader ? (
                                                        <p className="portal-account-role portal-account-role-leader"><Shield size={13} /> Student leader access</p>
                                                    ) : null}
                                                </div>
                                            </div>

                                            {isPrivilegedAccount && (
                                                <fieldset className="portal-account-mode">
                                                    <legend>Access mode</legend>
                                                    <div className="portal-account-mode-list">
                                                        <button
                                                            type="button"
                                                            onClick={() => switchPortalMode('student')}
                                                            disabled={effectiveRole === 'student'}
                                                            className={`portal-account-mode-button ${effectiveRole === 'student' ? 'portal-account-mode-button-active' : ''}`}
                                                        >
                                                            Student mode
                                                            {effectiveRole === 'student' ? <span>Current</span> : null}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => switchPortalMode('leader')}
                                                            disabled={effectiveRole === 'leader'}
                                                            className={`portal-account-mode-button portal-account-mode-button-leader ${effectiveRole === 'leader' ? 'portal-account-mode-button-active' : ''}`}
                                                        >
                                                            Leader mode
                                                            {effectiveRole === 'leader' ? <span>Current</span> : null}
                                                        </button>
                                                        {isOfficerAccount && (
                                                            <button
                                                                type="button"
                                                                onClick={() => switchPortalMode('officer')}
                                                                disabled={effectiveRole === 'officer'}
                                                                className={`portal-account-mode-button portal-account-mode-button-officer ${effectiveRole === 'officer' ? 'portal-account-mode-button-active' : ''}`}
                                                            >
                                                                Officer mode
                                                                {effectiveRole === 'officer' ? <span>Current</span> : null}
                                                            </button>
                                                        )}
                                                    </div>
                                                </fieldset>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => { setMobileOpen(false); handleSignOut(); }}
                                                className="portal-account-signout"
                                            >
                                                <LogOut size={16} />
                                                Sign Out
                                            </button>
                                        </section>
                                    ) : (
                                        <Link href="/login" className="portal-mobile-login" onClick={() => setMobileOpen(false)}>
                                            Sign In
                                        </Link>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
            </nav>
        </header>
    );
}
