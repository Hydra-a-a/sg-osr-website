'use client';

import { Paperclip, ScrollText } from 'lucide-react';
import type { TrackTicket } from '@/components/track/types';

export function TrackCaseDetails({ ticket }: { ticket: TrackTicket }) {
    return (
        <section className="rounded-3xl border border-white/10 bg-[linear-gradient(145deg,rgba(12,22,36,0.72),rgba(11,20,34,0.56))] shadow-[0_20px_50px_rgba(4,10,22,0.2)] p-6">
            <div className="mb-5">
                <h3 className="text-xl font-semibold tracking-tight text-white">Case details</h3>
            </div>

            <div className="grid gap-0 overflow-hidden rounded-2xl border border-white/10 bg-black/10 text-sm sm:grid-cols-2">
                <div className="border-b border-r border-white/10 p-4 sm:border-b-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Student ID</p>
                    <p className="mt-2 font-medium text-white">{ticket.studentId || 'N/A'}</p>
                </div>
                <div className="border-b border-white/10 p-4 sm:border-b-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">Campus</p>
                    <p className="mt-2 font-medium text-white">{ticket.campus || 'N/A'}</p>
                </div>
                <div className="p-4 sm:col-span-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">College / Institute</p>
                    <p className="mt-2 font-medium text-white">{ticket.college || 'N/A'}</p>
                </div>
            </div>

            {ticket.complaintNarrative?.trim() ? (
                <div className="mt-5 rounded-xl border border-white/10 bg-black/10 p-5">
                    <div className="flex items-center gap-2">
                        <ScrollText size={16} className="text-slate-400" />
                        <p className="text-sm font-semibold text-white">Complaint narrative</p>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{ticket.complaintNarrative}</p>
                </div>
            ) : null}

            {ticket.attachmentUrl?.trim() ? (
                <div className="mt-5 rounded-xl border border-white/10 bg-black/10 p-4">
                    <div className="flex items-center gap-2">
                        <Paperclip size={15} className="text-slate-400" />
                        <p className="text-sm font-semibold text-white">Original attachment</p>
                    </div>
                    <div className="mt-2">
                        {ticket.attachmentUrl.startsWith('https://') ? (
                            <a
                                href={ticket.attachmentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm font-medium text-sky-200 hover:underline"
                            >
                                View attachment
                            </a>
                        ) : (
                            <p className="text-sm text-slate-400">Attachment link is unavailable.</p>
                        )}
                    </div>
                </div>
            ) : null}
        </section>
    );
}
