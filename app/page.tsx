import Link from 'next/link';
import { ArrowRight, FileText, FolderKanban, Landmark, Search, ShieldCheck, Users } from 'lucide-react';
import Hero from '@/components/Hero';
import AnnouncementsPanel from '@/components/AnnouncementsPanel';
import { fetchActiveAnnouncements } from '@/lib/announcements-server';
import OSRAnnouncementsSection from '@/components/OSRAnnouncementsSection';
import { getOSRAnnouncementSlides } from '@/lib/osr-announcements';

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
        description: 'Review councils, commissions, and the Office of the Student Regent from one organized section.',
        href: '/student-government',
        icon: Landmark,
    },
    {
        title: 'Directory',
        description: 'Find the correct office, council, or student-government contact before starting a request.',
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

export default async function Home() {
    const announcements = await fetchActiveAnnouncements(4).catch(() => []);
    const osrSlides = await getOSRAnnouncementSlides(3).catch(() => []);

    return (
        <>
            <Hero />

            <section className="portal-section-dark section">
                <div className="portal-noise-overlay" aria-hidden="true" />
                <div className="container-main relative z-10">
                    <div>
                        <span className="portal-kicker">Core Actions</span>
                        <h2 className="home-section-title mt-4">
                            Start with <span className="home-section-title-accent">the actual task.</span>
                        </h2>
                        <p className="home-section-lead mt-4">
                            Open the main service paths first: casework, proposals, and transparency records.
                        </p>
                    </div>

                    <div className="home-actions-layout mt-10">
                        {primaryActions.map((card, index) => {
                            const Icon = card.icon;
                            const articleClass = index === 0 ? 'home-feature-primary' : 'home-feature-secondary';

                            return (
                                <article key={card.title} className={articleClass} data-accent={card.accent}>
                                    <div className="home-feature-icon">
                                        <Icon size={24} />
                                    </div>
                                    <div>
                                        <p className="home-feature-kicker">{index === 0 ? 'Priority Path' : 'Service Path'}</p>
                                        <h3 className="home-feature-title">{card.title}</h3>
                                        <p className="home-feature-copy">{card.description}</p>
                                        <Link href={card.href} className="home-feature-link inline-flex items-center gap-2 no-underline">
                                            Open module <ArrowRight size={16} />
                                        </Link>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="portal-section-slate section">
                <div className="portal-noise-overlay" aria-hidden="true" />
                <div className="container-main relative z-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
                    <div className="home-editorial-panel">
                        <span className="portal-kicker">Student Government Navigation</span>
                        <h2 className="home-section-title mt-4">
                            Access <span className="home-section-title-accent">official student-government sections.</span>
                        </h2>
                        <p className="home-section-lead mt-4">
                            Use this area to open council pages, constitutional commission information, and the Office of the Student Regent
                            without leaving the main portal structure.
                        </p>
                        <div className="home-editorial-actions mt-8 flex flex-wrap gap-4">
                            <Link href="/student-government" className="btn-primary no-underline">
                                Open Student Government
                            </Link>
                            <Link href="/student-government/osr" className="btn-secondary no-underline">
                                Open OSR
                            </Link>
                        </div>
                    </div>

                    <div className="home-nav-list">
                        {structureActions.map((card) => {
                            const Icon = card.icon;

                            return (
                                <Link key={card.title} href={card.href} className="home-nav-row no-underline">
                                    <div className="flex items-start gap-4">
                                        <div className="home-nav-icon-wrap">
                                            <Icon className="h-5 w-5" aria-hidden="true" />
                                        </div>
                                        <div>
                                            <h3 className="home-nav-title">{card.title}</h3>
                                            <p className="home-nav-copy">{card.description}</p>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </section>
            <AnnouncementsPanel announcements={announcements} />
            <OSRAnnouncementsSection slides={osrSlides} compact />
        </>
    );
}
