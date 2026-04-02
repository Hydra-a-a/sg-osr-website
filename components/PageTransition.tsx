'use client';

import { usePathname } from 'next/navigation';

export default function PageTransition({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div style={{ minHeight: 'inherit' }}>
            <div
                key={pathname}
                className="page-transition-shell"
            >
                <span aria-hidden className="page-transition-gold-wash" />
                {children}
            </div>
        </div>
    );
}
