'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { AlertTriangle, Loader2, XCircle } from 'lucide-react';
import { AdminNotice, AdminPageShell } from '@/components/admin/AdminPageShell';
import { adminNavigationItems } from '@/components/admin/admin-navigation';
import type { AdminModuleSummary, AdminSurfaceSummary } from '@/lib/admin-overview-types';

type OverviewPayload = {
    success: boolean;
    modules: AdminModuleSummary[];
    checkedAt: string;
    surfaces?: AdminSurfaceSummary[];
};

async function fetchOverview(url: string): Promise<OverviewPayload> {
    const response = await fetch(url, { cache: 'no-store' });
    const payload = await response.json() as OverviewPayload & { error?: { message?: string } };
    if (!response.ok) throw new Error(payload.error?.message || 'Unable to load the operations overview.');
    return payload;
}

function sourceLabel(source: AdminModuleSummary['source']): string {
    return source === 'neon' ? 'Neon' : source === 'sheets' ? 'Google Sheets' : 'Neon + Sheets';
}

function healthLabel(health: AdminModuleSummary['health']): string {
    return health === 'healthy' ? 'No issues' : health === 'attention' ? 'Needs Attention' : 'Under Maintenance / Unavailable';
}

function healthClass(health: AdminModuleSummary['health']): string {
    return health === 'healthy'
        ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'
        : health === 'attention'
            ? 'border-amber-300/25 bg-amber-300/10 text-amber-100'
            : 'border-red-300/25 bg-red-300/10 text-red-100';
}

export default function AdminHubPage() {
    const { data, error, isLoading, mutate } = useSWR<OverviewPayload>('/api/admin/overview', fetchOverview, {
        revalidateOnFocus: false,
        errorRetryCount: 1,
    });

    const modules = adminNavigationItems.filter((item) => item.key !== 'dashboard');
    const summaryByKey = new Map((data?.modules || []).map((module) => [module.key, module]));
    const surfaceByKey = new Map((data?.surfaces || []).map((surface) => [surface.key, surface]));
    const attentionCount = (data?.modules || []).reduce((total, module) => total + module.attention, 0);
    const queuedCount = (data?.modules || []).reduce((total, module) => total + module.queued, 0);
    const unavailableCount = (data?.modules || []).filter((module) => module.health === 'unavailable').length;

    return (
        <AdminPageShell
            title="Operations overview"
            actions={(
                <button type="button" onClick={() => void mutate()} disabled={isLoading} className="inline-flex min-h-11 items-center gap-2 border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">
                    <Loader2 size={16} className={isLoading ? 'animate-spin' : ''} />
                    Refresh overview
                </button>
            )}
        >
            {error ? <div className="mt-6"><AdminNotice tone="danger" role="alert">{error.message}</AdminNotice></div> : null}

            <section className="mt-6 grid border border-white/10 bg-white/[0.03] sm:grid-cols-3" aria-label="Overview metrics">
                <div className="border-b border-white/10 px-4 py-4 sm:border-b-0 sm:border-r"><p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">Queued work</p><p className="mt-2 text-2xl font-semibold text-white">{isLoading ? '—' : queuedCount}</p></div>
                <div className="border-b border-white/10 px-4 py-4 sm:border-b-0 sm:border-r"><p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">Attention flags</p><p className="mt-2 text-2xl font-semibold text-amber-100">{isLoading ? '—' : attentionCount}</p></div>
                <div className="px-4 py-4"><p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-slate-500">Unavailable sources</p><p className="mt-2 text-2xl font-semibold text-red-100">{isLoading ? '—' : unavailableCount}</p></div>
            </section>

            <div className="mt-6">
                <section className="border border-white/10 bg-white/[0.04]" aria-labelledby="admin-queues-title">
                    <div className="flex items-end justify-between gap-4 border-b border-white/10 px-5 py-4">
                        <div>
                            <h2 id="admin-queues-title" className="text-lg font-semibold text-white">Administrative queues</h2>
                        </div>
                    </div>
                    <div className="divide-y divide-white/10">
                        {isLoading && !data ? modules.map((item) => (
                            <div key={item.key} className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_8rem] sm:items-center" aria-hidden="true">
                                <div className="flex items-center gap-3"><span className="size-9 animate-pulse bg-white/10" /><span className="min-w-0 flex-1"><span className="block h-4 w-32 animate-pulse bg-white/10" /><span className="mt-2 block h-3 w-56 max-w-full animate-pulse bg-white/5" /></span></div>
                                <span className="h-4 w-8 animate-pulse bg-white/10" />
                                <span className="h-4 w-8 animate-pulse bg-white/10" />
                                <span className="h-7 w-28 animate-pulse bg-white/10" />
                            </div>
                        )) : modules.map((item) => {
                            const Icon = item.icon;
                            const summary = summaryByKey.get(item.key as AdminModuleSummary['key']);
                            const health = summary?.health || surfaceByKey.get(item.key)?.health || 'unavailable';
                            const statusLabel = healthLabel(health);
                            return (
                                <Link key={item.key} href={item.href} className="group grid gap-3 px-5 py-4 transition hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-200 sm:grid-cols-[minmax(0,1fr)_7rem_7rem_8rem] sm:items-center">
                                    <div className="flex min-w-0 items-center gap-3">
                                        <span className="grid size-9 shrink-0 place-items-center border border-white/10 bg-white/[0.04] text-slate-200"><Icon size={17} aria-hidden="true" /></span>
                                        <span className="min-w-0"><span className="block truncate text-sm font-semibold text-white">{item.label}</span></span>
                                    </div>
                                    <div><span className="text-[0.62rem] uppercase tracking-[0.12em] text-slate-500 sm:hidden">Total · </span><span className="text-sm text-slate-200">{summary?.total ?? '—'}</span></div>
                                    <div><span className="text-[0.62rem] uppercase tracking-[0.12em] text-slate-500 sm:hidden">Queue · </span><span className="text-sm text-slate-200">{summary?.queued ?? '—'}</span></div>
                                    <span className={`inline-flex w-fit items-center gap-1.5 border px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em] ${healthClass(health)}`}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{statusLabel}</span>
                                </Link>
                            );
                        })}
                    </div>
                </section>

            </div>

            {!isLoading && data?.modules.some((module) => module.health === 'attention') ? <div className="mt-6 flex items-start gap-3 border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm text-amber-100"><AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden="true" /><span>Some queues need attention. Open the affected module to review its records.</span></div> : null}
            {!isLoading && data?.modules.every((module) => module.health === 'unavailable') ? <div className="mt-6 flex items-start gap-3 border border-red-300/25 bg-red-300/10 px-4 py-3 text-sm text-red-100"><XCircle size={17} className="mt-0.5 shrink-0" aria-hidden="true" /><span>All source checks are unavailable. The module pages will preserve their own error details.</span></div> : null}
        </AdminPageShell>
    );
}
