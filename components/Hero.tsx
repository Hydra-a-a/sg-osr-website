'use client';

import useSWR from 'swr';
import Link from 'next/link';
import { ExternalLink, FileText, Landmark, Newspaper } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { QuickLink } from '@/schemas/links';

const iconMap: Record<string, LucideIcon> = {
    FileText,
    Landmark,
    Newspaper,
    ExternalLink,
};

const fallbackLinks: QuickLink[] = [
    {
        id: 'hero-grievance',
        label: 'Student Grievances',
        desc: 'Submit concerns, follow updates, and continue the feedback loop securely.',
        href: '/services/grievance',
        icon: 'FileText',
    },
    {
        id: 'hero-governance',
        label: 'Student Government',
        desc: 'Browse councils, commissions, and the Office of the Student Regent.',
        href: '/student-government',
        icon: 'Landmark',
    },
    {
        id: 'hero-news',
        label: 'Transparency and News',
        desc: 'Open records, resolutions, and official updates from the portal.',
        href: '/transparency',
        icon: 'Newspaper',
    },
];

export default function Hero() {
    const { data: linksResponse } = useSWR('/api/config/links', (url: string) => fetch(url).then((response) => response.json()));

    const links: QuickLink[] = linksResponse?.data || fallbackLinks;
    const heroLinks = links.length > 0 ? links.slice(0, 3) : fallbackLinks;

    return (
        <section className="home-hero-section relative overflow-hidden">
            <div className="portal-noise-overlay" aria-hidden="true" />
            <div className="home-hero-texture" aria-hidden="true" />

            <div className="container-main relative z-10 py-16 md:py-24 lg:py-28">
                <div className="home-hero-shell">
                    <div className="home-hero-copy">
                        <p className="home-hero-kicker">Rizal Technological University</p>
                        <h1 className="home-hero-title">
                            RTU <span className="home-hero-title-accent">Student Government</span> Portal
                        </h1>
                        <p className="home-hero-lead">
                            Empowering Rizalianos through transparent, responsive, and inclusive student governance.
                            The unified digital home of the Supreme Student Council, its constitutional commissions,
                            and the Office of the Student Regent.
                        </p>
                        <div className="home-hero-actions">
                            <Link href="/services" className="btn-primary text-base no-underline text-center">
                                Access Services
                            </Link>
                            <Link href="/student-government" className="btn-secondary text-base no-underline text-center">
                                Student Government
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="home-hero-utility-strip">
                    {heroLinks.map((item) => {
                        const IconComponent = iconMap[item.icon || 'ExternalLink'] || ExternalLink;

                        return (
                            <Link
                                key={item.label}
                                href={item.href}
                                className="home-hero-utility-link no-underline"
                            >
                                <div className="home-hero-utility-icon">
                                    <IconComponent size={18} />
                                </div>
                                <div className="min-w-0">
                                    <p className="home-hero-utility-label">{item.label}</p>
                                    <p className="home-hero-utility-copy">{item.desc}</p>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
