'use client';

import { AlertTriangle, RefreshCcw } from 'lucide-react';
import Link from 'next/link';

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return (
        <section className="mx-auto w-full max-w-[1600px] px-4 py-12 sm:px-6" role="alert">
            <div className="border border-rose-300/30 bg-rose-300/[0.06] p-6">
                <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 shrink-0 text-rose-200" size={20} aria-hidden="true" />
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-200">Workspace error</p>
                        <h1 className="mt-2 text-xl font-semibold text-white">This admin view could not be loaded.</h1>
                        <p className="mt-2 text-sm text-slate-300">Retry the request, or return to the overview if the problem continues.</p>
                        <div className="mt-5 flex flex-wrap gap-3">
                            <button type="button" onClick={() => reset()} className="inline-flex min-h-10 items-center gap-2 bg-amber-200 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-100">
                                <RefreshCcw size={16} aria-hidden="true" /> Retry
                            </button>
                            <Link href="/services/admin" className="inline-flex min-h-10 items-center border border-white/15 px-4 py-2 text-sm text-slate-200 hover:border-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-100">Back to overview</Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
