'use client';

import { lazy, Suspense, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const AnnouncementPopup = lazy(() => import('./AnnouncementPopup'));

export default function DeferredAnnouncementPopup() {
    const pathname = usePathname() || '';
    const blockedRoute = pathname === '/' || pathname === '/osr' || pathname.startsWith('/hub');
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (blockedRoute) {
            return;
        }

        const load = () => setReady(true);
        if (typeof window.requestIdleCallback === 'function') {
            const idleId = window.requestIdleCallback(load, { timeout: 1500 });
            return () => window.cancelIdleCallback(idleId);
        }

        const timeoutId = window.setTimeout(load, 1000);
        return () => window.clearTimeout(timeoutId);
    }, [blockedRoute]);

    if (blockedRoute || !ready) {
        return null;
    }

    return (
        <Suspense fallback={null}>
            <AnnouncementPopup />
        </Suspense>
    );
}
