'use client';

import type { ReactNode } from 'react';
import { LockKeyhole, MessageSquareMore } from 'lucide-react';

interface TrackActionWorkspaceProps {
    actionAllowed: boolean;
    children?: ReactNode;
}

export function TrackActionWorkspace({ actionAllowed, children }: TrackActionWorkspaceProps) {
    return (
        <section className="rounded-3xl border border-[rgba(35,72,116,0.16)] bg-[linear-gradient(165deg,rgba(255,255,255,0.98),rgba(242,247,252,0.92))] p-6">
            <div className="mb-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand/75">
                    Action workspace
                </p>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-strong">Follow-up, appeals, and discussion</h3>
                <p className="mt-2 text-sm leading-relaxed text-subtle">
                    This panel is intentionally separate from the read-only record so status review stays clear while replies and appeal actions stay focused.
                </p>
            </div>

            {actionAllowed ? (
                children
            ) : (
                <div className="rounded-xl border border-dashed border-[rgba(203,165,77,0.28)] bg-[rgba(203,165,77,0.08)] p-5">
                    <div className="inline-flex rounded-full bg-surface-elevated p-2 text-[color:var(--accent-gold)] shadow-sm">
                        <LockKeyhole size={18} />
                    </div>
                    <h4 className="mt-3 text-base font-semibold text-strong">Discussion is locked for this view</h4>
                    <p className="mt-2 text-sm leading-relaxed text-body">
                        Appeals, follow-up replies, and supporting documents are only available to the ticket owner or someone reopening the grievance with a valid access token.
                    </p>
                    <div className="mt-4 rounded-xl border border-[rgba(35,72,116,0.14)] bg-white p-4 text-sm text-body">
                        <div className="flex items-center gap-2 font-semibold text-strong">
                            <MessageSquareMore size={15} />
                            What stays hidden
                        </div>
                        <p className="mt-2 leading-relaxed">
                            Message history, attachments, and appeal actions remain hidden here to protect student privacy and prevent accidental disclosure.
                        </p>
                    </div>
                </div>
            )}
        </section>
    );
}
