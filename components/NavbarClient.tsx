'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, LogOut, User, Shield } from 'lucide-react';
import AlertBanner from './AlertBanner';
import { SiteConfig } from '@/lib/slideConfig';

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
    const profileRef = useRef<HTMLDivElement>(null);
    const pathname = usePathname();
    const { data: session, status } = useSession();

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

    const isLeader = session?.user?.role === 'leader';

    return (
        <header className="sticky top-0 z-50">
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
                                                    <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold rounded-full uppercase tracking-wider">
                                                        <Shield size={10} /> Student Leader
                                                    </span>
                                                )}
                                            </div>
                                            <div className="p-2">
                                                <button
                                                    onClick={() => signOut({ callbackUrl: '/' })}
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
                                Login
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
                                                        <span className="text-[10px] text-amber-600 font-bold uppercase">Student Leader</span>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => { signOut({ callbackUrl: '/' }); setMobileOpen(false); }}
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
                                            Login
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

