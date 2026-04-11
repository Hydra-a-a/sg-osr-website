import Link from 'next/link';
import { ArrowRight, FileText, FolderKanban, Landmark, Search, ShieldCheck, Users } from 'lucide-react';
import Hero from '@/components/Hero';

const primaryActions = [
    {
        title: 'Grievances and appeals',
        description: 'Submit concerns, continue officer feedback threads, and monitor status from one secure workflow.',
        href: '/services/grievance',
        icon: FileText,
        accent: 'blue' as const,
    },
    {
        title: 'Project proposals',
        description: 'Leaders can submit proposals, respond to review notes, and track revisions without leaving the portal.',
        href: '/services/proposals',
        icon: FolderKanban,
        accent: 'gold' as const,
    },
    {
        title: 'Transparency records',
        description: 'Open resolutions, reports, and accountability materials from the public-facing records area.',
        href: '/transparency',
        icon: ShieldCheck,
        accent: 'sky' as const,
    },
];

const structureActions = [
    {
        title: 'Student Government',
        description: 'Open the new route tree for councils, commissions, and the Office of the Student Regent.',
        href: '/student-government',
        icon: Landmark,
    },
    {
        title: 'Directory',
        description: 'Find the correct office, council, or student-government contact before you file a request.',
        href: '/directory',
        icon: Search,
    },
    {
        title: 'Services Console',
        description: 'Go directly to the service modules and tracking entry points.',
        href: '/services',
        icon: Users,
    },
];

export default function Home() {
    return (
        <>
            <Hero />

            <section className="portal-section-dark section">
                <div className="portal-noise-overlay" aria-hidden="true" />
                <div className="container-main relative z-10">
                    <div className="max-w-3xl">
                        <span className="portal-kicker">Core Actions</span>
                        <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">Start with the actual task.</h2>
                        <p className="mt-4 portal-lead">
                            The landing page now stays aligned with the services visual system and keeps the three highest-value paths in front:
                            casework, proposals, and transparency.
                        </p>
                    </div>

                    <div className="mt-10 grid gap-6 lg:grid-cols-3">
                        {primaryActions.map((card) => {
                            const Icon = card.icon;

                            return (
                                <article key={card.title} className="portal-panel portal-accent-card p-7 md:p-8" data-accent={card.accent}>
                                    <div className="portal-accent-chip mb-6 flex h-14 w-14 items-center justify-center rounded-2xl" data-accent={card.accent}>
                                        <Icon size={28} />
                                    </div>
                                    <h3 className="text-2xl font-bold text-white">{card.title}</h3>
                                    <p className="mt-4 text-sm leading-7 text-slate-300">{card.description}</p>
                                    <Link href={card.href} className="portal-accent-link mt-6 inline-flex items-center gap-2 text-sm font-semibold no-underline" data-accent={card.accent}>
                                        Open module <ArrowRight size={16} />
                                    </Link>
                                </article>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="portal-section-slate section">
                <div className="portal-noise-overlay" aria-hidden="true" />
                <div className="container-main relative z-10 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                    <div className="portal-panel p-7 md:p-10">
                        <span className="portal-kicker">New Information Architecture</span>
                        <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">Student Government is now a first-class section.</h2>
                        <p className="mt-4 portal-lead">
                            Councils, constitutional commissions, and the OSR now have a dedicated route tree instead of being buried in a
                            catch-all page. The home route keeps that structure visible while still prioritizing services.
                        </p>
                        <div className="mt-8 flex flex-wrap gap-4">
                            <Link href="/student-government" className="btn-primary no-underline">
                                Open Student Government
                            </Link>
                            <Link href="/student-government/osr" className="btn-secondary no-underline">
                                Open OSR
                            </Link>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {structureActions.map((card) => {
                            const Icon = card.icon;

                            return (
                                <Link key={card.title} href={card.href} className="portal-link-card p-6">
                                    <div className="flex items-start gap-4">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-[var(--rtu-gold-light)]">
                                            <Icon size={22} />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-white">{card.title}</h3>
                                            <p className="mt-2 text-sm leading-7 text-slate-300">{card.description}</p>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </section>
        </>
    );
}
