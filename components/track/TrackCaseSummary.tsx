'use client';

import { CalendarDays, FileText } from 'lucide-react';
import { TrackStatusBadge } from '@/components/track/TrackStatusBadge';

interface TrackCaseSummaryProps {
    ticketId: string;
    title: string;
    status: string;
    submittedAtShort: string;
    latestOfficialUpdate: string;
    isOwnerView: boolean;
    category?: string;
}

export function TrackCaseSummary({
    ticketId,
    title,
    status,
    submittedAtShort,
    latestOfficialUpdate,
    isOwnerView,
    category,
}: TrackCaseSummaryProps) {
    return (
        <section className="overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(145deg,rgba(12,22,36,0.72),rgba(11,20,34,0.56))] shadow-[0_20px_50px_rgba(4,10,22,0.2)] p-6">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(250px,0.8fr)]">
                <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-white md:text-[2rem]">
                                {title}
                            </h2>
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-400">
                                <span className="inline-flex items-center gap-2 font-mono text-xs font-semibold text-white">
                                    <FileText size={14} />
                                    {ticketId}
                                </span>
                                {category ? <span className="font-medium text-slate-200">{category}</span> : null}
                            </div>
                        </div>

                        <TrackStatusBadge status={status} />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-white/10 bg-black/10 p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                Latest official update
                            </p>
                            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-100">{latestOfficialUpdate}</p>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                    <div className="flex items-center gap-2 text-amber-200">
                        <CalendarDays size={16} />
                        <p className="text-sm font-semibold">Submitted</p>
                    </div>
                    <p className="mt-2 text-lg font-semibold text-white">{submittedAtShort}</p>

                    {!isOwnerView ? <p className="mt-5 border-t border-white/10 pt-4 text-sm leading-relaxed text-slate-400">Privacy-protected view. Owner verification is required for full details.</p> : null}
                </div>
            </div>
        </section>
    );
}
