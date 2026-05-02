'use client';

import { usePathname } from 'next/navigation';

export default function PageTransition({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div key={pathname} className="page-transition-shell page-elements-enter w-full h-full">
            {children}
        </div>
    );
}
