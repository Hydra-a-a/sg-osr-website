'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import { ExternalLink } from 'lucide-react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import BackLink from '@/components/BackLink';
import { SectionPlaceholderIcon } from '@/components/SectionPlaceholderIcon';
import type { DirectoryLogoSource } from '@/lib/council-logos';
import {
    buildCommissionProfiles,
    fetchStudentGovernmentDirectoryPayload,
    getCommissionAbbreviation,
    isExternalRuntimeLogoSource,
    normalizeStudentGovernmentText,
    STUDENT_GOVERNMENT_DIRECTORY_SWR_OPTIONS,
} from '@/lib/student-government';

export default function StudentGovernmentCommissionsPage() {
    const { data: directoryResponse, error, isLoading } = useSWR(
        '/api/directory',
        fetchStudentGovernmentDirectoryPayload,
        STUDENT_GOVERNMENT_DIRECTORY_SWR_OPTIONS
    );
    const directoryLeaders = useMemo(
        () => (directoryResponse?.leaders || []) as DirectoryLogoSource[],
        [directoryResponse?.leaders]
    );
    const commissions = useMemo(() => buildCommissionProfiles(directoryLeaders), [directoryLeaders]);
    const [selectedCommission, setSelectedCommission] = useState(0);
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [scrollRequestId, setScrollRequestId] = useState(0);
    const commissionProfileRef = useRef<HTMLDivElement | null>(null);

    const selectedCommissionIndex = commissions.length > 0 ? selectedCommission % commissions.length : 0;
    const activeCommission = commissions[selectedCommissionIndex];

    useEffect(() => {
        if (!isProfileOpen || !scrollRequestId || !commissionProfileRef.current) {
            return;
        }

        const prefersReducedMotion = typeof window !== 'undefined'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        commissionProfileRef.current.scrollIntoView({
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
            block: 'center',
        });
    }, [isProfileOpen, selectedCommissionIndex, scrollRequestId]);

    useEffect(() => {
        if (!isProfileOpen) {
            return;
        }

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsProfileOpen(false);
            }
        };

        window.addEventListener('keydown', onKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [isProfileOpen]);

    return (
        <>
            <section className="portal-section-dark section">
                <div className="portal-noise-overlay" aria-hidden="true" />
                <div className="container-main relative z-10">
                    <div className="commission-showcase-shell">
                        <div className="commission-showcase-head text-center md:text-left">
                            <div className="flex flex-col items-center gap-4 text-center md:items-start md:text-left">
                                <BackLink
                                    href="/student-government"
                                    label="Back to Student Government"
                                    className="text-slate-200 hover:text-white transition-colors md:mx-0 mx-auto"
                                />
                                <div className="flex items-center gap-3" aria-hidden="true">
                                    <span className="h-px w-10 bg-gradient-to-r from-transparent via-[rgba(247,217,150,0.82)] to-[rgba(247,217,150,0)]" />
                                    <span className="h-2 w-2 rotate-45 border border-sky-300/70 bg-sky-300/15" />
                                    <span className="h-px w-14 bg-gradient-to-r from-[rgba(125,211,252,0.78)] to-transparent" />
                                </div>
                                <span className="portal-kicker block">Constitutional Commissions</span>
                            </div>
                            <h1 className="portal-title mt-6 max-w-3xl mx-auto md:mx-0">Oversight and governance bodies under the SSC.</h1>
                            <p className="commission-showcase-lead mx-auto md:mx-0">
                                Constitutional commissions safeguarding fairness, accountability, and due process in student governance.
                            </p>
                        </div>

                        {isLoading && (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {Array.from({ length: 6 }).map((_, index) => (
                                    <div key={index} className="commission-state-card">
                                        <div className="skeleton mx-auto h-16 w-16 rounded-full" />
                                        <div className="skeleton mx-auto mt-4 h-4 w-28" />
                                        <div className="skeleton mx-auto mt-3 h-3 w-40" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {!isLoading && error && (
                            <div className="commission-state-card text-center">
                                <p className="text-base font-semibold text-red-300">Unable to load constitutional commission data right now.</p>
                            </div>
                        )}

                        {!isLoading && !error && commissions.length === 0 && (
                            <div className="commission-state-card text-center">
                                <p className="text-base font-semibold text-white">No constitutional commission entries are available from the current directory feed.</p>
                                <p className="mt-2 text-sm text-slate-300">If that is unexpected, check the directory workbook classification for those entries.</p>
                            </div>
                        )}

                        {commissions.length > 0 && activeCommission && (
                            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                                {commissions.map((commission, index) => {
                                    const logoSrc = (commission.logoUrl || '').trim();
                                    const isActive = selectedCommissionIndex === index;
                                    const tone = ['gold', 'sky', 'slate', 'lilac'][index % 4];
                                    const fallbackAbbreviation = String(
                                        commission.abbr || getCommissionAbbreviation(String(commission.name || 'CC'))
                                    );

                                    return (
                                        <button
                                            key={`${normalizeStudentGovernmentText(commission.name)}-${index}`}
                                            type="button"
                                            onClick={() => {
                                                setSelectedCommission(index);
                                                setIsProfileOpen(true);
                                                setScrollRequestId((current) => current + 1);
                                            }}
                                            className="commission-selector-card"
                                            data-active={isActive}
                                            data-tone={tone}
                                        >
                                            <div className="commission-selector-head">
                                                <span className="commission-selector-motif" aria-hidden="true" />
                                            </div>
                                            <div className="commission-selector-logo relative h-16 w-16 overflow-hidden">
                                                {logoSrc ? (
                                                    <Image
                                                        src={logoSrc}
                                                        alt={String(commission.name || 'Commission logo')}
                                                        fill
                                                        sizes="64px"
                                                        unoptimized={isExternalRuntimeLogoSource(logoSrc)}
                                                        className="object-contain p-1.5"
                                                    />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center text-sky-300">
                                                        <SectionPlaceholderIcon section="constitutional-commission" size={26} />
                                                    </div>
                                                )}
                                            </div>
                                            <p className="commission-selector-title">{commission.name}</p>
                                            <p className="commission-selector-role">
                                                {commission.position && commission.position !== 'Organization'
                                                    ? commission.position
                                                    : 'Constitutional Commission'}
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {commissions.length > 0 && activeCommission && isProfileOpen &&
                createPortal(
                    <div
                        ref={commissionProfileRef}
                        className="commission-modal-wrap"
                        role="dialog"
                        aria-modal="true"
                        aria-label={activeCommission.name}
                    >
                        <div
                            className="commission-modal-backdrop"
                            onClick={() => setIsProfileOpen(false)}
                            aria-hidden="true"
                        />
                        <div
                            className="commission-feature-shell commission-feature-shell-modal grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-10"
                        >
                            <button
                                type="button"
                                className="commission-modal-close"
                                onClick={() => setIsProfileOpen(false)}
                                aria-label="Close commission profile"
                            >
                                <XMarkIcon className="h-5 w-5" aria-hidden="true" />
                            </button>
                            <div className="commission-feature-media">
                                <div className="relative aspect-square w-full overflow-hidden rounded-[1.75rem] bg-white/5">
                                    {activeCommission.logoUrl ? (
                                        <Image
                                            src={activeCommission.logoUrl}
                                            alt={String(activeCommission.name || 'Constitutional Commission')}
                                            fill
                                            sizes="(max-width: 1024px) 100vw, 50vw"
                                            unoptimized={isExternalRuntimeLogoSource(activeCommission.logoUrl)}
                                            className="object-contain p-8 md:p-12"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center text-sky-300">
                                            <SectionPlaceholderIcon section="constitutional-commission" size={64} />
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="commission-feature-copy">
                                <div className="commission-feature-motif" aria-hidden="true">
                                    <span />
                                    <span />
                                    <span />
                                </div>
                                <h2 className="commission-feature-title">{activeCommission.name}</h2>
                                <p className="commission-feature-description">{activeCommission.description}</p>
                                <p className="commission-feature-role">
                                    {activeCommission.position && activeCommission.position !== 'Organization'
                                        ? activeCommission.position
                                        : 'Constitutional Commission'}
                                </p>
                                <div className="mt-8 flex flex-wrap gap-4">
                                    <Link href="/directory" className="btn-primary no-underline inline-flex items-center gap-2">
                                        Open Directory <ExternalLink size={16} />
                                    </Link>
                                    <Link href="/student-government" className="btn-secondary no-underline">
                                        Back to Student Government
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </>
    );
}
