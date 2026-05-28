'use client';

import { LockKeyhole, ShieldCheck } from 'lucide-react';

interface TrackRedactedShellProps {
    ticketId: string;
    status: string;
    submittedAtLabel: string;
}

export function TrackRedactedShell({ ticketId, status, submittedAtLabel }: TrackRedactedShellProps) {
    return (
        <section className="rounded-3xl border border-[rgba(203,165,77,0.24)] bg-[linear-gradient(180deg,rgba(203,165,77,0.1),rgba(255,255,255,0.98))] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--accent-gold)]">
                        Redacted result shell
                    </p>
                    <h3 className="mt-1 text-xl font-semibold tracking-tight text-strong">This ticket is privacy protected</h3>
                    <p className="mt-2 text-sm leading-relaxed text-body">
                        You can still verify that the ticket exists and read its coarse status, but the narrative, attachments, discussion, and sensitive metadata remain hidden until ownership is confirmed.
                    </p>
                </div>

                <div className="rounded-xl border border-[rgba(203,165,77,0.2)] bg-white px-4 py-3 text-sm text-body">
                    <div className="inline-flex items-center gap-2 font-mono font-semibold text-strong">
                        <LockKeyhole size={14} />
                        {ticketId}
                    </div>
                    <p className="mt-2">Status: <span className="font-semibold">{status}</span></p>
                    <p className="mt-1">Submitted: <span className="font-medium">{submittedAtLabel}</span></p>
                </div>
            </div>

            <div className="mt-5 rounded-xl border border-[rgba(35,72,116,0.14)] bg-white p-4">
                <div className="flex items-center gap-2 text-[color:var(--accent-gold)]">
                    <ShieldCheck size={15} />
                    <p className="text-sm font-semibold text-strong">How to unlock full details</p>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-body">
                    Sign in with the same account that filed this grievance or reopen the ticket using the access token from the confirmation email. Until then, the page intentionally stays in a minimal status-only state.
                </p>
            </div>
        </section>
    );
}
