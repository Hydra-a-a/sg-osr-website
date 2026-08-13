import Link from 'next/link';
import Image from 'next/image';
import {
    ArrowTopRightOnSquareIcon,
    BuildingLibraryIcon,
    DocumentTextIcon,
    NewspaperIcon,
} from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';
import type { QuickLink } from '@/schemas/links';

type HeroIcon = ComponentType<SVGProps<SVGSVGElement>>;

const iconMap: Record<string, HeroIcon> = {
    FileText: DocumentTextIcon,
    Landmark: BuildingLibraryIcon,
    Newspaper: NewspaperIcon,
    ExternalLink: ArrowTopRightOnSquareIcon,
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

export default function Hero({ links: configuredLinks }: { links?: QuickLink[] }) {
    const links: QuickLink[] = configuredLinks?.length ? configuredLinks : fallbackLinks;
    const heroLinks = links.length > 0 ? links.slice(0, 3) : fallbackLinks;

    return (
        <section className="home-hero-section relative overflow-hidden">
            <div className="home-hero-photo" aria-hidden="true">
                <Image
                    src="/images/rtu-campus-home.webp"
                    alt=""
                    fill
                    priority
                    sizes="100vw"
                    quality={70}
                    className="home-hero-image"
                />
            </div>
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
                        const IconComponent = iconMap[item.icon || 'ExternalLink'] || ArrowTopRightOnSquareIcon;

                        return (
                            <Link
                                key={item.label}
                                href={item.href}
                                className="home-hero-utility-link no-underline"
                            >
                                <div className="home-hero-utility-icon">
                                    <IconComponent className="h-[18px] w-[18px]" aria-hidden="true" />
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
