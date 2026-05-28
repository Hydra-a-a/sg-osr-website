'use client';

import { CalendarDays, FileText, ShieldCheck } from 'lucide-react';
import { TrackStatusBadge } from '@/components/track/TrackStatusBadge';

interface TrackCaseSummaryProps {
    ticketId: string;
    title: string;
    status: string;
    submittedAtLabel: string;
    submittedAtShort: string;
    latestOfficialUpdate: string;
    nextStepGuidance: string;
    isOwnerView: boolean;
    category?: string;
}

export function TrackCaseSummary({
    ticketId,
    title,
    status,
    submittedAtLabel,
    submittedAtShort,
    latestOfficialUpdate,
    nextStepGuidance,
    isOwnerView,
    category,
}: TrackCaseSummaryProps) {
    return (
        <section className="overflow-hidden rounded-3xl border border-[rgba(35,72,116,0.16)] bg-[linear-gradient(165deg,rgba(255,255,255,0.98),rgba(242,247,252,0.92))] p-6">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(250px,0.8fr)]">
                <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand/75">
                                Case summary
                            </p>
                            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-strong md:text-[2rem]">
                                {title}
                            </h2>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-subtle">
                                <span className="inline-flex items-center gap-2 rounded-full border border-soft bg-surface-soft px-3 py-1 font-mono text-xs font-semibold text-strong">
                                    <FileText size={14} />
                                    {ticketId}
                                </span>
                                {category ? <span>Category: <span className="font-medium text-strong">{category}</span></span> : null}
                            </div>
                        </div>

                        <TrackStatusBadge status={status} />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-[rgba(35,72,116,0.14)] bg-white p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
                                Latest official update
                            </p>
                            <p className="mt-2 text-sm font-medium leading-relaxed text-strong">{latestOfficialUpdate}</p>
                        </div>
                        <div className="rounded-xl border border-[rgba(35,72,116,0.14)] bg-white p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
                                Next recommended step
                            </p>
                            <p className="mt-2 text-sm font-medium leading-relaxed text-strong">{nextStepGuidance}</p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-[rgba(35,72,116,0.14)] bg-[linear-gradient(145deg,rgba(35,72,116,0.06),rgba(255,255,255,0.9),rgba(203,165,77,0.08))] p-5">
                    <div className="flex items-center gap-2 text-brand">
                        <CalendarDays size={16} />
                        <p className="text-sm font-semibold">Filed on record</p>
                    </div>
                    <p className="mt-2 text-lg font-semibold text-strong">{submittedAtShort}</p>
                    <p className="mt-1 text-sm leading-relaxed text-subtle">{submittedAtLabel}</p>

                    <div className="mt-5 rounded-xl border border-[rgba(35,72,116,0.14)] bg-white p-4">
                        <div className="flex items-center gap-2">
                            <ShieldCheck size={15} className="text-brand" />
                            <p className="text-sm font-semibold text-strong">
                                {isOwnerView ? 'Owner workspace' : 'Protected status view'}
                            </p>
                        </div>
                        <p className="mt-2 text-sm leading-relaxed text-subtle">
                            {isOwnerView
                                ? 'You are viewing the full grievance workspace with timeline context, protected details, and follow-up actions.'
                                : 'This result is privacy protected. Only the ticket owner or someone with a valid access token can view narrative details and discussion.'}
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
