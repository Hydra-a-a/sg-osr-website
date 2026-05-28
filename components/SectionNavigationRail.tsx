'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Compass } from 'lucide-react';
import {
    buildNavigationBreadcrumbs,
    getSectionQuickLinks,
    shouldShowNavigationRail,
} from '@/lib/navigation-rail';

export default function SectionNavigationRail() {
    const pathname = usePathname() || '';

    if (!shouldShowNavigationRail(pathname)) {
        return null;
    }

    const breadcrumbs = buildNavigationBreadcrumbs(pathname);
    const quickLinkSection = getSectionQuickLinks(pathname);

    if (breadcrumbs.length === 0 && !quickLinkSection) {
        return null;
    }

    return (
        <section className="border-b border-soft bg-surface-elevated/90 shadow-[0_10px_28px_-24px_rgba(26,51,82,0.35)] backdrop-blur">
            <div className="container-main py-3">
                <div className="flex flex-col gap-3">
                    {breadcrumbs.length > 0 ? (
                        <nav aria-label="Breadcrumb" className="overflow-x-auto">
                            <ol className="flex min-w-max items-center gap-1.5 text-sm text-body">
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
                                                    className="rounded-full px-2 py-1 transition-colors hover:bg-surface-soft hover:text-body"
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

                    {quickLinkSection ? (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-body">
                                <Compass size={13} />
                                <span>Jump within {quickLinkSection.label}</span>
                            </div>
                            <div className="overflow-x-auto">
                                <div className="flex min-w-max items-center gap-2">
                                    {quickLinkSection.links.map((link) => {
                                        const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);

                                        return (
                                            <Link
                                                key={link.href}
                                                href={link.href}
                                                aria-current={isActive ? 'page' : undefined}
                                                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all ${
                                                    isActive
                                                        ? 'border-[color:var(--accent-primary)] bg-[rgba(35,72,116,0.1)] text-strong shadow-sm'
                                                        : 'border-soft bg-surface-base text-body hover:border-[color:var(--accent-secondary)] hover:bg-surface-soft'
                                                }`}
                                            >
                                                {link.label}
                                            </Link>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>
        </section>
    );
}
