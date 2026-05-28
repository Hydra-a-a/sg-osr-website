'use client';

import { CheckCircle2, Clock3, Sparkles } from 'lucide-react';
import type { TrackStep } from '@/components/track/types';

interface TrackProgressPanelProps {
    status: string;
    steps: TrackStep[];
    resolutionNotes?: string;
}

export function TrackProgressPanel({ status, steps, resolutionNotes }: TrackProgressPanelProps) {
    const currentIndex = Math.max(0, steps.findLastIndex((step) => step.activeFor.includes(status)));

    return (
        <section className="rounded-3xl border border-[rgba(35,72,116,0.16)] bg-[linear-gradient(165deg,rgba(255,255,255,0.98),rgba(241,246,252,0.92))] p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand/75">
                        Progress and details
                    </p>
                    <h3 className="mt-1 text-xl font-semibold tracking-tight text-strong">Resolution progress</h3>
                </div>
                <div className="rounded-full border border-[rgba(35,72,116,0.16)] bg-white px-3 py-1 text-xs font-medium text-subtle">
                    Current stage: {steps[currentIndex]?.label || 'Ticket received'}
                </div>
            </div>

            <div className="rounded-2xl border border-[rgba(35,72,116,0.12)] bg-white px-4 py-2">
                {steps.map((step, index) => {
                    const isComplete = index < currentIndex;
                    const isCurrent = index === currentIndex;
                    const isFuture = index > currentIndex;

                    return (
                        <div key={step.label} className="flex gap-4 border-b border-[rgba(35,72,116,0.08)] py-4 last:border-b-0">
                            <div className="flex flex-col items-center">
                                <div
                                    className={[
                                        'flex h-10 w-10 items-center justify-center rounded-full border',
                                        isComplete ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : '',
                                        isCurrent ? 'border-[rgba(35,72,116,0.16)] bg-[rgba(35,72,116,0.1)] text-brand' : '',
                                        isFuture ? 'border-soft bg-surface-soft text-subtle' : '',
                                    ].join(' ')}
                                >
                                    {isComplete ? <CheckCircle2 size={18} /> : isCurrent ? <Sparkles size={18} /> : <Clock3 size={18} />}
                                </div>
                                {index < steps.length - 1 ? <div className="mt-2 h-full min-h-8 w-px bg-soft" /> : null}
                            </div>

                            <div className="pb-5">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className={`text-sm font-semibold ${isFuture ? 'text-subtle' : 'text-body'}`}>{step.label}</p>
                                    <span
                                        className={[
                                            'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                                            isComplete ? 'bg-emerald-50 text-emerald-700' : '',
                                            isCurrent ? 'bg-[rgba(35,72,116,0.1)] text-brand' : '',
                                        isFuture ? 'bg-[rgba(35,72,116,0.06)] text-subtle' : '',
                                    ].join(' ')}
                                >
                                        {isComplete ? 'Completed' : isCurrent ? 'Current' : 'Waiting'}
                                    </span>
                                </div>
                                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-subtle">{step.description}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {resolutionNotes?.trim() ? (
                <div className="mt-4 rounded-xl border border-[rgba(35,72,116,0.16)] bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand/80">
                        Latest resolution note
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-strong">{resolutionNotes}</p>
                </div>
            ) : null}
        </section>
    );
}
