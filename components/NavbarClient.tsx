'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import AlertBanner from './AlertBanner';
import { SiteConfig } from '@/lib/slideConfig';

const baseNavLinks = [
    { href: '/', label: 'Home' },
    { href: '/directory', label: 'Directory' },
    { href: '/services', label: 'Services' },
    { href: '/news', label: 'News' },
];

export default function NavbarClient({ config }: { config: SiteConfig }) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const pathname = usePathname();

    // navbar gets see-through when you scroll down
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 50);
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    // dynamic links because the regents wanted elections to disappear sometimes
    const navLinks = [...baseNavLinks];
    if (config.electionsActive) {
        navLinks.push({ href: '/elections', label: 'Elections 🗳️' });
    }

    return (
        <header className="fixed top-0 left-0 right-0 z-50">
            {config.alertBanner && <AlertBanner message={config.alertBanner} />}
            <nav className="glass-nav" style={{ background: scrolled ? 'rgba(255,255,255,0.97)' : undefined, transition: 'background 0.3s ease' }}>
                <div className="container-main flex items-center justify-between h-16">
                    {/* logo block */}
                    <Link href="/" className="flex items-center gap-3 no-underline">
                        <Image
                            src="/images/OSR_LOGO.jpg"
                            alt="Office of the Student Regent Logo"
                            width={40}
                            height={40}
                            className="rounded-full"
                        />
                        <span className="font-bold text-sm md:text-lg" style={{ color: 'var(--rtu-blue)' }}>
                            Rizal Technological University - Office of the Student Regent
                        </span>
                    </Link>

                    {/* desktop nav because mobile is hard */}
                    <div className="hidden md:flex items-center gap-8">
                        {navLinks.map(link => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`text-sm font-medium no-underline transition-colors duration-200 ${pathname === link.href ? 'nav-link-active' : ''}`}
                                style={{ color: pathname === link.href ? 'var(--rtu-blue)' : 'var(--text-secondary)' }}
                                onMouseEnter={e => (e.currentTarget.style.color = 'var(--rtu-blue)')}
                                onMouseLeave={e => { if (pathname !== link.href) e.currentTarget.style.color = 'var(--text-secondary)'; }}
                            >
                                {link.label}
                            </Link>
                        ))}
                        <Link href="/services" className="btn-primary text-sm no-underline">
                            File a Grievance
                        </Link>
                    </div>

                    {/* the hamburger menu that gave me a headache */}
                    <button
                        className="md:hidden p-2"
                        onClick={() => setMobileOpen(!mobileOpen)}
                        aria-label="Toggle navigation"
                        style={{ color: 'var(--rtu-blue)' }}
                    >
                        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>

                {/* animated mobile menu that i spent way too long on */}
                <AnimatePresence>
                    {mobileOpen && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="md:hidden overflow-hidden"
                            style={{ background: 'var(--glass-bg)' }}
                        >
                            <div className="container-main py-4 flex flex-col gap-4">
                                {navLinks.map(link => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className="text-base font-medium no-underline py-2"
                                        style={{ color: 'var(--text-primary)' }}
                                        onClick={() => setMobileOpen(false)}
                                    >
                                        {link.label}
                                    </Link>
                                ))}
                                <Link
                                    href="/services"
                                    className="btn-primary text-sm text-center no-underline"
                                    onClick={() => setMobileOpen(false)}
                                >
                                    File a Grievance
                                </Link>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </nav>
        </header>
    );
}
