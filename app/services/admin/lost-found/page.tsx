'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, PackageSearch, RefreshCw, Save, ShieldCheck, XCircle } from 'lucide-react';
import { AdminActionButton, AdminNotice, AdminPageShell } from '@/components/admin/AdminPageShell';
import AdminInspector from '@/components/admin/AdminInspector';

type AdminItem = {
    itemId: string;
    source: 'CSO' | 'STUDENT';
    reportType: 'LOST' | 'FOUND';
    title: string;
    description: string;
    location: string;
    eventDate: string | null;
    reportedAt: string;
    submitterEmail: string;
    submitterName: string;
    csoReference: string;
    status: 'PENDING_REVIEW' | 'PUBLISHED' | 'RESOLVED' | 'REJECTED' | 'ARCHIVED';
    reviewedBy: string;
    reviewedAt: string | null;
    reviewNotes: string;
    commentCount: number;
    attachments: Array<{ attachmentId: string; fileName: string; mimeType: string; kind: 'IMAGE' | 'VIDEO'; url: string }>;
};

type AdminComment = {
    commentId: string;
    timestamp: string;
    authorEmail: string;
    authorRole: 'STUDENT' | 'OFFICER';
    message: string;
    isHidden: boolean;
};

const initialCsoForm = { reportType: 'FOUND', title: '', description: '', location: '', eventDate: '', csoReference: '', status: 'PUBLISHED' };

export default function AdminLostFoundPage() {
    const [items, setItems] = useState<AdminItem[]>([]);
    const [selectedId, setSelectedId] = useState('');
    const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
    const [reviewNotes, setReviewNotes] = useState('');
    const [status, setStatus] = useState<AdminItem['status']>('PENDING_REVIEW');
    const [csoForm, setCsoForm] = useState(initialCsoForm);
    const [csoFiles, setCsoFiles] = useState<File[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [comments, setComments] = useState<AdminComment[]>([]);

    const selectedItem = useMemo(() => items.find((item) => item.itemId === selectedId) || items[0] || null, [items, selectedId]);

    async function loadItems() {
        setLoading(true);
        try {
            const response = await fetch('/api/admin/lost-found', { cache: 'no-store' });
            const json = await response.json();
            if (!response.ok) throw new Error(json.error?.message || 'Unable to load moderation queue.');
            setItems(json.items || []);
            setSelectedId((current) => (json.items || []).some((item: AdminItem) => item.itemId === current) ? current : json.items?.[0]?.itemId || '');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to load moderation queue.');
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { void loadItems(); }, []);

    useEffect(() => {
        const currentItem = items.find((item) => item.itemId === selectedId);
        if (currentItem) {
            setStatus(currentItem.status);
            setReviewNotes(currentItem.reviewNotes);
        }
    }, [items, selectedId]);

    const selectedItemIdForComments = selectedItem?.itemId || '';
    useEffect(() => {
        if (!selectedItemIdForComments) {
            setComments([]);
            return;
        }

        let active = true;
        void fetch(`/api/admin/lost-found/comments?itemId=${encodeURIComponent(selectedItemIdForComments)}`, { cache: 'no-store' })
            .then(async (response) => {
                const json = await response.json();
                if (!response.ok) throw new Error(json.error?.message || 'Unable to load comment moderation queue.');
                if (active) setComments(json.comments || []);
            })
            .catch((error) => {
                if (active) setMessage(error instanceof Error ? error.message : 'Unable to load comment moderation queue.');
            });

        return () => { active = false; };
    }, [selectedItemIdForComments]);

    async function toggleComment(commentEntry: AdminComment) {
        try {
            const response = await fetch('/api/admin/lost-found/comments', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ commentId: commentEntry.commentId, isHidden: !commentEntry.isHidden }),
            });
            const json = await response.json();
            if (!response.ok) throw new Error(json.error?.message || 'Unable to moderate comment.');
            setComments((current) => current.map((entry) => entry.commentId === commentEntry.commentId ? { ...entry, isHidden: json.comment.isHidden } : entry));
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to moderate comment.');
        }
    }

    async function saveReview() {
        if (!selectedItem) return;
        setSaving(true);
        setMessage('');
        try {
            const response = await fetch('/api/admin/lost-found', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId: selectedItem.itemId, status, reviewNotes }),
            });
            const json = await response.json();
            if (!response.ok) throw new Error(json.error?.message || 'Unable to save moderation update.');
            setMessage(`Saved ${selectedItem.itemId}.`);
            await loadItems();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to save moderation update.');
        } finally {
            setSaving(false);
        }
    }

    async function createCsoBulletin(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSaving(true);
        setMessage('');
        try {
            const payload = new FormData();
            Object.entries(csoForm).forEach(([key, value]) => payload.append(key, value));
            csoFiles.forEach((file) => payload.append('attachments', file));
            const response = await fetch('/api/admin/lost-found', { method: 'POST', body: payload });
            const json = await response.json();
            if (!response.ok) throw new Error(json.error?.message || 'Unable to create CSO bulletin.');
            setCsoForm(initialCsoForm);
            setCsoFiles([]);
            setMessage(`Created CSO bulletin ${json.itemId}.`);
            await loadItems();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to create CSO bulletin.');
        } finally {
            setSaving(false);
        }
    }

    return (
        <AdminPageShell
            title="Lost and found queue"
            actions={(
                <AdminActionButton onClick={() => void loadItems()}>
                    <RefreshCw size={15} />
                    Refresh
                </AdminActionButton>
            )}
        >
                {message ? <AdminNotice tone="warning">{message}</AdminNotice> : null}

                <div className="admin-lost-found-workspace mt-8 space-y-6">
                    <section className="admin-lost-found-queue min-h-0 w-full border border-white/10 bg-white/[0.03] p-4" aria-labelledby="queue-heading">
                        <div className="flex items-center justify-between gap-3"><h2 id="queue-heading" className="font-semibold text-white">Queue</h2><span className="text-xs text-slate-500">{items.length} records</span></div>
                        {loading ? <p className="mt-6 flex items-center gap-2 text-sm text-slate-400"><Loader2 size={16} className="animate-spin" /> Loading...</p> : <div className="mt-4 max-h-[50dvh] space-y-2 overflow-y-auto overscroll-contain pr-1 sm:max-h-[62vh] lg:max-h-[calc(100dvh-18rem)]">{items.map((item) => <button key={item.itemId} type="button" onClick={() => { setSelectedId(item.itemId); setMobileDetailOpen(true); }} className={`w-full border p-3 text-left ${selectedItem?.itemId === item.itemId ? 'border-amber-200/70 bg-amber-200/[0.08]' : 'border-white/10 hover:border-white/25'}`}><div className="flex items-center justify-between gap-2"><span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{item.source} · {item.reportType}</span>{item.status === 'PUBLISHED' ? <CheckCircle2 size={14} className="text-emerald-300" /> : item.status === 'REJECTED' ? <XCircle size={14} className="text-rose-300" /> : null}</div><p className="mt-2 text-sm font-semibold text-white">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.status.replace('_', ' ')}</p></button>)}</div>}
                    </section>

                    <AdminInspector mode="drawer" open={Boolean(selectedItem && mobileDetailOpen)} onClose={() => setMobileDetailOpen(false)} title={selectedItem?.title || 'Report inspector'} drawerSize="xl">
                        {selectedItem ? <><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-200">{selectedItem.source} report · {selectedItem.itemId}</p><h2 id="review-heading" className="mt-3 text-2xl font-semibold text-white">{selectedItem.title}</h2></div><PackageSearch size={22} className="text-amber-200" /></div><p className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-300">{selectedItem.description}</p><dl className="mt-6 grid gap-4 border-y border-white/10 py-5 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Location</dt><dd className="mt-1 text-slate-200">{selectedItem.location}</dd></div><div><dt className="text-slate-500">Submitter</dt><dd className="mt-1 break-words text-slate-200">{selectedItem.source === 'CSO' ? 'Civil Security Office' : selectedItem.submitterEmail}</dd></div><div><dt className="text-slate-500">CSO reference</dt><dd className="mt-1 text-slate-200">{selectedItem.csoReference || 'Not supplied'}</dd></div><div><dt className="text-slate-500">Comments</dt><dd className="mt-1 text-slate-200">{selectedItem.commentCount}</dd></div></dl>{selectedItem.attachments.length > 0 ? <div className="mt-5 flex flex-wrap gap-2">{selectedItem.attachments.map((attachment) => <a key={attachment.attachmentId} href={attachment.url} target="_blank" rel="noreferrer" className="border border-white/15 px-3 py-2 text-xs text-slate-300 hover:border-amber-200/50 hover:text-white">{attachment.kind === 'VIDEO' ? 'Video' : 'Image'} · {attachment.fileName}</a>)}</div> : null}<div className="mt-6 space-y-4"><label className="block text-sm text-slate-300">Decision<select value={status} onChange={(event) => setStatus(event.target.value as AdminItem['status'])} className="mt-2 w-full border border-white/15 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-200"><option value="PENDING_REVIEW">Pending review</option><option value="PUBLISHED">Publish</option><option value="RESOLVED">Resolved</option><option value="REJECTED">Reject</option><option value="ARCHIVED">Archive</option></select></label><label className="block text-sm text-slate-300">Review notes<textarea rows={5} maxLength={2000} value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} className="mt-2 w-full resize-y border border-white/15 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-amber-200" /></label><button type="button" onClick={() => void saveReview()} disabled={saving} className="inline-flex items-center gap-2 bg-amber-200 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-amber-100 disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save decision</button></div></> : <div className="flex min-h-80 items-center justify-center text-sm text-slate-500">Select a report to review.</div>}
                    </AdminInspector>

                    <section className={`admin-lost-found-cso border border-white/10 bg-white/[0.03] p-6 ${mobileDetailOpen ? 'max-lg:hidden' : ''}`} aria-labelledby="cso-heading"><div className="flex items-center gap-2"><ShieldCheck size={17} className="text-emerald-200" /><h2 id="cso-heading" className="font-semibold text-white">Add CSO bulletin</h2></div><p className="mt-3 text-sm leading-6 text-slate-400">Use this for the weekly or biweekly CSO update until a validated CSO feed is available.</p><form onSubmit={createCsoBulletin} className="mt-5 space-y-4"><label className="block text-sm text-slate-300">Type<select value={csoForm.reportType} onChange={(event) => setCsoForm((current) => ({ ...current, reportType: event.target.value }))} className="mt-2 w-full border border-white/15 bg-slate-900 px-3 py-2.5 text-sm text-white"><option value="FOUND">Found item</option><option value="LOST">Lost item</option></select></label><label className="block text-sm text-slate-300">Title<input required value={csoForm.title} onChange={(event) => setCsoForm((current) => ({ ...current, title: event.target.value }))} className="mt-2 w-full border border-white/15 bg-white/[0.03] px-3 py-2.5 text-sm text-white" /></label><label className="block text-sm text-slate-300">Description<textarea required minLength={10} value={csoForm.description} onChange={(event) => setCsoForm((current) => ({ ...current, description: event.target.value }))} rows={4} className="mt-2 w-full resize-y border border-white/15 bg-white/[0.03] px-3 py-2.5 text-sm text-white" /></label><label className="block text-sm text-slate-300">Location<input required value={csoForm.location} onChange={(event) => setCsoForm((current) => ({ ...current, location: event.target.value }))} className="mt-2 w-full border border-white/15 bg-white/[0.03] px-3 py-2.5 text-sm text-white" /></label><label className="block text-sm text-slate-300">CSO reference<input value={csoForm.csoReference} onChange={(event) => setCsoForm((current) => ({ ...current, csoReference: event.target.value }))} className="mt-2 w-full border border-white/15 bg-white/[0.03] px-3 py-2.5 text-sm text-white" /></label><label className="block text-sm text-slate-300">Event date<input type="date" value={csoForm.eventDate} onChange={(event) => setCsoForm((current) => ({ ...current, eventDate: event.target.value }))} className="mt-2 w-full border border-white/[0.03] px-3 py-2.5 text-sm text-white" /></label><label className="block text-sm text-slate-300">Attachments<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setCsoFiles(Array.from(event.target.files || []).slice(0, 3))} className="mt-2 block w-full text-xs text-slate-400 file:mr-3 file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white" /><span className="mt-2 block text-xs text-slate-500">Up to 3 JPG, PNG, or WebP images. Each image is limited to 5MB. Video uploads are temporarily disabled pending media scanning.</span></label><button type="submit" disabled={saving} className="inline-flex w-full items-center justify-center gap-2 bg-emerald-200 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-100 disabled:opacity-50">{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Create bulletin</button></form></section>
                </div>

                {selectedItem ? <details open className="mt-8 border border-white/10 bg-white/[0.03] p-6" aria-labelledby="comment-moderation-heading">
                    <summary id="comment-moderation-heading" className="cursor-pointer list-none text-lg font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">Comment moderation</summary>
                    {comments.length === 0 ? <p className="mt-3 text-sm text-slate-500">No comments to review.</p> : <div className="mt-4 grid gap-4 lg:grid-cols-2">{comments.map((entry) => <div key={entry.commentId} className={`border-l-2 pl-4 ${entry.isHidden ? 'border-rose-300/50 opacity-60' : 'border-white/15'}`}><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-400">{entry.authorEmail} · {new Date(entry.timestamp).toLocaleString()}</p><button type="button" onClick={() => void toggleComment(entry)} className="text-xs font-semibold text-amber-200 hover:text-amber-100">{entry.isHidden ? 'Unhide' : 'Hide'}</button></div><p className="mt-2 text-sm leading-6 text-slate-300">{entry.message}</p></div>)}</div>}
                </details> : null}
        </AdminPageShell>
    );
}
