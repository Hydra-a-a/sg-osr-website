'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
    ArrowLeft,
    CalendarDays,
    CheckCircle2,
    ImageIcon,
    Loader2,
    MessageCircle,
    PackageSearch,
    RefreshCw,
    Search,
    Send,
    ShieldCheck,
    Upload,
    Video,
} from 'lucide-react';
import { NoncedStyle } from '@/components/CspNonceProvider';
import { clearDraft, getOrCreateIdempotencyKey, readDraft, resetIdempotencyKey, writeDraft } from '@/lib/draft-storage';

type LostFoundItem = {
    itemId: string;
    source: 'CSO' | 'STUDENT';
    reportType: 'LOST' | 'FOUND';
    title: string;
    description: string;
    location: string;
    eventDate: string | null;
    reportedAt: string;
    status: 'PUBLISHED' | 'RESOLVED';
    attachments: Array<{ attachmentId: string; fileName: string; mimeType: string; kind: 'IMAGE' | 'VIDEO'; url: string }>;
};

type LostFoundComment = {
    commentId: string;
    timestamp: string;
    authorLabel: string;
    message: string;
};

type ReportForm = { reportType: 'LOST' | 'FOUND'; title: string; description: string; location: string; eventDate: string };
const initialForm: ReportForm = { reportType: 'LOST', title: '', description: '', location: '', eventDate: '' };
const LOST_FOUND_DRAFT_KEY = 'osr:draft:lost-found:v1';
const LOST_FOUND_IDEMPOTENCY_KEY = 'osr:idempotency:lost-found:v1';
const LOST_FOUND_DRAFT_VERSION = 1;

export default function LostFoundPage() {
    const { data: session, status: sessionStatus } = useSession();
    const [source, setSource] = useState<'CSO' | 'STUDENT'>('CSO');
    const [reportType, setReportType] = useState<'ALL' | 'LOST' | 'FOUND'>('ALL');
    const [query, setQuery] = useState('');
    const [items, setItems] = useState<LostFoundItem[]>([]);
    const [selectedItemId, setSelectedItemId] = useState('');
    const [comments, setComments] = useState<LostFoundComment[]>([]);
    const [comment, setComment] = useState('');
    const [form, setForm] = useState(initialForm);
    const [files, setFiles] = useState<File[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [commenting, setCommenting] = useState(false);
    const [message, setMessage] = useState('');
    const draftRestoredRef = useRef(false);
    const idempotencyKeyRef = useRef<string | null>(null);

    const selectedItem = useMemo(
        () => items.find((item) => item.itemId === selectedItemId) || items[0] || null,
        [items, selectedItemId],
    );

    const loadItems = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ source });
            if (reportType !== 'ALL') params.set('reportType', reportType);
            if (query.trim()) params.set('query', query.trim());
            const response = await fetch(`/api/hub/lost-found?${params.toString()}`, { cache: 'no-store' });
            const json = await response.json();
            if (!response.ok) throw new Error(json.error?.message || 'Unable to load lost-and-found reports.');
            const nextItems = json.items || [];
            setItems(nextItems);
            setSelectedItemId((current) => nextItems.some((item: LostFoundItem) => item.itemId === current) ? current : nextItems[0]?.itemId || '');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to load lost-and-found reports.');
        } finally {
            setLoading(false);
        }
    }, [query, reportType, source]);

    useEffect(() => {
        void loadItems();
    }, [loadItems]);

    useEffect(() => {
        const draft = readDraft<ReportForm>(LOST_FOUND_DRAFT_KEY, LOST_FOUND_DRAFT_VERSION);
        const restoreTimer = window.setTimeout(() => {
            if (draft) {
                setForm({
                    reportType: draft.reportType === 'FOUND' ? 'FOUND' : 'LOST',
                    title: typeof draft.title === 'string' ? draft.title : '',
                    description: typeof draft.description === 'string' ? draft.description : '',
                    location: typeof draft.location === 'string' ? draft.location : '',
                    eventDate: typeof draft.eventDate === 'string' ? draft.eventDate : '',
                });
            }
            draftRestoredRef.current = true;
        }, 0);
        return () => window.clearTimeout(restoreTimer);
    }, []);

    useEffect(() => {
        if (!draftRestoredRef.current) return;
        const timeout = window.setTimeout(() => writeDraft(LOST_FOUND_DRAFT_KEY, LOST_FOUND_DRAFT_VERSION, form), 250);
        return () => window.clearTimeout(timeout);
    }, [form]);

    const getSubmissionKey = () => {
        if (!idempotencyKeyRef.current) {
            idempotencyKeyRef.current = getOrCreateIdempotencyKey(LOST_FOUND_IDEMPOTENCY_KEY);
        }
        return idempotencyKeyRef.current;
    };

    const selectedItemIdForComments = selectedItem?.itemId || '';
    useEffect(() => {
        if (!selectedItemIdForComments) {
            setComments([]);
            return;
        }

        let active = true;
        void fetch(`/api/hub/lost-found/${encodeURIComponent(selectedItemIdForComments)}/comments`, { cache: 'no-store' })
            .then(async (response) => {
                const json = await response.json();
                if (!response.ok) throw new Error(json.error?.message || 'Unable to load comments.');
                if (active) setComments(json.comments || []);
            })
            .catch((error) => {
                if (active) setMessage(error instanceof Error ? error.message : 'Unable to load comments.');
            });

        return () => { active = false; };
    }, [selectedItemIdForComments]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmitting(true);
        setMessage('');
        try {
            const payload = new FormData();
            Object.entries(form).forEach(([key, value]) => payload.append(key, value));
            files.forEach((file) => payload.append('attachments', file));
            const response = await fetch('/api/hub/lost-found', {
                method: 'POST',
                headers: { 'Idempotency-Key': getSubmissionKey() },
                body: payload,
            });
            const json = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(json.error?.message || 'Unable to submit report.');
            setForm(initialForm);
            setFiles([]);
            clearDraft(LOST_FOUND_DRAFT_KEY);
            idempotencyKeyRef.current = resetIdempotencyKey(LOST_FOUND_IDEMPOTENCY_KEY);
            setMessage(`Report ${json.itemId} submitted for officer review.`);
            setSource('STUDENT');
            await loadItems();
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to submit report.');
        } finally {
            setSubmitting(false);
        }
    }

    async function handleComment(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!selectedItem || !comment.trim()) return;
        setCommenting(true);
        setMessage('');
        try {
            const response = await fetch(`/api/hub/lost-found/${encodeURIComponent(selectedItem.itemId)}/comments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: comment }),
            });
            const json = await response.json();
            if (!response.ok) throw new Error(json.error?.message || 'Unable to post comment.');
            setComments((current) => [...current, json.comment]);
            setComment('');
        } catch (error) {
            setMessage(error instanceof Error ? error.message : 'Unable to post comment.');
        } finally {
            setCommenting(false);
        }
    }

    return (
        <div className="hub-shell min-h-screen text-slate-100">
            <div className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
                <header className="flex items-center gap-4">
                    <Link
                        href="/hub"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
                        aria-label="Back to Information Hub"
                        title="Back to Information Hub"
                    >
                        <ArrowLeft size={18} />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">
                            <PackageSearch size={15} /> Student service
                        </div>
                        <h1 className="mt-2 text-3xl font-bold text-white md:text-4xl">Lost and found</h1>
                    </div>
                </header>
                <div className="mt-8 max-w-3xl">
                    <p className="text-base leading-7 text-slate-300">
                        Check the Civil Security Office bulletin, then review student reports that are waiting for CSO confirmation.
                    </p>
                </div>

                <div className="mt-10 grid gap-8 lg:grid-cols-8">
                    <section aria-labelledby="reports-heading" className="hub-panel min-w-0 p-6 md:col-span-5 md:p-7 lg:col-span-5">
                        <div className="border-b border-white/10 pb-5">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Public reports</p>
                                    <h2 id="reports-heading" className="mt-2 text-2xl font-semibold text-white">
                                        {source === 'CSO' ? 'CSO bulletin' : 'Student reports'}
                                    </h2>
                                </div>
                                <button type="button" onClick={() => void loadItems()} className="hub-action-secondary text-sm">
                                    <RefreshCw size={15} /> Refresh
                                </button>
                            </div>
                            <div className="mt-5 flex border-b border-white/10" role="tablist" aria-label="Lost and found source">
                                {(['CSO', 'STUDENT'] as const).map((value) => (
                                    <button key={value} type="button" role="tab" aria-selected={source === value} onClick={() => setSource(value)} className={`hub-source-tab ${source === value ? 'hub-source-tab-active' : ''}`}>
                                        {value === 'CSO' ? 'CSO bulletin' : 'Student reports'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                            <div className="flex min-w-0 flex-1 items-center gap-2 border-b border-white/15 pb-2">
                                <Search size={16} className="shrink-0 text-slate-500" />
                                <span className="sr-only">Search reports</span>
                                <input
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    onKeyDown={(event) => { if (event.key === 'Enter') void loadItems(); }}
                                    placeholder="Search title, location, or description"
                                    className="hub-search min-w-0 flex-1 border-0 bg-transparent px-0 py-2 text-sm text-white outline-none placeholder:text-slate-500"
                                />
                            </div>
                            <select aria-label="Filter reports by type" value={reportType} onChange={(event) => setReportType(event.target.value as typeof reportType)} className="rounded-md border border-white/15 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-amber-200">
                                <option value="ALL">All reports</option>
                                <option value="LOST">Lost items</option>
                                <option value="FOUND">Found items</option>
                            </select>
                        </div>

                        {message ? <p role="status" className="hub-notice mt-5 pl-3 text-sm text-amber-100">{message}</p> : null}

                        {loading ? (
                            <div className="mt-8 flex items-center gap-3 text-sm text-slate-400"><Loader2 size={18} className="animate-spin" /> Loading reports...</div>
                        ) : items.length === 0 ? (
                            <div className="hub-empty-state mt-8 border-y py-10 text-center text-sm text-slate-400">No public reports match these filters.</div>
                        ) : (
                            <div className="mt-6 divide-y divide-white/10">
                                {items.map((item) => (
                                    <button key={item.itemId} type="button" onClick={() => setSelectedItemId(item.itemId)} className={`hub-report-row w-full text-left ${selectedItem?.itemId === item.itemId ? 'hub-report-row-active' : ''}`}>
                                        <div className="flex items-start justify-between gap-3">
                                            <span className={`text-xs font-semibold uppercase tracking-[0.14em] ${item.reportType === 'LOST' ? 'text-rose-200' : 'text-emerald-200'}`}>{item.reportType === 'LOST' ? 'Lost item' : 'Found item'}</span>
                                            {item.status === 'RESOLVED' ? <CheckCircle2 size={16} className="text-emerald-300" aria-label="Resolved" /> : null}
                                        </div>
                                        <h3 className="mt-3 text-lg font-semibold text-white">{item.title}</h3>
                                        <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-300">{item.description}</p>
                                        <p className="mt-4 text-xs text-slate-400">{item.location} · {new Date(item.reportedAt).toLocaleDateString()}</p>
                                        {item.attachments.length > 0 ? <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-400"><ImageIcon size={14} /> {item.attachments.length} attachment{item.attachments.length === 1 ? '' : 's'}</p> : null}
                                    </button>
                                ))}
                            </div>
                        )}

                        {selectedItem ? (
                            <article className="mt-8 border-t border-white/10 pt-8">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div>
                                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200">Report detail</p>
                                        <h2 className="mt-2 text-2xl font-semibold text-white">{selectedItem.title}</h2>
                                    </div>
                                    {selectedItem.status === 'RESOLVED' ? <span className="inline-flex items-center gap-2 text-sm text-emerald-200"><CheckCircle2 size={16} /> Resolved</span> : null}
                                </div>
                                <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-300">{selectedItem.description}</p>
                                <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-400">
                                    <span className="inline-flex items-center gap-2"><PackageSearch size={15} /> {selectedItem.location}</span>
                                    {selectedItem.eventDate ? <span className="inline-flex items-center gap-2"><CalendarDays size={15} /> Event date {new Date(selectedItem.eventDate).toLocaleDateString()}</span> : null}
                                </div>
                                {selectedItem.attachments.length > 0 ? (
                                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                                        {selectedItem.attachments.map((attachment) => attachment.kind === 'VIDEO' ? (
                                            <video key={attachment.attachmentId} controls preload="metadata" className="aspect-video w-full border border-white/10 bg-black" src={attachment.url} aria-label={attachment.fileName} />
                                        ) : (
                                            <Image key={attachment.attachmentId} src={attachment.url} alt={attachment.fileName} width={640} height={360} className="aspect-video w-full object-cover border border-white/10 bg-slate-900" />
                                        ))}
                                    </div>
                                ) : null}

                                <div className="mt-8 border-t border-white/10 pt-6">
                                    <div className="flex items-center gap-2"><MessageCircle size={17} className="text-amber-200" /><h3 className="font-semibold text-white">Comments</h3></div>
                                    <div className="mt-4 space-y-3">
                                        {comments.length === 0 ? <p className="text-sm text-slate-500">No comments yet.</p> : comments.map((entry) => <div key={entry.commentId} className="border-l-2 border-white/15 pl-4"><p className="text-xs font-semibold text-slate-400">{entry.authorLabel} · {new Date(entry.timestamp).toLocaleString()}</p><p className="mt-1 text-sm leading-6 text-slate-300">{entry.message}</p></div>)}
                                    </div>
                                    <form onSubmit={handleComment} className="mt-5 flex flex-col gap-3 sm:flex-row">
                                        <label className="sr-only" htmlFor="lost-found-comment">Add a comment</label>
                                        <input id="lost-found-comment" value={comment} onChange={(event) => setComment(event.target.value)} placeholder={session ? 'Ask a useful follow-up question' : 'Sign in to comment'} disabled={!session || commenting} className="min-w-0 flex-1 border border-white/15 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50" />
                                        <button type="submit" disabled={!session || commenting || !comment.trim()} className="hub-action-primary text-sm disabled:cursor-not-allowed disabled:opacity-50">{commenting ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Post</button>
                                    </form>
                                </div>
                            </article>
                        ) : null}
                    </section>

                    <aside className="space-y-6 md:col-span-3">
                        <section className="hub-panel p-6" aria-labelledby="submit-heading">
                            <div className="flex items-center gap-2"><Upload size={17} className="text-amber-200" /><h2 id="submit-heading" className="text-lg font-semibold text-white">Submit a student report</h2></div>
                            <p className="mt-3 rounded-lg border border-sky-400/15 bg-sky-400/5 px-3 py-2 text-xs leading-5 text-sky-100/80">Draft text stays in this browser tab for up to two hours. Attachments and account details are never saved.</p>
                            <p className="mt-3 text-sm leading-6 text-slate-400">Student reports stay in review until an officer confirms the listing.</p>
                            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                                <label className="block text-sm text-slate-300">Report type<select value={form.reportType} onChange={(event) => setForm((current) => ({ ...current, reportType: event.target.value as 'LOST' | 'FOUND' }))} className="mt-2 w-full border border-white/15 bg-slate-900 px-3 py-2.5 text-sm text-white outline-none focus:border-amber-200"><option value="LOST">I lost an item</option><option value="FOUND">I found an item</option></select></label>
                                <label className="block text-sm text-slate-300">Title<input required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} maxLength={160} className="mt-2 w-full border border-white/15 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-amber-200" /></label>
                                <label className="block text-sm text-slate-300">Description<textarea required minLength={10} maxLength={4000} rows={4} value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} className="mt-2 w-full resize-y border border-white/15 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-amber-200" /></label>
                                <label className="block text-sm text-slate-300">Location<input required value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} maxLength={240} className="mt-2 w-full border border-white/15 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-amber-200" /></label>
                                <label className="block text-sm text-slate-300">Date lost or found<input type="date" value={form.eventDate} onChange={(event) => setForm((current) => ({ ...current, eventDate: event.target.value }))} className="mt-2 w-full border border-white/15 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-amber-200" /></label>
                                        <label className="block text-sm text-slate-300">Photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(Array.from(event.target.files || []).slice(0, 3))} className="mt-2 block w-full text-xs text-slate-400 file:mr-3 file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white" /><span className="mt-2 block text-xs text-slate-500">Up to 3 JPG, PNG, or WebP images. Each image is limited to 5MB. Video uploads are temporarily disabled pending media scanning.</span></label>
                                <button type="submit" disabled={submitting || sessionStatus === 'loading'} className="hub-action-primary w-full disabled:cursor-not-allowed disabled:opacity-50">{submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {session ? 'Submit for review' : 'Sign in to submit'}</button>
                            </form>
                        </section>
                        <section className="grievance-privacy-note p-4 text-sm leading-6 text-slate-400"><div className="flex items-center gap-2 font-semibold text-emerald-200"><ShieldCheck size={16} /> Privacy and moderation</div><p className="mt-2">Public listings never display submitter email addresses. Do not post phone numbers, student IDs, or sensitive personal details in descriptions or comments.</p></section>
                    </aside>
                </div>
            </div>
            <NoncedStyle css={`
                .hub-shell {
                    background: radial-gradient(88% 96% at 10% 10%, rgba(244, 192, 82, 0.18) 0%, rgba(244, 192, 82, 0) 48%), linear-gradient(135deg, #102845 0%, #1c436c 45%, #245f82 100%);
                }
                .hub-panel {
                    border-radius: 1.5rem;
                    background: linear-gradient(145deg, rgba(12, 22, 36, 0.42), rgba(11, 20, 34, 0.62));
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    box-shadow: 0 20px 50px rgba(4, 10, 22, 0.26);
                    backdrop-filter: blur(18px);
                }
                .hub-action-primary,
                .hub-action-secondary {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    border-radius: 0.9rem;
                    padding: 0.78rem 1rem;
                    font-weight: 600;
                    transition: all 0.2s;
                }
                .hub-action-primary {
                    background: #fbbf24;
                    color: #0f172a;
                }
                .hub-action-primary:hover:not(:disabled) {
                    background: #fcd34d;
                    transform: translateY(-1px);
                }
                .hub-action-secondary {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    color: #fff;
                }
                .hub-action-secondary:hover {
                    background: rgba(255, 255, 255, 0.08);
                    transform: translateY(-1px);
                }
                .hub-source-tab {
                    margin-right: 1.25rem;
                    margin-bottom: -1px;
                    border-bottom: 2px solid transparent;
                    color: rgba(226, 232, 240, 0.68);
                    padding: 0.65rem 0;
                    font-size: 0.8rem;
                    font-weight: 600;
                    transition: color 0.2s, border-color 0.2s;
                }
                .hub-source-tab:hover,
                .hub-source-tab-active {
                    border-bottom-color: #fbbf24;
                    color: #fde68a;
                }
                .hub-report-row {
                    display: block;
                    padding: 1.15rem 0.75rem;
                    transition: background 0.2s ease;
                }
                .hub-report-row:first-child {
                    padding-top: 0.25rem;
                }
                .hub-report-row:hover,
                .hub-report-row-active {
                    background: rgba(244, 192, 82, 0.07);
                }
                .hub-notice {
                    border-left: 2px solid rgba(244, 192, 82, 0.7);
                }
                .hub-empty-state {
                    border-color: rgba(255, 255, 255, 0.15);
                }
                .hub-panel input,
                .hub-panel select,
                .hub-panel textarea {
                    border-radius: 0.5rem;
                    border-color: rgba(255, 255, 255, 0.1);
                    background: rgba(15, 23, 42, 0.55);
                }
                .hub-panel .hub-search {
                    border-radius: 0;
                    background: transparent;
                }
                .hub-panel input:focus,
                .hub-panel select:focus,
                .hub-panel textarea:focus {
                    border-color: rgba(244, 192, 82, 0.5);
                    box-shadow: 0 0 0 1px rgba(244, 192, 82, 0.25);
                }
            `} />
        </div>
    );
}
