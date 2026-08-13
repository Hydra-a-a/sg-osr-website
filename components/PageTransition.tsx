'use client';

import { usePathname } from 'next/navigation';

export default function PageTransition({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const shouldAnimate = pathname !== '/' && !pathname.startsWith('/hub');

    return (
        <div key={pathname} className={`page-transition-shell ${shouldAnimate ? 'page-elements-enter' : ''} w-full h-full`}>
            {children}
        </div>
    );
}
