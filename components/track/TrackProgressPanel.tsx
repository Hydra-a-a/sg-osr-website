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
        <section className="rounded-3xl border border-white/10 bg-[linear-gradient(145deg,rgba(12,22,36,0.72),rgba(11,20,34,0.56))] shadow-[0_20px_50px_rgba(4,10,22,0.2)] p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                    <h3 className="text-xl font-semibold tracking-tight text-white">Resolution progress</h3>
                </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-2">
                {steps.map((step, index) => {
                    const isComplete = index < currentIndex;
                    const isCurrent = index === currentIndex;
                    const isFuture = index > currentIndex;

                    return (
                        <div key={step.label} className="flex gap-4 border-b border-white/10 py-4 last:border-b-0">
                            <div className="flex flex-col items-center">
                                <div
                                    className={[
                                        'flex h-10 w-10 items-center justify-center rounded-full border',
                                        isComplete ? 'border-emerald-300/30 bg-emerald-300/10 text-emerald-200' : '',
                                        isCurrent ? 'border-sky-300/30 bg-sky-300/10 text-sky-200' : '',
                                        isFuture ? 'border-white/10 bg-white/[0.04] text-slate-500' : '',
                                    ].join(' ')}
                                >
                                    {isComplete ? <CheckCircle2 size={18} /> : isCurrent ? <Sparkles size={18} /> : <Clock3 size={18} />}
                                </div>
                                {index < steps.length - 1 ? <div className="mt-2 h-full min-h-8 w-px bg-white/10" /> : null}
                            </div>

                            <div className="pb-5">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className={`text-sm font-semibold ${isFuture ? 'text-slate-500' : 'text-slate-100'}`}>{step.label}</p>
                                    <span className={`text-[11px] font-semibold uppercase tracking-[0.1em] ${isComplete ? 'text-emerald-300' : isCurrent ? 'text-sky-200' : 'text-slate-500'}`}>
                                        {isComplete ? 'Completed' : isCurrent ? 'Current' : 'Waiting'}
                                    </span>
                                </div>
                                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">{step.description}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {resolutionNotes?.trim() ? (
                <div className="mt-4 rounded-xl border border-white/10 bg-black/10 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200/80">
                        Latest resolution note
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-100">{resolutionNotes}</p>
                </div>
            ) : null}
        </section>
    );
}
