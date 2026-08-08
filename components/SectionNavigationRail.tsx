'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Compass } from 'lucide-react';
import {
    buildNavigationBreadcrumbs,
    shouldShowNavigationRail,
} from '@/lib/navigation-rail';

export default function SectionNavigationRail() {
    const pathname = usePathname() || '';

    if (!shouldShowNavigationRail(pathname)) {
        return null;
    }

    const breadcrumbs = buildNavigationBreadcrumbs(pathname);

    if (breadcrumbs.length === 0) {
        return null;
    }

    return (
        <section className="border-b border-soft bg-surface-elevated/90 shadow-[0_10px_28px_-24px_rgba(26,51,82,0.35)] backdrop-blur">
            <div className="container-main py-3">
                <div className="flex flex-col gap-3 md:items-start items-center text-center md:text-left">
                    {breadcrumbs.length > 0 ? (
                        <nav aria-label="Breadcrumb" className="overflow-x-auto max-w-full">
                            <ol className="flex min-w-max items-center justify-center gap-1.5 text-sm text-body md:justify-start">
                                {breadcrumbs.map((crumb, index) => {
                                    const isCurrent = index === breadcrumbs.length - 1;

                                    return (
                                        <li key={crumb.href} className="flex items-center gap-1.5">
                                            {index > 0 ? <ChevronRight size={14} className="text-subtle/70" aria-hidden="true" /> : null}
                                            {isCurrent ? (
                                                <span aria-current="page" className="font-semibold text-strong">
                                                    {crumb.label}
                                                </span>
                                            ) : (
                                                <Link
                                                    href={crumb.href}
                                                    className="rounded-md px-2 py-1 transition-colors hover:text-body"
                                                >
                                                    {crumb.label}
                                                </Link>
                                            )}
                                        </li>
                                    );
                                })}
                            </ol>
                        </nav>
                    ) : null}

                </div>
            </div>
        </section>
    );
}
