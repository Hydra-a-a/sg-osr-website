'use client';

import type { ReactNode } from 'react';
import { LockKeyhole } from 'lucide-react';

interface TrackActionWorkspaceProps {
    actionAllowed: boolean;
    children?: ReactNode;
}

export function TrackActionWorkspace({ actionAllowed, children }: TrackActionWorkspaceProps) {
    return (
        <section className="rounded-3xl border border-white/10 bg-[linear-gradient(145deg,rgba(12,22,36,0.72),rgba(11,20,34,0.56))] shadow-[0_20px_50px_rgba(4,10,22,0.2)] p-6">
            <div className="mb-5">
                <h3 className="text-xl font-semibold tracking-tight text-white">Follow-up and appeals</h3>
            </div>

            {actionAllowed ? (
                children
            ) : (
                <div className="rounded-xl border border-dashed border-amber-300/30 bg-amber-300/[0.08] p-5">
                    <div className="inline-flex bg-white/[0.08] p-2 text-amber-200 shadow-sm">
                        <LockKeyhole size={18} />
                    </div>
                    <h4 className="mt-3 text-base font-semibold text-white">Access restricted</h4>
                    <p className="mt-2 text-sm leading-relaxed text-slate-300">Follow-up messages, attachments, and appeals require ticket-owner access or a valid access token.</p>
                </div>
            )}
        </section>
    );
}
