'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, LogOut, User, Shield, AlertTriangle } from 'lucide-react';
import AlertBanner from './AlertBanner';
import { SiteConfig } from '@/lib/slideConfig';
import {
    deriveEffectivePortalRole,
    LEADER_ATTEMPT_COOKIE,
    normalizePortalRole,
    PORTAL_MODE_COOKIE,
    shouldShowLeaderAccessDeniedNotice,
} from '@/lib/portal-mode';

const baseNavLinks = [
    { href: '/', label: 'Home' },
    { href: '/directory', label: 'Directory' },
    { href: '/services', label: 'Services' },
    { href: '/news', label: 'News' },
    { href: '/transparency', label: 'Transparency' },
    { href: '/hub', label: 'Student Hub' },
];

export default function NavbarClient({ config }: { config: SiteConfig }) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [dismissedLeaderNotice, setDismissedLeaderNotice] = useState(false);
    const profileRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();
    const { data: session, status } = useSession();

    const getCookieValue = (name: string): string => {
        if (typeof document === 'undefined') {
            return '';
        }

        const cookie = document.cookie
            .split(';')
            .map((part) => part.trim())
            .find((part) => part.startsWith(`${name}=`));

        return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : '';
    };

    // navbar gets see-through when you scroll down
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // close profile dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
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

    // dynamic links because the regents wanted elections to disappear sometimes
    const navLinks = [...baseNavLinks];
    if (config.electionsActive) {
        navLinks.push({ href: '/elections', label: 'Elections 🗳️' });
    }

    const portalMode = getCookieValue(PORTAL_MODE_COOKIE);
    const leaderAttempt = getCookieValue(LEADER_ATTEMPT_COOKIE);
    const isLeaderAccount = normalizePortalRole(session?.user?.role) === 'leader';
    const shouldShowLeaderDeniedNotice = status === 'authenticated'
        && Boolean(session?.user)
        && !dismissedLeaderNotice
        && shouldShowLeaderAccessDeniedNotice(session?.user?.role, leaderAttempt);
    const isLeader = deriveEffectivePortalRole(session?.user?.role, portalMode) === 'leader';

    const switchPortalMode = (mode: 'student' | 'leader') => {
        const secure = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `${PORTAL_MODE_COOKIE}=${mode}; Path=/; Max-Age=1209600; SameSite=Lax${secure}`;
        setProfileOpen(false);
        setMobileOpen(false);
        window.location.reload();
    };

    const clearPortalCookies = (resetPortalMode: boolean) => {
        const secure = window.location.protocol === 'https:' ? '; Secure' : '';
        document.cookie = `${LEADER_ATTEMPT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
        if (resetPortalMode) {
            document.cookie = `${PORTAL_MODE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
        }
    };

    const handleSignOut = () => {
        clearPortalCookies(true);
        signOut({ callbackUrl: '/' });
    };

    return (
        <header className="sticky top-0 z-50">
            {shouldShowLeaderDeniedNotice && (
                <div className="bg-amber-50 border-b border-amber-200 text-amber-900">
                    <div className="container-main flex items-start gap-2 py-2 text-sm">
                        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                        <p className="flex-1">Your account is signed in, but it does not have Student Leader Access. You are now in Student Access mode.</p>
                        <button
                            type="button"
                            className="text-amber-800 hover:text-amber-950 font-semibold"
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
            {config.alertBanner && <AlertBanner message={config.alertBanner} />}
            <nav className={`glass-nav relative transition-[background,box-shadow] duration-300 ${scrolled ? 'glass-nav-scrolled' : ''}`}>
                <div className="container-main flex items-center justify-between h-16 md:h-[4.5rem]">
                    {/* logo block */}
                    <Link href="/" className="flex items-center gap-3 no-underline" onClick={() => { setMobileOpen(false); setProfileOpen(false); }}>
                        <Image
                            src="/images/OSR_LOGO.jpg"
                            alt="Office of the Student Regent Logo"
                            width={40}
                            height={40}
                            className="rounded-full"
                        />
                        <span className="font-bold text-sm md:text-lg text-brand">
                            RTU Student Government Portal
                        </span>
                    </Link>

                    {/* desktop nav */}
                    <div className="hidden md:flex items-center gap-8">
                        {navLinks.map(link => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`text-sm font-medium no-underline nav-link ${pathname === link.href ? 'nav-link-active' : ''}`}
                                aria-current={pathname === link.href ? 'page' : undefined}
                                onClick={() => setProfileOpen(false)}
                            >
                                {link.label}
                            </Link>
                        ))}

                        {/* Auth section */}
                        {status === 'loading' ? (
                            <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
                        ) : session?.user ? (
                            <div className="relative" ref={profileRef}>
                                <button
                                    onClick={() => setProfileOpen(!profileOpen)}
                                    className="flex items-center gap-2 p-1 rounded-full hover:bg-gray-100 transition-colors"
                                    aria-label="User menu"
                                >
                                    {session.user.image ? (
                                        <Image
                                            src={session.user.image}
                                            alt=""
                                            width={32}
                                            height={32}
                                            className="rounded-full border-2 border-transparent hover:border-rtu-blue transition-colors"
                                        />
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-rtu-blue flex items-center justify-center">
                                            <User size={16} className="text-white" />
                                        </div>
                                    )}
                                </button>

                                <AnimatePresence>
                                    {profileOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                            transition={{ duration: 0.15 }}
                                            className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50"
                                        >
                                            <div className="p-4 bg-gradient-to-br from-blue-50 to-white border-b border-gray-100">
                                                <p className="font-semibold text-sm text-gray-900 truncate">{session.user.name || 'Student'}</p>
                                                <p className="text-xs text-gray-500 truncate mt-0.5">{session.user.email}</p>
                                                {isLeader && (
                                                    <span className="pill-label pill-label-tight mt-2 bg-amber-100 text-amber-800">
                                                        <Shield size={10} /> Student Leader
                                                    </span>
                                                )}
                                            </div>
                                            {isLeaderAccount && (
                                                <div className="px-4 py-3 border-b border-gray-100">
                                                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Access Mode</p>
                                                    <div className="mt-2 flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => switchPortalMode('student')}
                                                            disabled={!isLeader}
                                                            className="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-700 disabled:opacity-60 disabled:cursor-default"
                                                        >
                                                            Student
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => switchPortalMode('leader')}
                                                            disabled={isLeader}
                                                            className="flex-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-800 disabled:opacity-60 disabled:cursor-default"
                                                        >
                                                            Student Leader
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                            <div className="p-2">
                                                <button
                                                    onClick={handleSignOut}
                                                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
                            <Link href="/login" className="btn-primary text-sm no-underline px-6" onClick={() => setProfileOpen(false)}>
                                Sign In
                            </Link>
                        )}
                    </div>

                    {/* the hamburger menu that gave me a headache */}
                    <button
                        className="md:hidden p-2 rounded-lg"
                        onClick={() => setMobileOpen(!mobileOpen)}
                        aria-label="Toggle navigation"
                        aria-expanded={mobileOpen}
                        aria-controls="mobile-nav-panel"
                        style={{ color: 'var(--accent-primary)' }}
                    >
                        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>

                {/* animated mobile menu */}
                <AnimatePresence>
                    {mobileOpen && (
                        <>
                            <motion.button
                                type="button"
                                aria-label="Close mobile navigation"
                                className="md:hidden fixed inset-0 top-16 z-40 bg-[#0f2037]/35 backdrop-blur-[1px]"
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
                                className="md:hidden relative z-50 overflow-hidden border-t border-soft"
                                style={{ background: 'var(--glass-bg)' }}
                            >
                                <div className="container-main py-4 flex flex-col gap-2">
                                    {navLinks.map(link => (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            className={`text-base font-medium no-underline text-strong mobile-nav-link ${pathname === link.href ? 'mobile-nav-link-active' : ''}`}
                                            aria-current={pathname === link.href ? 'page' : undefined}
                                            onClick={() => setMobileOpen(false)}
                                        >
                                            {link.label}
                                        </Link>
                                    ))}

                                    {/* Mobile auth */}
                                    {session?.user ? (
                                        <div className="pt-3 mt-1 border-t border-gray-200">
                                            <div className="flex items-center gap-3 mb-3">
                                                {session.user.image ? (
                                                    <Image src={session.user.image} alt="" width={32} height={32} className="rounded-full" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-rtu-blue flex items-center justify-center">
                                                        <User size={16} className="text-white" />
                                                    </div>
                                                )}
                                                <div>
                                                    <p className="text-sm font-semibold">{session.user.name || 'Student'}</p>
                                                    {isLeader && (
                                                        <span className="pill-label pill-label-tight mt-1 bg-amber-100 text-amber-700">Student Leader</span>
                                                    )}
                                                </div>
                                            </div>
                                            {isLeaderAccount && (
                                                <div className="grid grid-cols-2 gap-2 mb-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => switchPortalMode('student')}
                                                        disabled={!isLeader}
                                                        className="rounded-lg border border-gray-200 px-2 py-2 text-xs font-medium text-gray-700 disabled:opacity-60 disabled:cursor-default"
                                                    >
                                                        Student Mode
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => switchPortalMode('leader')}
                                                        disabled={isLeader}
                                                        className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-xs font-medium text-amber-800 disabled:opacity-60 disabled:cursor-default"
                                                    >
                                                        Leader Mode
                                                    </button>
                                                </div>
                                            )}
                                            <button
                                                onClick={() => { setMobileOpen(false); handleSignOut(); }}
                                                className="w-full flex items-center justify-center gap-2 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                                            >
                                                <LogOut size={16} />
                                                Sign Out
                                            </button>
                                        </div>
                                    ) : (
                                        <Link
                                            href="/login"
                                            className="btn-primary text-sm text-center no-underline"
                                            onClick={() => setMobileOpen(false)}
                                        >
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

