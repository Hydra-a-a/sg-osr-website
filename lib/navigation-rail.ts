export interface NavigationRailLink {
    href: string;
    label: string;
}

interface NavigationRailSection {
    root: string;
    label: string;
    links: NavigationRailLink[];
}

const PATH_LABELS: Record<string, string> = {
    '/': 'Home',
    '/about': 'About',
    '/directory': 'Directory',
    '/hub': 'Student Hub',
    '/hub/lost-found': 'Lost and Found',
    '/hub/commute': 'Commute Guide',
    '/hub/commute/contribute': 'Contribute Route',
    '/hub/commute/leaderboard': 'Route Leaderboard',
    '/login': 'Portal Sign In',
    '/news': 'News',
    '/osr': 'Office of the Student Regent',
    '/projects': 'Projects',
    '/services': 'Services',
    '/services/admin': 'Admin Hub',
    '/services/admin/grievances': 'Grievance Queue',
    '/services/admin/proposals': 'Proposal Queue',
    '/services/admin/routes': 'Route Moderation',
    '/services/grievance': 'Submit a Grievance',
    '/services/proposals': 'Project Proposals',
    '/services/proposals/track': 'Track Proposals',
    '/services/track': 'Track a Grievance',
    '/student-government': 'Student Government',
    '/student-government/commissions': 'Commissions',
    '/student-government/councils': 'Councils',
    '/student-government/osr': 'Office of the Student Regent',
    '/transparency': 'Transparency',
};

const SECTION_QUICK_LINKS: NavigationRailSection[] = [
    {
        root: '/services',
        label: 'Services',
        links: [
            { href: '/services', label: 'Overview' },
            { href: '/services/grievance', label: 'Submit Grievance' },
            { href: '/services/track', label: 'Track a Grievance' },
            { href: '/services/proposals', label: 'Project Proposals' },
        ],
    },
    {
        root: '/hub',
        label: 'Student Hub',
        links: [
            { href: '/hub', label: 'Overview' },
            { href: '/hub/lost-found', label: 'Lost and Found' },
            { href: '/hub/commute', label: 'Commute Guide' },
            { href: '/hub/commute/contribute', label: 'Contribute Route' },
            { href: '/hub/commute/leaderboard', label: 'Leaderboard' },
        ],
    },
    {
        root: '/student-government',
        label: 'Student Government',
        links: [
            { href: '/student-government', label: 'Overview' },
            { href: '/student-government/osr', label: 'OSR' },
            { href: '/student-government/councils', label: 'Councils' },
            { href: '/student-government/commissions', label: 'Commissions' },
        ],
    },
];

const HIDDEN_PATHS = new Set(['/']);

function humanizeSegment(segment: string): string {
    return segment
        .split('-')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

export function shouldShowNavigationRail(pathname: string): boolean {
    if (!pathname) {
        return false;
    }

    return !HIDDEN_PATHS.has(pathname);
}

export function getNavigationLabel(pathname: string): string {
    return PATH_LABELS[pathname] || humanizeSegment(pathname.split('/').filter(Boolean).pop() || '');
}

export function buildNavigationBreadcrumbs(pathname: string): NavigationRailLink[] {
    if (!pathname || pathname === '/') {
        return [];
    }

    const segments = pathname.split('/').filter(Boolean);
    const breadcrumbs: NavigationRailLink[] = [{ href: '/', label: PATH_LABELS['/'] }];

    let currentPath = '';
    for (const segment of segments) {
        currentPath += `/${segment}`;
        breadcrumbs.push({
            href: currentPath,
            label: getNavigationLabel(currentPath),
        });
    }

    return breadcrumbs;
}

export function getSectionQuickLinks(pathname: string): NavigationRailSection | null {
    if (!pathname) {
        return null;
    }

    return SECTION_QUICK_LINKS.find((section) => pathname === section.root || pathname.startsWith(`${section.root}/`)) || null;
}
