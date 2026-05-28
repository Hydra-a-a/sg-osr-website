'use client';

import { Paperclip, ScrollText } from 'lucide-react';
import type { TrackTicket } from '@/components/track/types';

export function TrackCaseDetails({ ticket }: { ticket: TrackTicket }) {
    return (
        <section className="rounded-3xl border border-[rgba(35,72,116,0.16)] bg-[linear-gradient(165deg,rgba(255,255,255,0.98),rgba(241,246,252,0.92))] p-6">
            <div className="mb-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand/75">
                    Read-only record
                </p>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-strong">Case details</h3>
            </div>

            <div className="grid gap-0 overflow-hidden rounded-2xl border border-[rgba(35,72,116,0.14)] bg-white text-sm sm:grid-cols-2">
                <div className="border-b border-r border-[rgba(35,72,116,0.1)] p-4 sm:border-b-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">Student ID</p>
                    <p className="mt-2 font-medium text-strong">{ticket.studentId || 'N/A'}</p>
                </div>
                <div className="border-b border-[rgba(35,72,116,0.1)] p-4 sm:border-b-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">Campus</p>
                    <p className="mt-2 font-medium text-strong">{ticket.campus || 'N/A'}</p>
                </div>
                <div className="p-4 sm:col-span-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">College / Institute</p>
                    <p className="mt-2 font-medium text-strong">{ticket.college || 'N/A'}</p>
                </div>
            </div>

            {ticket.complaintNarrative?.trim() ? (
                <div className="mt-5 rounded-xl border border-[rgba(35,72,116,0.14)] bg-white p-5">
                    <div className="flex items-center gap-2">
                        <ScrollText size={16} className="text-subtle" />
                        <p className="text-sm font-semibold text-strong">Complaint narrative</p>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-body">{ticket.complaintNarrative}</p>
                </div>
            ) : null}

            {ticket.attachmentUrl?.trim() ? (
                <div className="mt-5 rounded-xl border border-[rgba(35,72,116,0.14)] bg-white p-4">
                    <div className="flex items-center gap-2">
                        <Paperclip size={15} className="text-subtle" />
                        <p className="text-sm font-semibold text-strong">Original attachment</p>
                    </div>
                    <div className="mt-2">
                        {ticket.attachmentUrl.startsWith('https://') ? (
                            <a
                                href={ticket.attachmentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-sm font-medium text-brand hover:underline"
                            >
                                View attachment
                            </a>
                        ) : (
                            <p className="text-sm text-subtle">Attachment link is unavailable.</p>
                        )}
                    </div>
                </div>
            ) : null}
        </section>
    );
}
