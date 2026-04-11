'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import useSWR from 'swr';
import { ExternalLink } from 'lucide-react';
import BackLink from '@/components/BackLink';
import type { DirectoryLogoSource } from '@/lib/council-logos';
import {
    buildCommissionProfiles,
    fetchStudentGovernmentDirectoryPayload,
    getCommissionAbbreviation,
    isRuntimeLogoSource,
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

    const selectedCommissionIndex = commissions.length > 0 ? selectedCommission % commissions.length : 0;
    const activeCommission = commissions[selectedCommissionIndex];

    return (
        <>
            <section className="portal-section-slate section">
                <div className="portal-noise-overlay" aria-hidden="true" />
                <div className="container-main relative z-10">
                    <div className="max-w-4xl">
                        <div className="mb-8 flex flex-col items-start gap-4">
                            <BackLink href="/student-government" label="Back to Student Government" className="text-slate-200 hover:text-white transition-colors" />
                            <span className="portal-eyebrow">Constitutional Commissions</span>
                        </div>
                        <h1 className="mt-6 portal-title">
                            Oversight and governance bodies under the SSC.
                        </h1>
                        <p className="mt-6 portal-lead">
                            These commissions are inferred from the live directory feed and grouped here so oversight, elections, budgeting,
                            appointments, and program review are not buried inside the broader directory experience.
                        </p>
                    </div>
                </div>
            </section>

            <section className="portal-section-dark section">
                <div className="portal-noise-overlay" aria-hidden="true" />
                <div className="container-main relative z-10">
                    <div className="grid gap-7 md:grid-cols-3 md:gap-8">
                        <article className="portal-panel sg-hover-card p-7 md:p-8">
                            <h2 className="text-xl font-bold text-white">Constitutional mandate</h2>
                            <p className="mt-3 text-sm leading-7 text-slate-300">Constitutional Commissions are independent oversight bodies under the SSC that protect due process, fairness, and institutional integrity in student governance.</p>
                        </article>
                        <article className="portal-panel sg-hover-card p-7 md:p-8">
                            <h2 className="text-xl font-bold text-white">Core functions</h2>
                            <p className="mt-3 text-sm leading-7 text-slate-300">They run elections, review budgets, manage scholarships and appointments, hear discipline-related concerns, and monitor project and policy compliance.</p>
                        </article>
                        <article className="portal-panel sg-hover-card p-7 md:p-8">
                            <h2 className="text-xl font-bold text-white">Why this matters</h2>
                            <p className="mt-3 text-sm leading-7 text-slate-300">By separating checks-and-balances from day-to-day executive work, commissions improve transparency, reduce bias, and strengthen student trust in outcomes.</p>
                        </article>
                    </div>
                </div>
            </section>

            <section className="portal-section-slate section">
                <div className="portal-noise-overlay" aria-hidden="true" />
                <div className="container-main relative z-10">
                    {isLoading && (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <div key={index} className="portal-panel p-6">
                                    <div className="skeleton mx-auto h-16 w-16 rounded-full" />
                                    <div className="skeleton mx-auto mt-4 h-4 w-28" />
                                    <div className="skeleton mx-auto mt-3 h-3 w-40" />
                                </div>
                            ))}
                        </div>
                    )}

                    {!isLoading && error && (
                        <div className="portal-panel p-6 text-center">
                            <p className="text-base font-semibold text-red-300">Unable to load constitutional commission data right now.</p>
                        </div>
                    )}

                    {!isLoading && !error && commissions.length === 0 && (
                        <div className="portal-panel p-6 text-center">
                            <p className="text-base font-semibold text-white">No constitutional commission entries are available from the current directory feed.</p>
                            <p className="mt-2 text-sm text-slate-300">If that is unexpected, check the directory workbook classification for those entries.</p>
                        </div>
                    )}

                    {commissions.length > 0 && activeCommission && (
                        <>
                            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                                {commissions.map((commission, index) => {
                                    const logoSrc = (commission.logoUrl || '').trim();
                                    const isActive = selectedCommissionIndex === index;
                                    const fallbackAbbreviation = String(
                                        commission.abbr || getCommissionAbbreviation(String(commission.name || 'CC'))
                                    );

                                    return (
                                        <button
                                            key={`${normalizeStudentGovernmentText(commission.name)}-${index}`}
                                            type="button"
                                            onClick={() => setSelectedCommission(index)}
                                            className="portal-panel sg-commission-card sg-hover-card sg-selector-card p-6 text-left"
                                            data-active={isActive}
                                        >
                                            <div className="relative mx-auto h-16 w-16 overflow-hidden rounded-full border border-white/10 bg-white/10">
                                                {logoSrc ? (
                                                    <Image
                                                        src={logoSrc}
                                                        alt={String(commission.name || 'Commission logo')}
                                                        fill
                                                        sizes="64px"
                                                        unoptimized={isRuntimeLogoSource(logoSrc)}
                                                        className="object-contain p-1.5"
                                                    />
                                                ) : (
                                                    <div className="flex h-full w-full items-center justify-center text-xs font-bold text-slate-300">
                                                        {fallbackAbbreviation}
                                                    </div>
                                                )}
                                            </div>
                                            <p className="mt-4 text-[1rem] font-semibold leading-6 text-white">{commission.name}</p>
                                            <p className="mt-2 text-sm leading-6 text-slate-300">
                                                {commission.position && commission.position !== 'Organization'
                                                    ? commission.position
                                                    : 'Constitutional Commission'}
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="mt-12 grid items-center gap-10 lg:gap-12 lg:grid-cols-[0.95fr_1.05fr]">
                                <div className="portal-panel sg-hover-card p-6 md:p-8">
                                    <div className="relative aspect-square w-full overflow-hidden rounded-[1.75rem] bg-white/5">
                                        {activeCommission.logoUrl ? (
                                            <Image
                                                src={activeCommission.logoUrl}
                                                alt={String(activeCommission.name || 'Constitutional Commission')}
                                                fill
                                                sizes="(max-width: 1024px) 100vw, 50vw"
                                                unoptimized={isRuntimeLogoSource(activeCommission.logoUrl)}
                                                className="object-contain p-8 md:p-12"
                                            />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-5xl font-bold text-slate-300">
                                                {activeCommission.abbr}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="portal-panel sg-hover-card p-7 md:p-10">
                                    <span className="inline-flex rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-[var(--rtu-gold-light)]">
                                        {activeCommission.abbr}
                                    </span>
                                    <h2 className="mt-5 text-3xl font-bold text-white md:text-4xl">{activeCommission.name}</h2>
                                    <p className="mt-5 text-base leading-8 text-slate-300 md:text-lg">{activeCommission.description}</p>
                                    <p className="mt-4 text-sm text-slate-400">
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
                        </>
                    )}
                </div>
            </section>
        </>
    );
}
