'use client';

import Image from 'next/image';
import { ChangeEvent, useMemo, useState } from 'react';
import useSWR from 'swr';
import { FileImage, Loader2, RefreshCcw, Trash2, Upload } from 'lucide-react';
import { AdminActionButton, AdminNotice, AdminPageShell } from '@/components/admin/AdminPageShell';
import AdminDataGrid from '@/components/admin/AdminDataGrid';
import AdminInspector from '@/components/admin/AdminInspector';
import type { AdminColumn, AdminRecordAdapter } from '@/components/admin/admin-types';

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
    const [typeFilter, setTypeFilter] = useState('all');
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [busyKey, setBusyKey] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [formError, setFormError] = useState('');

    const filteredEntries = useMemo(() => {
        return (data?.entries || []).filter((entry) => {
            const matchesType = typeFilter === 'all' || entry.entryType === typeFilter;
            return matchesType;
        });
    }, [data?.entries, typeFilter]);

    const selectedEntry = data?.entries.find((entry) => entry.directoryKey === selectedKey) || null;

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

    const directoryAdapter: AdminRecordAdapter<DirectoryEntry> = {
        getId: (entry) => entry.directoryKey,
        getSearchText: (entry) => [entry.directoryKey, entry.name, entry.roleOrOffice, entry.councilOrUnit, entry.entryType, entry.logo?.fileName].join(' '),
        getStatus: (entry) => entry.logo ? 'assigned' : 'missing',
        getUpdatedAt: (entry) => entry.logo?.updatedAt || '',
    };

    const directoryColumns: AdminColumn<DirectoryEntry>[] = [
        {
            key: 'entry',
            label: 'Directory entry',
            sortable: true,
            getValue: (entry) => entry.name,
            render: (entry) => <div className="flex min-w-0 items-center gap-3"><span className="grid size-9 shrink-0 place-items-center overflow-hidden border border-white/10 bg-white/[0.06]">{entry.logoUrl ? <Image src={entry.logoUrl} alt="" width={36} height={36} className="h-full w-full object-cover" unoptimized /> : <FileImage size={17} className="text-slate-500" aria-hidden="true" />}</span><span className="min-w-0"><span className="block truncate font-medium text-white">{entry.name}</span><span className="mt-1 block truncate text-xs text-slate-400">{entry.roleOrOffice || entry.councilOrUnit || 'No unit label'}</span></span></div>,
        },
        {
            key: 'type',
            label: 'Type',
            sortable: true,
            getValue: (entry) => entry.entryType,
            render: (entry) => <span className="text-xs uppercase tracking-[0.1em] text-amber-200">{entry.entryType}</span>,
        },
        {
            key: 'logo',
            label: 'Logo state',
            sortable: true,
            getValue: (entry) => entry.logo ? 'Assigned' : 'Missing',
            render: (entry) => <span className={`text-xs font-semibold ${entry.logo ? 'text-emerald-200' : 'text-amber-100'}`}>{entry.logo ? 'Assigned' : 'Missing'}</span>,
        },
        {
            key: 'updated',
            label: 'Updated',
            priority: 'secondary',
            sortable: true,
            getValue: (entry) => entry.logo?.updatedAt || '',
            render: (entry) => entry.logo ? formatDate(entry.logo.updatedAt) : 'Not uploaded',
        },
    ];

    return (
        <AdminPageShell
            title="Directory logos"
            actions={(
                <>
                    <AdminActionButton onClick={() => void mutate()} disabled={isLoading}>
                        <RefreshCcw size={16} className={isLoading ? 'animate-spin' : ''} />
                        Refresh
                    </AdminActionButton>
                    <AdminActionButton
                        onClick={() => void exportToSheets()}
                        disabled={exporting || !data}
                        className="border-amber-300 bg-amber-300 text-slate-950 hover:bg-amber-200"
                    >
                        <Upload size={16} />
                        {exporting ? 'Exporting...' : 'Export to Sheets'}
                    </AdminActionButton>
                </>
            )}
        >

                <div className="mt-6 grid gap-4 border-b border-white/10 pb-6 text-sm text-slate-300 sm:grid-cols-3">
                    <div><span className="block text-xs uppercase tracking-[0.12em] text-slate-500">Records</span><strong className="mt-1 block text-white">{data?.entries.length || 0}</strong></div>
                    <div><span className="block text-xs uppercase tracking-[0.12em] text-slate-500">Export status</span><strong className="mt-1 block text-white">{exportState?.status || 'Loading'}</strong></div>
                    <div><span className="block text-xs uppercase tracking-[0.12em] text-slate-500">Last successful export</span><strong className="mt-1 block text-white">{formatDate(exportState?.lastSucceededAt || null)}</strong></div>
                </div>

                {exportState?.lastError && <div className="mt-6"><AdminNotice tone="danger" role="alert">{exportState.lastError}</AdminNotice></div>}
                {feedback && <div className="mt-6"><AdminNotice tone="success">{feedback}</AdminNotice></div>}
                {formError && <div className="mt-6"><AdminNotice tone="danger" role="alert">{formError}</AdminNotice></div>}
                {error && <div className="mt-6"><AdminNotice tone="danger" role="alert">{error.message}</AdminNotice></div>}

                <div className="mt-8">
                    <section className="min-w-0 border border-white/10 bg-white/[0.04] p-4 sm:p-6" aria-labelledby="directory-records-title">
                        <div className="mb-5 flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
                            <div><h2 id="directory-records-title" className="text-lg font-semibold text-white">Directory records</h2><p className="mt-1 text-sm text-slate-400">Select an entry to manage its protected logo.</p></div>
                            <label className="flex min-h-11 items-center border border-white/10 bg-black/10 px-3 text-sm text-slate-300"><span className="sr-only">Filter directory type</span><select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="bg-transparent pr-8 text-white outline-none"><option value="all" className="bg-[#111e32]">All types</option><option value="organization" className="bg-[#111e32]">Organizations</option><option value="office" className="bg-[#111e32]">University offices</option></select></label>
                        </div>
                        {error ? <AdminNotice tone="danger" role="alert">{error.message}</AdminNotice> : null}
                        <AdminDataGrid rows={filteredEntries} columns={directoryColumns} adapter={directoryAdapter} selectedId={selectedKey || undefined} onSelect={(entry) => setSelectedKey(entry.directoryKey)} loading={isLoading && !data} emptyMessage="No matching enabled directory records." searchPlaceholder="Search name, unit, or key" />
                    </section>

                    <AdminInspector mode="drawer" open={Boolean(selectedEntry)} onClose={() => setSelectedKey(null)} title={selectedEntry?.name || 'Directory inspector'} drawerSize="lg">
                        {selectedEntry ? <div className="space-y-5">
                            <div className="flex items-start gap-4"><div className="flex size-20 shrink-0 items-center justify-center overflow-hidden border border-white/15 bg-white/[0.06]">{selectedEntry.logoUrl ? <Image src={selectedEntry.logoUrl} alt="" width={80} height={80} className="h-full w-full object-cover" unoptimized /> : <FileImage size={25} className="text-slate-500" aria-hidden="true" />}</div><div className="min-w-0"><p className="text-xs uppercase tracking-[0.12em] text-amber-200">{selectedEntry.entryType}</p><p className="mt-2 break-words font-mono text-xs text-slate-500">{selectedEntry.directoryKey}</p><p className="mt-2 text-sm text-slate-300">{selectedEntry.roleOrOffice || selectedEntry.councilOrUnit || 'No unit label'}</p></div></div>
                            <p className="text-xs leading-5 text-slate-500">{selectedEntry.logo ? `${selectedEntry.logo.fileName} · ${formatBytes(selectedEntry.logo.sizeBytes)} · updated ${formatDate(selectedEntry.logo.updatedAt)}` : 'No runtime logo assigned; fallback is active.'}</p>
                            <div className="flex flex-wrap gap-2"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadLogo(selectedEntry, event)} disabled={busyKey === selectedEntry.directoryKey} className="sr-only" id="directory-logo-upload" /><label htmlFor="directory-logo-upload" className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10 focus-within:outline-none focus-within:ring-2 focus-within:ring-amber-200">{busyKey === selectedEntry.directoryKey ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}{selectedEntry.logo ? 'Replace logo' : 'Upload logo'}</label>{selectedEntry.logo ? <button type="button" onClick={() => void removeLogo(selectedEntry)} disabled={busyKey === selectedEntry.directoryKey} className="inline-flex min-h-11 items-center justify-center gap-2 border border-red-300/25 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-300/10 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"><Trash2 size={15} /> Remove</button> : null}</div>
                            {feedback ? <AdminNotice tone="success">{feedback}</AdminNotice> : null}
                            {formError ? <AdminNotice tone="danger" role="alert">{formError}</AdminNotice> : null}
                        </div> : <p className="text-sm leading-6 text-slate-400">Select a directory entry from the grid to preview and manage its logo.</p>}
                    </AdminInspector>
                </div>
        </AdminPageShell>
    );
}
