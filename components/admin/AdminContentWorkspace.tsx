'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { FilePenLine, Eye, History, Loader2, Plus, Save, Send, ExternalLink } from 'lucide-react';
import { useMemo, useRef, useState, useTransition, type DragEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import AdminActionMenu from './AdminActionMenu';
import { AdminDrawer, AdminModal } from './AdminOverlay';
import { AdminTabs } from './AdminTabs';
import AdminToastRegion, { useAdminToasts } from './AdminToast';
import useAdminUnsavedChanges from './useAdminUnsavedChanges';
import { AdminNotice, AdminPageShell } from './AdminPageShell';
import type { AdminContentType } from '@/lib/admin-content';

type RecordRow = {
    id: string;
    version: number;
    updatedAt: string;
    payload: Record<string, unknown>;
    draft: { id: string; baseVersion: number; payload: Record<string, unknown>; stagedAssets?: Record<string, unknown> | null; updatedAt: string } | null;
};

type ContentResponse = { success: boolean; records: RecordRow[]; publicSource?: 'sheet' | 'db-with-sheets-fallback' | 'db'; error?: { message?: string } };
type HistoryResponse = { success: boolean; history: Array<{ id: string; version: number; publisherLabel: string; publishedAt: string; payload: Record<string, unknown> }> };

const contentTabs: Array<{ value: AdminContentType; label: string }> = [
    { value: 'directory', label: 'Directory' },
    { value: 'news', label: 'News & announcements' },
    { value: 'hub-guide', label: 'Hub guides' },
    { value: 'quick-link', label: 'Quick links' },
];

const fieldLabels: Record<string, string> = {
    name: 'Name', roleOrOffice: 'Role or office', councilOrUnit: 'Council or unit', email: 'Public email', profileUrl: 'Profile URL',
    sourcePageName: 'Source', sourcePageSlug: 'Source slug', message: 'Caption / message', manualTitle: 'Manual title', manualBody: 'Manual body',
    articleTitle: 'Article title', articleBody: 'Article body', section: 'Section', imageAlt: 'Image alt text',
    title: 'Title', description: 'Description', fileUrl: 'PDF or Drive URL', category: 'Category', label: 'Label', href: 'Safe URL', icon: 'Icon name',
};

const editableFields: Record<AdminContentType, string[]> = {
    directory: ['name', 'roleOrOffice', 'councilOrUnit', 'email', 'profileUrl', 'enabled', 'sortOrder'],
    news: ['sourcePageName', 'sourcePageSlug', 'message', 'manualTitle', 'manualBody', 'articleTitle', 'articleBody', 'section', 'imageAlt', 'featured', 'enabled', 'sortOrder'],
    'hub-guide': ['title', 'description', 'fileUrl', 'category', 'enabled', 'sortOrder'],
    'quick-link': ['label', 'description', 'href', 'icon', 'category', 'enabled', 'sortOrder'],
};
const HUB_GUIDE_PDF_MAX_BYTES = 20 * 1024 * 1024;

function formatFileSize(sizeBytes: number): string {
    return `${(sizeBytes / (1024 * 1024)).toFixed(sizeBytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function titleFromPdfFileName(fileName: string): string {
    return fileName.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Guide';
}

function createDefaults(type: AdminContentType): Record<string, unknown> {
    if (type === 'directory') return { entryType: 'organization', directoryKey: '', name: '', roleOrOffice: '', councilOrUnit: '', email: '', imageUrl: '', profileUrl: '', publicDataJson: {}, enabled: true, sortOrder: 0 };
    if (type === 'news') return { sourcePageId: 'manual', sourcePageName: 'Manual entry', sourcePageSlug: 'manual', message: '', imageUrl: '', publishedAt: new Date().toISOString(), fbLink: '', targetPagesJson: ['/news'], enabled: true, featured: false, manualTitle: '', manualBody: '', articleTitle: '', articleBody: '', imageAlt: '', section: '', sortOrder: null };
    if (type === 'hub-guide') return { title: '', description: '', fileUrl: '', driveFileId: '', resourceKey: '', category: 'Student Handbook & Guides', publicDataJson: {}, enabled: true, sortOrder: 0 };
    return { label: '', href: '', category: '', description: '', icon: 'ExternalLink', enabled: true, sortOrder: 0 };
}

function publicSourceNotice(source: ContentResponse['publicSource'], type: AdminContentType): string | null {
    if (!source) return null;
    if (source === 'sheet') return 'Drafts and publications are stored in Neon, but this public collection remains Sheets-backed until its separate cutover.';
    if (source === 'db-with-sheets-fallback') return type === 'hub-guide'
        ? 'Published Hub Guides read from Neon first and use Sheets only if Neon is unavailable.'
        : 'Published records read from Neon first and fall back to Sheets only if Neon is unavailable.';
    return 'Published records are served from Neon.';
}

async function fetcher(url: string): Promise<ContentResponse> {
    const response = await fetch(url, { cache: 'no-store' });
    const payload = await response.json() as ContentResponse;
    if (!response.ok) throw new Error(payload.error?.message || 'Unable to load content records.');
    return payload;
}

function displayValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Enabled' : 'Hidden';
    if (Array.isArray(value)) return value.join(', ');
    return String(value);
}

function formatDate(value: string) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Unknown date' : date.toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
}

function getPrimaryLabel(type: AdminContentType, row: RecordRow) {
    const payload = row.draft?.payload || row.payload;
    return String(payload.name || payload.title || payload.label || payload.manualTitle || row.id);
}

export default function AdminContentWorkspace() {
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();
    const type = (contentTabs.some((tab) => tab.value === params.get('tab')) ? params.get('tab') : 'directory') as AdminContentType;
    const selectedId = params.get('record');
    const action = params.get('action');
    const isCreating = action === 'create';
    const { data, error, isLoading, mutate } = useSWR<ContentResponse>(`/api/admin/content/${type}`, fetcher, { revalidateOnFocus: false });
    const { toasts, pushToast, dismissToast } = useAdminToasts();
    const [draftValues, setDraftValues] = useState<Record<string, unknown> | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, startSave] = useTransition();
    const [history, setHistory] = useState<HistoryResponse['history']>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [logoUploading, setLogoUploading] = useState(false);
    const hubGuideFileInputRef = useRef<HTMLInputElement>(null);
    const [hubGuideFile, setHubGuideFile] = useState<File | null>(null);
    const [hubGuideDragActive, setHubGuideDragActive] = useState(false);
    const [hubGuideUploadError, setHubGuideUploadError] = useState('');
    const selected = data?.records.find((row) => row.id === selectedId) || null;

    const records = useMemo(() => data?.records || [], [data?.records]);
    const selectedPayload = draftValues || selected?.draft?.payload || selected?.payload || {};
    const hasDraft = Boolean(selected?.draft || draftValues);
    const { confirmDiscard } = useAdminUnsavedChanges({ isDirty, onDiscard: () => setIsDirty(false) });

    function clearHubGuideFile() {
        setHubGuideFile(null);
        setHubGuideDragActive(false);
        setHubGuideUploadError('');
    }

    function selectHubGuideFile(file: File | undefined) {
        if (!file) return;
        if (file.size > HUB_GUIDE_PDF_MAX_BYTES) {
            setHubGuideUploadError('Choose a PDF that is 20 MB or smaller.');
            return;
        }
        if (file.type !== 'application/pdf' || !/\.pdf$/i.test(file.name)) {
            setHubGuideUploadError('Only PDF files can be uploaded.');
            return;
        }
        setHubGuideFile(file);
        setHubGuideUploadError('');
        setDraftValues((current) => {
            const payload = current || selectedPayload;
            return String(payload.title || '').trim() ? payload : { ...payload, title: titleFromPdfFileName(file.name) };
        });
        setIsDirty(true);
    }

    function dropHubGuideFile(event: DragEvent<HTMLDivElement>) {
        event.preventDefault();
        setHubGuideDragActive(false);
        selectHubGuideFile(event.dataTransfer.files[0]);
    }

    function setType(next: string) {
        const nextType = next as AdminContentType;
        router.replace(`${pathname}?tab=${encodeURIComponent(nextType)}`, { scroll: false });
        setDraftValues(null);
        setIsDirty(false);
        clearHubGuideFile();
    }

    function openRecord(id: string, nextAction = 'edit') {
        router.push(`${pathname}?tab=${encodeURIComponent(type)}&record=${encodeURIComponent(id)}&action=${nextAction}`, { scroll: false });
        const row = records.find((candidate) => candidate.id === id);
        setDraftValues(row?.draft?.payload || null);
        setIsDirty(false);
        clearHubGuideFile();
    }

    function openCreate() {
        setDraftValues(createDefaults(type));
        setIsDirty(false);
        clearHubGuideFile();
        router.push(`${pathname}?tab=${encodeURIComponent(type)}&action=create`, { scroll: false });
    }

    function closeOverlay() {
        if (!confirmDiscard()) return;
        setDraftValues(null);
        setIsDirty(false);
        clearHubGuideFile();
        if (isCreating) {
            router.replace(`${pathname}?tab=${encodeURIComponent(type)}`, { scroll: false });
            return;
        }
        if (selectedId) router.back();
    }

    function updateField(key: string, value: unknown) {
        setDraftValues((current) => ({ ...(current || selectedPayload), [key]: value }));
        setIsDirty(true);
    }

    function saveDraft() {
        if (!selected) return;
        startSave(async () => {
            try {
                const response = await fetch(`/api/admin/content/${type}/${encodeURIComponent(selected.id)}`, {
                    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ payload: draftValues || selectedPayload }),
                });
                const payload = await response.json() as { draft?: RecordRow['draft']; error?: { message?: string } };
                if (!response.ok) throw new Error(payload.error?.message || 'Unable to save draft.');
                await mutate();
                setDraftValues(payload.draft?.payload || null);
                setIsDirty(false);
                pushToast({ title: 'Draft saved', description: 'The live public surface is unchanged until publish.', tone: 'success' });
            } catch (saveError) {
                pushToast({ title: 'Draft not saved', description: saveError instanceof Error ? saveError.message : 'Try again.', tone: 'danger', durationMs: 0 });
            }
        });
    }

    function createDraft() {
        if (type === 'hub-guide' && hubGuideFile) {
            stageHubGuideFile();
            return;
        }
        startSave(async () => {
            try {
                const response = await fetch(`/api/admin/content/${type}`, {
                    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ payload: draftValues || selectedPayload }),
                });
                const payload = await response.json() as { record?: { id?: string }; error?: { message?: string } };
                if (!response.ok || !payload.record?.id) throw new Error(payload.error?.message || 'Unable to create the draft.');
                await mutate();
                setDraftValues(null);
                setIsDirty(false);
                router.replace(`${pathname}?tab=${encodeURIComponent(type)}&record=${encodeURIComponent(payload.record.id)}&action=edit`, { scroll: false });
                pushToast({ title: 'Draft created', description: 'Review it, then publish when the public content is ready.', tone: 'success' });
            } catch (createError) {
                pushToast({ title: 'Draft not created', description: createError instanceof Error ? createError.message : 'Try again.', tone: 'danger', durationMs: 0 });
            }
        });
    }

    function stageHubGuideFile(recordId?: string) {
        if (!hubGuideFile) return;
        startSave(async () => {
            try {
                const form = new FormData();
                form.set('file', hubGuideFile);
                form.set('payload', JSON.stringify(draftValues || selectedPayload));
                if (recordId) form.set('recordId', recordId);
                const response = await fetch('/api/admin/content/hub-guide/file-draft', { method: 'POST', body: form });
                const payload = await response.json() as { record?: { id?: string }; error?: { message?: string } };
                if (!response.ok || !payload.record?.id) throw new Error(payload.error?.message || 'Unable to stage the PDF.');
                await mutate();
                setDraftValues(null);
                setIsDirty(false);
                clearHubGuideFile();
                if (!recordId) router.replace(`${pathname}?tab=hub-guide&record=${encodeURIComponent(payload.record.id)}&action=edit`, { scroll: false });
                pushToast({ title: 'PDF staged', description: 'Review the private draft, then publish when it is ready.', tone: 'success' });
            } catch (uploadError) {
                setHubGuideUploadError(uploadError instanceof Error ? uploadError.message : 'Unable to upload the PDF.');
            }
        });
    }

    async function publish() {
        if (!selected) return;
        startSave(async () => {
            if (isDirty) {
                const draftResponse = await fetch(`/api/admin/content/${type}/${encodeURIComponent(selected.id)}`, {
                    method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ payload: draftValues || selectedPayload }),
                });
                const draftPayload = await draftResponse.json() as { error?: { message?: string } };
                if (!draftResponse.ok) {
                    pushToast({ title: 'Publish blocked', description: draftPayload.error?.message || 'Save the draft before publishing.', tone: 'danger', durationMs: 0 });
                    return;
                }
                setIsDirty(false);
            }
            const response = await fetch(`/api/admin/content/${type}/${encodeURIComponent(selected.id)}/publish`, { method: 'POST' });
            const payload = await response.json() as { error?: { message?: string } };
            if (!response.ok) {
                pushToast({ title: 'Publish blocked', description: payload.error?.message || 'Refresh and try again.', tone: 'danger', durationMs: 0 });
                return;
            }
            await mutate();
            setDraftValues(null);
            pushToast({ title: 'Published', description: 'The public API will use the new version according to its source setting.', tone: 'success' });
            closeOverlay();
        });
    }

    async function discardDraft() {
        if (!selected || !hasDraft || !confirmDiscard()) return;
        const response = await fetch(`/api/admin/content/${type}/${encodeURIComponent(selected.id)}`, { method: 'DELETE' });
        const payload = await response.json() as { error?: { message?: string } };
        if (!response.ok) {
            pushToast({ title: 'Draft not discarded', description: payload.error?.message || 'Try again.', tone: 'danger', durationMs: 0 });
            return;
        }
        await mutate();
        setDraftValues(null);
        setIsDirty(false);
        pushToast({ title: 'Draft discarded', description: 'Any staged asset was cleaned up.', tone: 'success' });
        if (selectedId) router.back();
    }

    async function loadHistory() {
        if (!selected) return;
        setHistoryLoading(true);
        try {
            const response = await fetch(`/api/admin/content/${type}/${encodeURIComponent(selected.id)}/history`, { cache: 'no-store' });
            const payload = await response.json() as HistoryResponse;
            if (!response.ok) throw new Error('Unable to load publication history.');
            setHistory(payload.history || []);
        } catch (historyError) {
            pushToast({ title: 'History unavailable', description: historyError instanceof Error ? historyError.message : 'Try again.', tone: 'danger' });
        } finally {
            setHistoryLoading(false);
        }
    }

    async function runNewsSync(mode: 'dry-run' | 'sync') {
        setSyncing(true);
        try {
            const response = await fetch('/api/admin/news/sync', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode }) });
            const payload = await response.json() as { summary?: { postsFetched?: number; inserted?: number; updated?: number }; error?: { message?: string } };
            if (!response.ok) throw new Error(payload.error?.message || 'News sync failed.');
            pushToast({ title: mode === 'dry-run' ? 'Sync dry-run complete' : 'News sync complete', description: `${payload.summary?.postsFetched || 0} posts checked; ${payload.summary?.inserted || 0} new, ${payload.summary?.updated || 0} updated.`, tone: 'success' });
            router.replace(`${pathname}?tab=news`, { scroll: false });
            if (type === 'news') await mutate();
        } catch (syncError) {
            pushToast({ title: 'News sync unavailable', description: syncError instanceof Error ? syncError.message : 'Try again.', tone: 'danger', durationMs: 0 });
        } finally {
            setSyncing(false);
        }
    }

    async function stageLogo(file: File) {
        if (!selected || type !== 'directory') return;
        setLogoUploading(true);
        try {
            const form = new FormData();
            form.set('logo', file);
            const directoryKey = String(selectedPayload.directoryKey || '');
            const response = await fetch(`/api/admin/content/directory/${encodeURIComponent(directoryKey)}/logo-draft`, { method: 'POST', body: form });
            const payload = await response.json() as { logo?: { imageUrl?: string }; error?: { message?: string } };
            if (!response.ok) throw new Error(payload.error?.message || 'Unable to stage logo.');
            if (payload.logo?.imageUrl) updateField('imageUrl', payload.logo.imageUrl);
            await mutate();
            pushToast({ title: 'Logo staged', description: 'The replacement is private until the directory draft is published.', tone: 'success' });
        } catch (logoError) {
            pushToast({ title: 'Logo not staged', description: logoError instanceof Error ? logoError.message : 'Try again.', tone: 'danger', durationMs: 0 });
        } finally {
            setLogoUploading(false);
        }
    }

    return (
        <>
            <AdminPageShell title="Public content" actions={<Link href="/" className="inline-flex min-h-11 items-center gap-2 border border-white/15 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/5">View website <ExternalLink size={15} /></Link>}>
                <div className="mt-6 flex flex-col gap-4 border border-white/10 bg-white/[0.03] p-3 sm:flex-row sm:items-center sm:justify-between">
                    <AdminTabs items={contentTabs.map((tab) => ({ id: tab.value, label: tab.label, panel: null }))} value={type} onValueChange={setType} label="Website content collections" />
                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={openCreate} className="inline-flex min-h-10 items-center gap-2 border border-amber-300/30 bg-amber-300/10 px-3 text-xs font-semibold uppercase tracking-[0.1em] text-amber-100 hover:bg-amber-300/15"><Plus size={15} /> Add</button>
                        {type === 'news' ? <button type="button" onClick={() => router.push(`${pathname}?tab=news&action=sync`, { scroll: false })} className="min-h-10 border border-sky-300/25 bg-sky-300/10 px-3 text-xs font-semibold uppercase tracking-[0.1em] text-sky-100 hover:bg-sky-300/15">News sync</button> : null}
                    </div>
                </div>

                {error ? <div className="mt-5"><AdminNotice tone="danger" role="alert">{error.message}</AdminNotice></div> : null}
                {publicSourceNotice(data?.publicSource, type) ? <div className="mt-5"><AdminNotice tone={data?.publicSource === 'sheet' ? 'warning' : 'info'}>{publicSourceNotice(data?.publicSource, type)}</AdminNotice></div> : null}
                <section className="mt-5 border border-white/10 bg-white/[0.04]" aria-label={`${type} content records`}>
                    <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-5"><p className="text-sm text-slate-300">{isLoading ? 'Loading records…' : `${records.length} records · ${records.filter((row) => row.draft).length} pending drafts`}</p><button type="button" onClick={() => void mutate()} className="min-h-10 border border-white/10 px-3 text-xs font-semibold text-slate-300 hover:bg-white/5">Refresh</button></div>
                    <div className="hidden grid-cols-[minmax(0,1fr)_8rem_8rem_9rem_3rem] gap-3 border-b border-white/10 px-4 py-2 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:grid sm:px-5"><span>Record</span><span>Status</span><span>Version</span><span>Updated</span><span aria-hidden="true" /></div>
                    <div className="divide-y divide-white/10">
                        {records.map((row) => {
                            const payload = row.draft?.payload || row.payload;
                            return <div key={row.id} className="grid gap-3 px-4 py-4 transition hover:bg-white/[0.04] sm:grid-cols-[minmax(0,1fr)_8rem_8rem_9rem_3rem] sm:items-center sm:px-5">
                                <button type="button" onClick={() => openRecord(row.id)} className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"><span className="block truncate text-sm font-semibold text-white">{getPrimaryLabel(type, row)}</span><span className="mt-1 block truncate text-xs text-slate-500">{displayValue(payload.category || payload.roleOrOffice || payload.section || row.id)}</span></button>
                                <span className={`w-fit border px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em] ${row.draft ? 'border-amber-300/25 bg-amber-300/10 text-amber-100' : 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100'}`}>{row.draft ? 'Draft' : 'Live'}</span>
                                <span className="text-sm text-slate-300">v{row.version}</span><span className="text-xs text-slate-500">{formatDate(row.updatedAt)}</span>
                                <AdminActionMenu label={`Actions for ${getPrimaryLabel(type, row)}`} compact items={[{ id: 'edit', label: 'Open editor', icon: <FilePenLine size={15} />, onSelect: () => openRecord(row.id, 'edit') }, { id: 'preview', label: 'Preview', icon: <Eye size={15} />, onSelect: () => openRecord(row.id, 'preview') }, { id: 'history', label: 'History', icon: <History size={15} />, onSelect: () => openRecord(row.id, 'history') }]} />
                            </div>;
                        })}
                        {!isLoading && records.length === 0 ? <p className="px-5 py-12 text-center text-sm text-slate-500">No records are available from the current Neon source.</p> : null}
                    </div>
                </section>
            </AdminPageShell>

            <AdminDrawer
                open={isCreating || Boolean(selected && (action === 'edit' || !action))}
                onClose={closeOverlay}
                title={isCreating ? `Add ${contentTabs.find((tab) => tab.value === type)?.label || 'content'}` : selected ? getPrimaryLabel(type, selected) : 'Record editor'}
                size="xl"
                footer={isCreating ? <div className="flex justify-end gap-2"><button type="button" onClick={closeOverlay} className="min-h-10 border border-white/10 px-3 text-sm text-slate-300 hover:bg-white/5">Cancel</button><button type="button" onClick={createDraft} disabled={isSaving} className="inline-flex min-h-10 items-center gap-2 border border-sky-300/30 bg-sky-300/10 px-3 text-sm font-semibold text-sky-100 disabled:opacity-50"><Save size={15} />{isSaving ? type === 'hub-guide' && hubGuideFile ? 'Uploading PDF…' : 'Creating draft…' : 'Create draft'}</button></div> : selected ? <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={closeOverlay} className="min-h-10 border border-white/10 px-3 text-sm text-slate-300 hover:bg-white/5">Close</button>{hasDraft ? <button type="button" onClick={() => void discardDraft()} disabled={isSaving} className="min-h-10 border border-red-300/25 px-3 text-sm font-semibold text-red-100 hover:bg-red-300/10 disabled:opacity-50">Discard</button> : null}<button type="button" onClick={saveDraft} disabled={isSaving} className="inline-flex min-h-10 items-center gap-2 border border-sky-300/30 bg-sky-300/10 px-3 text-sm font-semibold text-sky-100 disabled:opacity-50"><Save size={15} />Save draft</button><button type="button" onClick={() => router.push(`${pathname}?tab=${type}&record=${selected.id}&action=publish`, { scroll: false })} disabled={!hasDraft || isSaving} className="inline-flex min-h-10 items-center gap-2 border border-emerald-300/30 bg-emerald-300/10 px-3 text-sm font-semibold text-emerald-100 disabled:opacity-50"><Send size={15} />Publish</button></div> : null}
            >
                {(selected || isCreating) ? <div className="space-y-5">
                    {type === 'hub-guide' ? <section onDragEnter={(event) => { event.preventDefault(); setHubGuideDragActive(true); }} onDragOver={(event) => { event.preventDefault(); setHubGuideDragActive(true); }} onDragLeave={() => setHubGuideDragActive(false)} onDrop={dropHubGuideFile} className={`border border-dashed p-4 text-sm transition ${hubGuideDragActive ? 'border-sky-200 bg-sky-300/10' : 'border-amber-300/30 bg-amber-300/5'} text-slate-300`}>
                        <input ref={hubGuideFileInputRef} type="file" accept="application/pdf,.pdf" disabled={isSaving} onChange={(event) => { selectHubGuideFile(event.target.files?.[0]); event.currentTarget.value = ''; }} className="sr-only" />
                        <span className="block text-xs font-semibold uppercase tracking-[0.1em] text-amber-200">PDF document</span>
                        <p className="mt-2 font-semibold text-white">{hubGuideDragActive ? 'Drop the PDF to select it.' : hubGuideFile ? 'PDF selected and ready to stage.' : 'Drop one PDF here or browse from your device.'}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-400">One PDF, up to 20 MB. Selecting a file fills an empty title; you can still use the PDF or Drive URL field below instead.</p>
                        <div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => hubGuideFileInputRef.current?.click()} disabled={isSaving} className="min-h-10 border border-white/10 px-3 text-xs font-semibold text-slate-100 hover:bg-white/5 disabled:opacity-50">Browse PDF</button>{hubGuideFile ? <button type="button" onClick={() => { clearHubGuideFile(); setIsDirty(true); }} disabled={isSaving} className="min-h-10 border border-white/10 px-3 text-xs font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-50">Remove selection</button> : null}{selected && hubGuideFile ? <button type="button" onClick={() => stageHubGuideFile(selected.id)} disabled={isSaving} className="min-h-10 border border-sky-300/30 bg-sky-300/10 px-3 text-xs font-semibold text-sky-100 disabled:opacity-50">{isSaving ? 'Uploading PDF…' : 'Stage selected PDF'}</button> : null}</div>
                        {hubGuideFile ? <p className="mt-3 text-xs text-slate-200">Selected: <span className="font-semibold text-white">{hubGuideFile.name}</span> · {formatFileSize(hubGuideFile.size)}</p> : null}
                        {!hubGuideFile && selected?.draft?.stagedAssets?.fileName ? <p className="mt-3 text-xs text-emerald-100">Staged PDF: {String(selected.draft.stagedAssets.fileName)}. Upload another file to replace it before publication.</p> : null}
                        <p className="mt-3 min-h-5 text-xs text-rose-200" aria-live="polite">{hubGuideUploadError}</p>
                    </section> : null}
                    {type === 'directory' && !isCreating ? <label className="block border border-dashed border-amber-300/30 bg-amber-300/5 p-4 text-sm text-slate-300"><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.1em] text-amber-200">Staged logo</span><input type="file" accept="image/png,image/jpeg,image/webp" disabled={logoUploading} onChange={(event) => { const file = event.target.files?.[0]; if (file) void stageLogo(file); event.currentTarget.value = ''; }} className="block w-full text-xs text-slate-400 file:mr-3 file:border file:border-white/10 file:bg-white/5 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-200" /><span className="mt-2 block text-xs text-slate-500">Uploads stay private in the restricted Drive folder until publish.</span></label> : null}
                    {(isCreating && type === 'directory' ? ['entryType', ...editableFields[type]] : editableFields[type]).map((key) => { const value = selectedPayload[key]; const isBoolean = typeof value === 'boolean'; const isLong = key.toLowerCase().includes('body') || key === 'message' || key === 'description'; return <label key={key} className="block text-sm text-slate-300"><span className="mb-2 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">{key === 'entryType' ? 'Entry type' : fieldLabels[key] || key}</span>{key === 'entryType' ? <select value={String(value || 'organization')} onChange={(event) => updateField(key, event.target.value)} className="w-full border border-white/10 bg-black/10 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-200/50"><option value="organization">Organization</option><option value="office">Office</option></select> : isBoolean ? <span className="flex min-h-11 items-center gap-3 border border-white/10 bg-black/10 px-3"><input type="checkbox" checked={Boolean(value)} onChange={(event) => updateField(key, event.target.checked)} className="accent-amber-300" /><span>{value ? 'Enabled on public surface' : 'Hidden from public surface'}</span></span> : isLong ? <textarea value={String(value ?? '')} onChange={(event) => updateField(key, event.target.value)} rows={key === 'description' ? 3 : 6} className="w-full border border-white/10 bg-black/10 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-200/50" /> : <input value={String(value ?? '')} onChange={(event) => updateField(key, key === 'sortOrder' ? Number(event.target.value || 0) : event.target.value)} type={key === 'sortOrder' ? 'number' : 'text'} className="w-full border border-white/10 bg-black/10 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-200/50" />}</label>; })}
                    {!isCreating ? <details className="border border-white/10 p-4"><summary className="cursor-pointer text-sm font-semibold text-slate-200">Source and publication state</summary><dl className="mt-3 grid gap-3 text-xs text-slate-400"><div><dt className="text-slate-500">Current version</dt><dd>v{selected?.version}</dd></div><div><dt className="text-slate-500">Last updated</dt><dd>{selected ? formatDate(selected.updatedAt) : 'Not created'}</dd></div><div><dt className="text-slate-500">Draft base version</dt><dd>{selected?.draft ? selected.draft.baseVersion === 0 ? 'New record' : `v${selected.draft.baseVersion}` : 'No draft'}</dd></div></dl></details> : null}
                </div> : null}
            </AdminDrawer>

            <AdminDrawer open={Boolean(selected && action === 'preview')} onClose={closeOverlay} title="Public surface preview" size="lg" footer={<div className="flex justify-end"><button type="button" onClick={closeOverlay} className="min-h-10 border border-white/10 px-3 text-sm text-slate-300 hover:bg-white/5">Close preview</button></div>}>
                {selected ? <div className="border border-white/10 bg-[#111f34] p-5"><h3 className="text-2xl font-semibold text-white">{getPrimaryLabel(type, selected)}</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-300">{displayValue(selectedPayload.manualBody || selectedPayload.articleBody || selectedPayload.description || selectedPayload.message)}</p></div> : null}
            </AdminDrawer>

            <AdminDrawer open={Boolean(selected && action === 'history')} onClose={closeOverlay} title="Publication history" size="lg" footer={<div className="flex justify-end"><button type="button" onClick={closeOverlay} className="min-h-10 border border-white/10 px-3 text-sm text-slate-300 hover:bg-white/5">Close history</button></div>}>
                <button type="button" onClick={() => void loadHistory()} disabled={historyLoading} className="inline-flex min-h-10 items-center gap-2 border border-white/10 px-3 text-sm text-slate-200 hover:bg-white/5"><Loader2 size={15} className={historyLoading ? 'animate-spin' : ''} />Load history</button><div className="mt-4 divide-y divide-white/10 border border-white/10">{history.map((revision) => <div key={revision.id} className="px-4 py-3"><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-white">Version {revision.version}</span><span className="text-xs text-slate-500">{formatDate(revision.publishedAt)}</span></div><p className="mt-1 text-xs text-slate-400">Published by {revision.publisherLabel || 'Officer'}</p></div>)}{!historyLoading && history.length === 0 ? <p className="px-4 py-6 text-sm text-slate-500">Load history to inspect published versions.</p> : null}</div>
            </AdminDrawer>

            <AdminModal open={Boolean(selected && action === 'publish')} onClose={() => router.replace(`${pathname}?tab=${type}&record=${selected?.id || ''}&action=edit`, { scroll: false })} title="Publish this draft?" footer={<div className="flex justify-end gap-2"><button type="button" onClick={() => router.replace(`${pathname}?tab=${type}&record=${selected?.id || ''}&action=edit`, { scroll: false })} className="min-h-10 border border-white/10 px-3 text-sm text-slate-300 hover:bg-white/5">Keep editing</button><button type="button" onClick={() => void publish()} disabled={isSaving || !hasDraft} className="inline-flex min-h-10 items-center gap-2 border border-emerald-300/30 bg-emerald-300/10 px-3 text-sm font-semibold text-emerald-100 disabled:opacity-50"><Send size={15} />Publish now</button></div>}>{selected ? <p className="text-sm leading-6 text-slate-300">You are publishing <strong className="text-white">{getPrimaryLabel(type, selected)}</strong>. If another officer changed the live record, the publish request will fail with a version conflict and keep this draft intact.</p> : null}</AdminModal>

            <AdminModal open={action === 'sync'} onClose={() => router.replace(`${pathname}?tab=news`, { scroll: false })} title="Synchronize news sources" footer={<div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => router.replace(`${pathname}?tab=news`, { scroll: false })} className="min-h-10 border border-white/10 px-3 text-sm text-slate-300 hover:bg-white/5">Close</button><button type="button" onClick={() => void runNewsSync('dry-run')} disabled={syncing} className="min-h-10 border border-sky-300/25 bg-sky-300/10 px-3 text-sm font-semibold text-sky-100">Run dry-run</button><button type="button" onClick={() => void runNewsSync('sync')} disabled={syncing} className="min-h-10 border border-amber-300/25 bg-amber-300/10 px-3 text-sm font-semibold text-amber-100">Confirm sync</button></div>}><p className="text-sm leading-6 text-slate-300">Run a dry-run first. Published news still follows the configured public source.</p></AdminModal>

            <AdminToastRegion toasts={toasts} onDismiss={dismissToast} />
        </>
    );
}
