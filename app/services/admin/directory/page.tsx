'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ChangeEvent, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { ArrowLeft, FileImage, Loader2, RefreshCcw, Search, Trash2, Upload } from 'lucide-react';
import { NoncedStyle } from '@/components/CspNonceProvider';

type DirectoryEntry = {
    directoryKey: string;
    entryType: 'organization' | 'office' | string;
    name: string;
    roleOrOffice: string;
    councilOrUnit: string;
    logoUrl?: string;
    logo: {
        fileName: string;
        mimeType: string;
        sizeBytes: number;
        uploadedBy: string;
        updatedAt: string;
    } | null;
};

type DirectoryResponse = {
    success: boolean;
    entries: DirectoryEntry[];
    exportState: {
        status: string;
        lastAttemptAt: string | null;
        lastSucceededAt: string | null;
        lastError: string;
    };
};

async function fetchDirectory(url: string): Promise<DirectoryResponse> {
    const response = await fetch(url, { cache: 'no-store' });
    const payload = await response.json() as DirectoryResponse & { error?: { message?: string } };
    if (!response.ok) throw new Error(payload.error?.message || 'Unable to load directory records.');
    return payload;
}

function formatBytes(value: number): string {
    if (!value) return 'Legacy or unknown size';
    if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} KB`;
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | null): string {
    if (!value) return 'Not exported yet';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AdminDirectoryPage() {
    const { data, error, isLoading, mutate } = useSWR<DirectoryResponse>('/api/admin/directory', fetchDirectory, {
        revalidateOnFocus: false,
    });
    const [query, setQuery] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [formError, setFormError] = useState('');
    const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const filteredEntries = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return (data?.entries || []).filter((entry) => {
            const matchesType = typeFilter === 'all' || entry.entryType === typeFilter;
            const matchesQuery = !normalizedQuery || [entry.name, entry.roleOrOffice, entry.councilOrUnit, entry.directoryKey]
                .some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
            return matchesType && matchesQuery;
        });
    }, [data?.entries, query, typeFilter]);

    async function uploadLogo(entry: DirectoryEntry, event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;

        setBusyKey(entry.directoryKey);
        setFeedback('');
        setFormError('');
        try {
            const form = new FormData();
            form.set('directoryKey', entry.directoryKey);
            form.set('logo', file);
            const response = await fetch('/api/admin/directory', { method: 'POST', body: form });
            const payload = await response.json() as { error?: { message?: string } };
            if (!response.ok) throw new Error(payload.error?.message || 'Unable to save logo.');
            await mutate();
            setFeedback(`${entry.name} logo saved. Sheets export is pending.`);
        } catch (uploadError) {
            setFormError(uploadError instanceof Error ? uploadError.message : 'Unable to save logo.');
        } finally {
            setBusyKey(null);
        }
    }

    async function removeLogo(entry: DirectoryEntry) {
        if (!entry.logo || !window.confirm(`Remove the logo for ${entry.name}?`)) return;
        setBusyKey(entry.directoryKey);
        setFeedback('');
        setFormError('');
        try {
            const response = await fetch('/api/admin/directory', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ directoryKey: entry.directoryKey }),
            });
            const payload = await response.json() as { error?: { message?: string } };
            if (!response.ok) throw new Error(payload.error?.message || 'Unable to remove logo.');
            await mutate();
            setFeedback(`${entry.name} logo removed. Sheets export is pending.`);
        } catch (removeError) {
            setFormError(removeError instanceof Error ? removeError.message : 'Unable to remove logo.');
        } finally {
            setBusyKey(null);
        }
    }

    async function exportToSheets() {
        setExporting(true);
        setFeedback('');
        setFormError('');
        try {
            const response = await fetch('/api/admin/directory/export', { method: 'POST' });
            const payload = await response.json() as { error?: { message?: string } };
            if (!response.ok) throw new Error(payload.error?.message || 'Unable to export the directory.');
            await mutate();
            setFeedback('Directory Export updated successfully.');
        } catch (exportError) {
            setFormError(exportError instanceof Error ? exportError.message : 'Unable to export the directory.');
            await mutate();
        } finally {
            setExporting(false);
        }
    }

    const exportState = data?.exportState;

    return (
        <div className="services-shell relative min-h-screen overflow-hidden text-slate-100">
            <div className="services-noise" aria-hidden="true" />
            <section className="relative z-10 mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
                <Link href="/services/admin" className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
                    <ArrowLeft size={16} />
                    Back to Admin
                </Link>

                <header className="mt-8 flex flex-col gap-5 border-b border-white/10 pb-8 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl">
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-200">
                            <FileImage size={15} />
                            Directory assets
                        </div>
                        <h1 className="mt-4 text-3xl font-bold leading-tight text-white md:text-5xl">Directory logos</h1>
                        <p className="mt-4 max-w-2xl leading-relaxed text-slate-300">
                            Manage the protected logo files used by student organizations and university offices. Changes are stored in Neon first and exported to Sheets on request or by cron.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button type="button" onClick={() => void mutate()} disabled={isLoading} className="inline-flex min-h-11 items-center justify-center gap-2 border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400">
                            <RefreshCcw size={16} className={isLoading ? 'animate-spin' : ''} />
                            Refresh
                        </button>
                        <button type="button" onClick={() => void exportToSheets()} disabled={exporting || !data} className="inline-flex min-h-11 items-center justify-center gap-2 bg-amber-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">
                            <Upload size={16} />
                            {exporting ? 'Exporting...' : 'Export to Sheets'}
                        </button>
                    </div>
                </header>

                <div className="mt-6 grid gap-4 border-b border-white/10 pb-6 text-sm text-slate-300 sm:grid-cols-3">
                    <div><span className="block text-xs uppercase tracking-[0.12em] text-slate-500">Records</span><strong className="mt-1 block text-white">{data?.entries.length || 0}</strong></div>
                    <div><span className="block text-xs uppercase tracking-[0.12em] text-slate-500">Export status</span><strong className="mt-1 block text-white">{exportState?.status || 'Loading'}</strong></div>
                    <div><span className="block text-xs uppercase tracking-[0.12em] text-slate-500">Last successful export</span><strong className="mt-1 block text-white">{formatDate(exportState?.lastSucceededAt || null)}</strong></div>
                </div>

                {exportState?.lastError && <div className="mt-6 border border-red-300/25 bg-red-300/10 px-4 py-3 text-sm text-red-100" role="alert">{exportState.lastError}</div>}
                {feedback && <div className="mt-6 border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm text-emerald-100" role="status">{feedback}</div>}
                {formError && <div className="mt-6 border border-red-300/25 bg-red-300/10 px-4 py-3 text-sm text-red-100" role="alert">{formError}</div>}
                {error && <div className="mt-6 border border-red-300/25 bg-red-300/10 px-4 py-3 text-sm text-red-100" role="alert">{error.message}</div>}

                <div className="mt-8 flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row">
                    <label className="flex min-h-11 flex-1 items-center gap-2 border border-white/10 bg-[#0f223f]/60 px-3 text-sm text-slate-300">
                        <Search size={16} aria-hidden="true" />
                        <span className="sr-only">Search directory entries</span>
                        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, unit, or key" className="min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-slate-500" />
                    </label>
                    <label className="flex min-h-11 items-center border border-white/10 bg-[#0f223f]/60 px-3 text-sm text-slate-300">
                        <span className="sr-only">Filter directory type</span>
                        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="bg-transparent pr-8 text-white outline-none">
                            <option value="all" className="bg-[#17385d]">All types</option>
                            <option value="organization" className="bg-[#17385d]">Organizations</option>
                            <option value="office" className="bg-[#17385d]">University offices</option>
                        </select>
                    </label>
                </div>

                {isLoading && !data ? (
                    <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-300"><Loader2 size={18} className="animate-spin" /> Loading directory records...</div>
                ) : filteredEntries.length === 0 ? (
                    <div className="mt-6 border border-dashed border-white/15 bg-[#0f223f]/35 px-4 py-12 text-center text-sm text-slate-300">No matching enabled directory records.</div>
                ) : (
                    <div className="mt-6 divide-y divide-white/10 border-y border-white/10">
                        {filteredEntries.map((entry) => {
                            const busy = busyKey === entry.directoryKey;
                            return (
                                <article key={entry.directoryKey} className="grid gap-5 py-6 lg:grid-cols-[4.5rem_minmax(0,1fr)_auto] lg:items-center">
                                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden border border-white/15 bg-white/[0.06]">
                                        {entry.logoUrl ? <Image src={entry.logoUrl} alt="" width={64} height={64} className="h-full w-full object-cover" unoptimized /> : <FileImage size={22} className="text-slate-500" aria-hidden="true" />}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                                            <h2 className="text-lg font-semibold text-white">{entry.name}</h2>
                                            <span className="text-xs uppercase tracking-[0.12em] text-amber-200">{entry.entryType}</span>
                                        </div>
                                        <p className="mt-1 text-sm text-slate-300">{entry.roleOrOffice || 'No role or office label'}{entry.councilOrUnit ? ` · ${entry.councilOrUnit}` : ''}</p>
                                        <p className="mt-2 font-mono text-xs text-slate-500">{entry.directoryKey}</p>
                                        <p className="mt-2 text-xs text-slate-500">{entry.logo ? `${entry.logo.fileName} · ${formatBytes(entry.logo.sizeBytes)} · updated ${formatDate(entry.logo.updatedAt)}` : 'No runtime logo assigned; fallback is active.'}</p>
                                    </div>
                                    <div className="flex flex-wrap gap-2 lg:justify-end">
                                        <input ref={(element) => { inputRefs.current[entry.directoryKey] = element; }} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadLogo(entry, event)} disabled={busy} className="sr-only" id={`logo-${entry.directoryKey}`} />
                                        <label htmlFor={`logo-${entry.directoryKey}`} className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10 focus-within:outline-none focus-within:ring-2 focus-within:ring-sky-400">
                                            {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                                            {entry.logo ? 'Replace' : 'Upload'} logo
                                        </label>
                                        {entry.logo && <button type="button" onClick={() => void removeLogo(entry)} disabled={busy} className="inline-flex min-h-10 items-center justify-center gap-2 border border-red-300/25 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-300/10 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"><Trash2 size={15} /> Remove</button>}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>
            <NoncedStyle css={`
                .services-shell {
                    background:
                        radial-gradient(130% 120% at 8% 12%, rgba(232, 207, 146, 0.18) 0%, rgba(232, 207, 146, 0) 52%),
                        radial-gradient(140% 120% at 92% 8%, rgba(87, 131, 186, 0.28) 0%, rgba(87, 131, 186, 0) 58%),
                        linear-gradient(130deg, #1a3352 0%, #234874 48%, #3e6596 100%);
                }

                .services-shell::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(circle at top, rgba(255, 255, 255, 0.03) 0%, transparent 100%);
                    pointer-events: none;
                }

                .services-noise {
                    position: absolute;
                    inset: 0;
                    background-image: radial-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px);
                    background-size: 32px 32px;
                    opacity: 0.2;
                    mask-image: linear-gradient(to bottom, black 40%, transparent 100%);
                    pointer-events: none;
                }
            `} />
        </div>
    );
}
