import Link from 'next/link';
import Image from 'next/image';

type FooterProps = {
    isLoggedIn?: boolean;
};

export default function Footer({ isLoggedIn = false }: FooterProps) {

    const exploreLinks = [
        { href: '/', label: 'Home' },
        { href: '/student-government', label: 'Student Government' },
        { href: '/student-government/osr', label: 'Office of the Student Regent' },
        { href: '/directory', label: 'Directory' },
    ];

    const actionLinks = [
        { href: '/services', label: 'Services' },
        { href: '/services/grievance', label: 'Grievances' },
        { href: '/services/proposals', label: 'Project Proposals' },
        ...(isLoggedIn ? [{ href: '/services/proposals/track', label: 'Proposal Tracker' }] : []),
        { href: '/transparency', label: 'Transparency' },
        ...(!isLoggedIn ? [{ href: '/login', label: 'Portal Sign In' }] : []),
    ];

    return (
        <footer className="portal-footer-shell mt-auto">
            <div className="container-main portal-footer-grid relative z-10 flex min-h-[18rem] flex-col justify-start pt-20 pb-10 md:justify-center md:py-12">
                <div className="portal-footer-stack mt-8 grid gap-8 md:mt-0 md:grid-cols-[1.1fr_0.95fr_0.95fr] md:items-center md:gap-10">
                    <div className="portal-footer-brand">
                        <div className="mb-4 flex items-center gap-3">
                            <div className="relative h-11 w-11 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                                <Image
                                    src="/images/OSR_LOGO.jpg"
                                    alt="RTU Student Government Portal"
                                    fill
                                    sizes="44px"
                                    className="object-cover"
                                />
                            </div>
                            <div>
                                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">RTU</p>
                                <span className="text-lg font-semibold text-white">Student Government Portal</span>
                            </div>
                        </div>
                        <p className="text-sm leading-6 text-slate-300">
                            A unified portal for grievances, project proposals, transparency records, directory access, and official
                            student-government information.
                        </p>
                    </div>

                    <div className="portal-footer-column">
                        <h4 className="eyebrow-label mb-4 text-[var(--rtu-gold-light)]">Explore</h4>
                        <div className="flex flex-col gap-2">
                            {exploreLinks.map((link) => (
                                <Link key={link.href} href={link.href} className="portal-footer-link no-underline">
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className="portal-footer-column">
                        <h4 className="eyebrow-label mb-4 text-[var(--rtu-gold-light)]">Actions</h4>
                        <div className="flex flex-col gap-2">
                            {actionLinks.map((link) => (
                                <Link key={link.href} href={link.href} className="portal-footer-link no-underline">
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="portal-footer-divider mt-7 mb-3" />
                <div className="flex flex-col gap-1.5 text-center text-xs leading-5 text-slate-400 md:flex-row md:items-center md:justify-between md:text-left">
                    <p>Copyright {new Date().getFullYear()} RTU Student Government Portal. All rights reserved.</p>
                    <p>Rizal Technological University, Mandaluyong and Pasig, Metro Manila, Philippines</p>
                </div>
            </div>
        </footer>
    );
}
