'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

type RouteAwareSiteChromeProps = {
    children: ReactNode;
    publicHeader: ReactNode;
    publicAlphaNotice: ReactNode;
    publicNavigationRail: ReactNode;
    publicFooter: ReactNode;
    publicAnnouncement: ReactNode;
};

export default function RouteAwareSiteChrome({
    children,
    publicHeader,
    publicAlphaNotice,
    publicNavigationRail,
    publicFooter,
    publicAnnouncement,
}: RouteAwareSiteChromeProps) {
    const pathname = usePathname() || '';
    const isAdminWorkspace = pathname === '/services/admin' || pathname.startsWith('/services/admin/');

    return (
        <>
            {!isAdminWorkspace ? publicHeader : null}
            {!isAdminWorkspace ? publicAlphaNotice : null}
            {!isAdminWorkspace ? publicNavigationRail : null}
            <main id="main-content" className="min-h-screen flex-1" tabIndex={-1}>
                {isAdminWorkspace ? children : <div className="page-transition-shell w-full h-full">{children}</div>}
            </main>
            {!isAdminWorkspace ? publicFooter : null}
            {!isAdminWorkspace ? publicAnnouncement : null}
        </>
    );
}
