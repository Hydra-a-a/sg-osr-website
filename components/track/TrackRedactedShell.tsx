'use client';

import { LockKeyhole } from 'lucide-react';

interface TrackRedactedShellProps {
    ticketId: string;
    status: string;
    submittedAtLabel: string;
}

export function TrackRedactedShell({ ticketId, status, submittedAtLabel }: TrackRedactedShellProps) {
    return (
        <section className="rounded-3xl border border-amber-300/25 bg-[linear-gradient(145deg,rgba(69,54,26,0.34),rgba(11,20,34,0.68))] shadow-[0_20px_50px_rgba(4,10,22,0.2)] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl">
                    <h3 className="text-xl font-semibold tracking-tight text-white">Privacy-protected ticket</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">This ticket is privacy protected. Status is visible; narrative, attachments, discussion, and sensitive metadata require owner verification.</p>
                </div>

                <div className="rounded-xl border border-amber-300/20 bg-black/10 px-4 py-3 text-sm text-slate-300">
                    <div className="inline-flex items-center gap-2 font-mono font-semibold text-white">
                        <LockKeyhole size={14} />
                        {ticketId}
                    </div>
                    <p className="mt-2">Status: <span className="font-semibold">{status}</span></p>
                    <p className="mt-1">Submitted: <span className="font-medium">{submittedAtLabel}</span></p>
                </div>
            </div>

            <div className="mt-5 rounded-xl border border-white/10 bg-black/10 p-4">
                <p className="text-sm font-semibold text-white">Access</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">Sign in with the filing account or reopen the ticket with the confirmation access token.</p>
            </div>
        </section>
    );
}
