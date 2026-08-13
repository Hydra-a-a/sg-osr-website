import Link from 'next/link';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import {
    ArrowRightIcon,
    BuildingLibraryIcon,
    DocumentTextIcon,
    FolderIcon,
    MagnifyingGlassIcon,
    ShieldCheckIcon,
    UserGroupIcon,
} from '@heroicons/react/24/outline';
import { getAccessVisibilityState } from '@/lib/access-visibility';
import { PORTAL_MODE_COOKIE } from '@/lib/portal-mode';

const primaryActions = [
    {
        title: 'Grievances and appeals',
        description: 'Submit concerns, grievances, and monitor submissions.',
        href: '/services/grievance',
        icon: DocumentTextIcon,
        accent: 'blue' as const,
        requiresLeader: false,
    },
    {
        title: 'Project proposals',
        description: 'Leaders can submit proposals, respond to review notes, and track revisions without leaving the portal.',
        href: '/services/proposals',
        icon: FolderIcon,
        accent: 'gold' as const,
        requiresLeader: true,
    },
    {
        title: 'Transparency records',
        description: 'Open resolutions, reports, and information made public for accountability.',
        href: '/transparency',
        icon: ShieldCheckIcon,
        accent: 'sky' as const,
        requiresLeader: false,
    },
] as const;

const utilityActions = [
    {
        title: 'Student Government',
        description: 'Review councils, commissions, and the Office of the Student Regent from one organized section.',
        href: '/student-government',
        icon: BuildingLibraryIcon,
    },
    {
        title: 'Directory',
        description: 'Find offices, councils, or academic organizations and their contact details.',
        href: '/directory',
        icon: MagnifyingGlassIcon,
    },
    {
        title: 'Services Console',
        description: 'Go directly to the services page and file grievances, or track submissions.',
        href: '/services',
        icon: UserGroupIcon,
    },
];

export default async function HomeCoreActions() {
    const [session, cookieStore] = await Promise.all([auth(), cookies()]);
    const portalMode = cookieStore.get(PORTAL_MODE_COOKIE)?.value || '';
    const visibility = getAccessVisibilityState(session?.user?.role, portalMode, '');
    const visiblePrimary = primaryActions.filter((action) => !action.requiresLeader || visibility.canSeeLeaderFeatures);
    const featuredAction = visiblePrimary[0];
    const supportingActions = visiblePrimary.slice(1);
    const FeaturedIcon = featuredAction.icon;
    const layoutClassName = [
        'home-command-layout',
        'mt-10',
        supportingActions.length === 0 ? 'home-command-layout--solo' : '',
        supportingActions.length === 1 ? 'home-command-layout--single-support' : '',
    ].filter(Boolean).join(' ');

    return (
        <section className="portal-section-dark section home-core-section">
            <div className="portal-noise-overlay" aria-hidden="true" />
            <div className="container-main relative z-10">
                <div>
                    <h2 className="home-section-title">
                        Choose where to go, <span className="home-section-title-accent">Rizaliano.</span>
                    </h2>
                    <p className="home-section-lead mt-4">
                        Go to caseworks, proposals, and transparency records.
                    </p>
                    <div className="home-core-divider" aria-hidden="true">
                        <span className="home-core-divider-mark" />
                    </div>
                </div>

                <div className={layoutClassName}>
                    <article className="home-command-main" data-accent={featuredAction.accent}>
                        <div className="home-feature-emblem" aria-hidden="true">
                            <div className="home-feature-icon">
                                <FeaturedIcon className="h-8 w-8" aria-hidden="true" />
                            </div>
                        </div>
                        <div className="home-feature-body">
                            <h3 className="home-feature-title">{featuredAction.title}</h3>
                            <p className="home-feature-copy">{featuredAction.description}</p>
                            <Link href={featuredAction.href} className="home-feature-link inline-flex items-center gap-2 no-underline">
                                Start case intake <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                            </Link>
                        </div>
                    </article>

                    {supportingActions.length > 0 && (
                        <div className="home-command-rail">
                            {supportingActions.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <Link key={item.title} href={item.href} className="home-command-item no-underline" data-accent={item.accent}>
                                        <div className="home-supporting-icon">
                                            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                                        </div>
                                        <div className="home-supporting-copy-wrap">
                                            <h3 className="home-supporting-title">{item.title}</h3>
                                            <p className="home-supporting-copy">{item.description}</p>
                                        </div>
                                        <span className="home-command-item-link">
                                            Open <ArrowRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                        </span>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="home-ops-list mt-8">
                    {utilityActions.map((item) => {
                        const Icon = item.icon;
                        return (
                            <Link key={item.title} href={item.href} className="home-ops-row no-underline">
                                <div className="home-utility-icon-wrap">
                                    <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                                </div>
                                <div>
                                    <p className="home-utility-title">{item.title}</p>
                                    <p className="home-utility-copy">{item.description}</p>
                                </div>
                                <span className="home-ops-link">
                                    Open <ArrowRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
