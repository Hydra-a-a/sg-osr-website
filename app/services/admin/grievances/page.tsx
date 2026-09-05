'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2, Paperclip, Save, Search, ShieldAlert, X } from 'lucide-react';
import { AdminPageShell } from '@/components/admin/AdminPageShell';
import AdminInspector from '@/components/admin/AdminInspector';

const STATUS_OPTIONS = ['Open', 'In Progress', 'Resolved', 'Closed', 'Appealed'] as const;
type TicketStatus = typeof STATUS_OPTIONS[number];

interface AdminTicket {
    ticketId: string;
    submittedAt: string;
    status: TicketStatus;
    studentId: string;
    studentName: string;
    studentEmail: string;
    campus: string;
    college: string;
    category: string;
    subject: string;
    complaintNarrative: string;
    attachmentUrl: string;
    resolutionNotes: string;
    officerSendControl: string;
    officerPublishNote: string;
    officerUpdatedBy: string;
    officerUpdatedAt: string;
    officerLastPublishedAt: string;
    optionalUpdateDestinationStatus: string;
}

interface TicketCommentItem {
    commentId: string;
    timestamp: string;
    author: string;
    authorRole: string;
    message: string;
    attachmentUrl: string;
    isAppeal: boolean;
}

interface AttachmentItem {
    id: string;
    label: string;
    source: 'grievance' | 'appeal';
    url: string;
    timestamp?: string;
}

function toGooglePreviewUrl(rawUrl: string): string {
    const url = String(rawUrl || '').trim();
    if (!url) return '';

    try {
        const parsed = new URL(url);
        const fileIdMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/i);
        if (fileIdMatch?.[1]) {
            return `https://drive.google.com/file/d/${fileIdMatch[1]}/preview`;
        }

        const queryFileId = parsed.searchParams.get('id');
        if (queryFileId) {
            return `https://drive.google.com/file/d/${queryFileId}/preview`;
        }

        return url;
    } catch {
        return url;
    }
}

function toSortableTimestamp(rawTimestamp?: string): number {
    const raw = String(rawTimestamp || '').trim();
    if (!raw) return 0;

    const normalized = raw.replace(' PHT', '+08:00').replace(' ', 'T');
    const parsed = Date.parse(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
}

export default function AdminGrievancesPage() {
    const [tickets, setTickets] = useState<AdminTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [queueFilter, setQueueFilter] = useState<'all' | 'appealed' | 'needs-publish'>('all');
    const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

    const [activeTicketId, setActiveTicketId] = useState('');
    const [status, setStatus] = useState<TicketStatus>('Open');
    const [resolutionNotes, setResolutionNotes] = useState('');
    const [publishNow, setPublishNow] = useState(false);
    const [publishNote, setPublishNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [quickAppealSaving, setQuickAppealSaving] = useState(false);
    const [saveMessage, setSaveMessage] = useState('');
    const [ticketComments, setTicketComments] = useState<TicketCommentItem[]>([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentsError, setCommentsError] = useState('');
    const [selectedAttachmentUrl, setSelectedAttachmentUrl] = useState('');
    const [resolutionAttachment, setResolutionAttachment] = useState<File | null>(null);

    const activeTicket = useMemo(
        () => tickets.find((ticket) => ticket.ticketId === activeTicketId) || null,
        [tickets, activeTicketId]
    );

    const studentIsAnonymous = Boolean(
        activeTicket && (
            !activeTicket.studentEmail
            || activeTicket.studentEmail.toLowerCase() === 'anonymous'
            || activeTicket.studentEmail.toLowerCase() === 'anonymous@rtu.edu.ph'
            || activeTicket.studentName.toLowerCase() === 'anonymous student'
        )
    );

    const attachmentItems = useMemo(() => {
        const items: AttachmentItem[] = [];

        if (activeTicket?.attachmentUrl) {
            items.push({
                id: `${activeTicket.ticketId}-primary`,
                label: 'Original Grievance Attachment',
                source: 'grievance',
                url: activeTicket.attachmentUrl,
                timestamp: activeTicket.submittedAt,
            });
        }

        ticketComments.forEach((comment) => {
            if (!comment.attachmentUrl) return;
            items.push({
                id: comment.commentId || `${activeTicketId}-${comment.timestamp}`,
                label: comment.isAppeal ? 'Appeal Attachment' : 'Comment Attachment',
                source: 'appeal',
                url: comment.attachmentUrl,
                timestamp: comment.timestamp,
            });
        });

        return items;
    }, [activeTicket, ticketComments, activeTicketId]);

    const visibleAttachmentItems = useMemo(() => {
        return [...attachmentItems].sort((a, b) => toSortableTimestamp(b.timestamp) - toSortableTimestamp(a.timestamp));
    }, [attachmentItems]);

    const filteredTickets = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        return tickets.filter((ticket) => {
            const matchesQuery = !normalized || (
                ticket.ticketId.toLowerCase().includes(normalized)
                || ticket.category.toLowerCase().includes(normalized)
                || ticket.status.toLowerCase().includes(normalized)
                || ticket.studentName.toLowerCase().includes(normalized)
                || ticket.subject.toLowerCase().includes(normalized)
            );

            if (!matchesQuery) {
                return false;
            }

            if (queueFilter === 'appealed') {
                return ticket.status === 'Appealed';
            }

            if (queueFilter === 'needs-publish') {
                return (ticket.officerSendControl || '').trim().toLowerCase() !== 'published';
            }

            return true;
        });
    }, [tickets, query, queueFilter]);

    const activityEntries = useMemo(() => {
        const entries: Array<{
            key: string;
            kind: 'updated' | 'published';
            ticketId: string;
            by: string;
            at: string;
            detail: string;
        }> = [];

        tickets.forEach((ticket) => {
            if (ticket.officerUpdatedAt) {
                entries.push({
                    key: `${ticket.ticketId}-updated-${ticket.officerUpdatedAt}`,
                    kind: 'updated',
                    ticketId: ticket.ticketId,
                    by: ticket.officerUpdatedBy || 'officer',
                    at: ticket.officerUpdatedAt,
                    detail: `Status: ${ticket.status}`,
                });
            }

            if (ticket.officerLastPublishedAt) {
                entries.push({
                    key: `${ticket.ticketId}-published-${ticket.officerLastPublishedAt}`,
                    kind: 'published',
                    ticketId: ticket.ticketId,
                    by: ticket.officerUpdatedBy || 'officer',
                    at: ticket.officerLastPublishedAt,
                    detail: ticket.officerPublishNote || 'Published update controls',
                });
            }
        });

        return entries
            .sort((a, b) => b.at.localeCompare(a.at))
            .slice(0, 14);
    }, [tickets]);

    useEffect(() => {
        let cancelled = false;

        const fetchTickets = async () => {
            setLoading(true);
            setError('');

            try {
                const response = await fetch('/api/admin/tickets', { cache: 'no-store' });
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data?.error || 'Unable to load officer grievance queue.');
                }

                if (!cancelled) {
                    const rows: AdminTicket[] = Array.isArray(data.tickets) ? data.tickets : [];
                    setTickets(rows);

                    if (rows.length > 0) {
                        hydrateEditor(rows[0]);
                    } else {
                        setActiveTicketId('');
                    }
                }
            } catch (fetchError: any) {
                if (!cancelled) {
                    setError(fetchError?.message || 'Unable to load officer grievance queue.');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        fetchTickets();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!activeTicketId) {
            setTicketComments([]);
            setCommentsError('');
            return;
        }

        let cancelled = false;

        const fetchTicketComments = async () => {
            setCommentsLoading(true);
            setCommentsError('');

            try {
                const response = await fetch(`/api/tickets/${encodeURIComponent(activeTicketId)}/comments`, { cache: 'no-store' });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data?.error || 'Unable to load appeal thread attachments.');
                }

                if (!cancelled) {
                    const rows: TicketCommentItem[] = Array.isArray(data.comments) ? data.comments : [];
                    setTicketComments(rows);
                }
            } catch (commentError: any) {
                if (!cancelled) {
                    setCommentsError(commentError?.message || 'Unable to load appeal thread attachments.');
                    setTicketComments([]);
                }
            } finally {
                if (!cancelled) {
                    setCommentsLoading(false);
                }
            }
        };

        fetchTicketComments();

        return () => {
            cancelled = true;
        };
    }, [activeTicketId]);

    useEffect(() => {
        if (attachmentItems.length === 0) {
            setSelectedAttachmentUrl('');
            return;
        }

        setSelectedAttachmentUrl((current) => {
            if (current && attachmentItems.some((item) => item.url === current)) {
                return current;
            }
            return attachmentItems[0].url;
        });
    }, [attachmentItems]);

    function hydrateEditor(ticket: AdminTicket) {
        setActiveTicketId(ticket.ticketId);
        setMobileDetailOpen(true);
        setStatus(ticket.status);
        setResolutionNotes(ticket.resolutionNotes || '');
        setPublishNow(false);
        setPublishNote(ticket.officerPublishNote || '');
        setSaveMessage('');
        setResolutionAttachment(null);
    }

    async function persistTicketUpdate(next: {
        ticketId: string;
        status: TicketStatus;
        resolutionNotes: string;
        publish: boolean;
        publishNote: string;
        attachment?: File | null;
    }) {
        let body: BodyInit;
        const headers: Record<string, string> = {};

        if (next.attachment) {
            const form = new FormData();
            form.append('ticketId', next.ticketId);
            form.append('status', next.status);
            form.append('resolutionNotes', next.resolutionNotes);
            form.append('publish', String(next.publish));
            form.append('publishNote', next.publishNote);
            form.append('resolutionAttachment', next.attachment);
            body = form;
            // Do NOT set Content-Type — browser sets it with the boundary automatically
        } else {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify({
                ticketId: next.ticketId,
                status: next.status,
                resolutionNotes: next.resolutionNotes,
                publish: next.publish,
                publishNote: next.publishNote,
            });
        }

        const response = await fetch('/api/admin/tickets', {
            method: 'PATCH',
            headers,
            body,
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data?.error || 'Failed to save grievance controls.');
        }

        setTickets((current) =>
            current.map((ticket) => {
                if (ticket.ticketId !== next.ticketId) return ticket;

                return {
                    ...ticket,
                    status: next.status,
                    resolutionNotes: next.resolutionNotes,
                    officerPublishNote: next.publishNote,
                    officerSendControl: next.publish ? 'Published' : 'Draft',
                    officerUpdatedAt: data.updatedAt || ticket.officerUpdatedAt,
                    officerUpdatedBy: data.updatedBy || ticket.officerUpdatedBy,
                    officerLastPublishedAt: next.publish ? (data.updatedAt || ticket.officerLastPublishedAt) : ticket.officerLastPublishedAt,
                };
            })
        );

        const incomingComments = Array.isArray(data.comments) ? data.comments : [];
        if (incomingComments.length > 0) {
            setTicketComments((current) => {
                const existingIds = new Set(current.map((comment) => comment.commentId));
                return [
                    ...current,
                    ...incomingComments.filter((comment: TicketCommentItem) => !existingIds.has(comment.commentId)),
                ];
            });
        }

        return data;
    }

    async function handleSave() {
        if (!activeTicket) return;

        setSaving(true);
        setSaveMessage('');
        setError('');

        try {
            await persistTicketUpdate({
                ticketId: activeTicket.ticketId,
                status,
                resolutionNotes,
                publish: publishNow,
                publishNote,
                attachment: resolutionAttachment,
            });

            setSaveMessage(publishNow
                ? 'Controls saved and published. Student notifications can now flow from the sheet sync process.'
                : 'Draft controls saved to the sheet. Publish when ready to release updates.');
            setPublishNow(false);
            setResolutionAttachment(null);
        } catch (saveError: any) {
            setError(saveError?.message || 'Failed to save grievance controls.');
        } finally {
            setSaving(false);
        }
    }

    async function handleQuickAppeal() {
        if (!activeTicket) return;

        setQuickAppealSaving(true);
        setError('');
        setSaveMessage('');

        try {
            await persistTicketUpdate({
                ticketId: activeTicket.ticketId,
                status: 'Appealed',
                resolutionNotes,
                publish: false,
                publishNote,
            });

            setStatus('Appealed');
            setSaveMessage('Ticket moved to Appealed queue. Publish when your notes are ready to release.');
        } catch (quickError: any) {
            setError(quickError?.message || 'Unable to set ticket as appealed.');
        } finally {
            setQuickAppealSaving(false);
        }
    }

    return (
        <AdminPageShell
            title="Grievance and appeals console"
        >

                    <div className="admin-grievances-workspace mt-8">
                        <div className="admin-grievances-queue min-h-0 w-full border border-white/10 bg-white/[0.04] p-5 md:p-6 shadow-[0_12px_36px_rgba(0,0,0,0.2)] flex flex-col">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                                <h2 className="text-xl font-semibold text-white">Sheet-Synced Cases</h2>
                                <div className="relative w-full md:w-80">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        value={query}
                                        onChange={(event) => setQuery(event.target.value)}
                                        placeholder="Search ticket, subject, category..."
                                        className="w-full rounded-xl border border-white/10 bg-black/20 text-white placeholder:text-slate-500 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                    />
                                </div>
                            </div>

                            <div className="mb-4 flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={() => setQueueFilter('all')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${queueFilter === 'all' ? 'bg-blue-500/20 border-blue-400/40 text-blue-200' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}
                                >
                                    All Cases
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setQueueFilter('appealed')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${queueFilter === 'appealed' ? 'bg-orange-500/20 border-orange-400/40 text-orange-200' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}
                                >
                                    Appeals Queue
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setQueueFilter('needs-publish')}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${queueFilter === 'needs-publish' ? 'bg-amber-500/20 border-amber-400/40 text-amber-200' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}
                                >
                                    Needs Publish
                                </button>
                            </div>

                            {loading ? (
                                <div className="flex items-center justify-center py-16 text-slate-300 gap-2">
                                    <Loader2 size={18} className="animate-spin" /> Loading grievance queue...
                                </div>
                            ) : filteredTickets.length === 0 ? (
                                <div className="py-16 text-center text-slate-400">No tickets matched your filters.</div>
                            ) : (
                                <div className="flex-1 min-h-0 max-h-[50dvh] overflow-y-auto overscroll-contain pr-1 space-y-3 pb-2 sm:max-h-[62vh] xl:max-h-[calc(100dvh-18rem)]">
                                    {filteredTickets.map((ticket) => {
                                        const isActive = activeTicketId === ticket.ticketId;
                                        return (
                                            <button
                                                key={ticket.ticketId}
                                                type="button"
                                                onClick={() => hydrateEditor(ticket)}
                                                className={`w-full text-left rounded-xl border p-4 transition ${isActive
                                                    ? 'border-blue-400/60 bg-blue-500/15'
                                                    : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                                                    }`}
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="text-sm md:text-base font-semibold text-white">{ticket.ticketId}</p>
                                                    <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-slate-200 border border-white/10">
                                                        {ticket.status}
                                                    </span>
                                                </div>
                                                <p className="mt-2 text-sm text-slate-300 line-clamp-1">{ticket.subject || 'No subject provided'}</p>
                                                <div className="mt-2 text-xs text-slate-400 flex flex-wrap gap-3">
                                                    <span>{ticket.category || 'Uncategorized'}</span>
                                                    <span>{ticket.campus || 'Campus N/A'}</span>
                                                    <span>{ticket.submittedAt || 'No timestamp'}</span>
                                                    <span className="text-blue-200/80">{ticket.officerSendControl || 'Draft'}</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <AdminInspector mode="drawer" open={Boolean(activeTicket && mobileDetailOpen)} onClose={() => setMobileDetailOpen(false)} title={activeTicket?.ticketId || 'Ticket inspector'} drawerSize="xl">
                            {!activeTicket ? (
                                <div className="text-slate-300 py-10">Select a ticket to edit controls.</div>
                            ) : (
                                <>
                                    <div className="mb-5">
                                        <p className="text-xs uppercase tracking-wide text-slate-400">Editing Ticket</p>
                                        <p className="text-xl font-bold text-white mt-1">{activeTicket.ticketId}</p>
                                        <p className="text-sm text-slate-300 mt-2 line-clamp-3">
                                            {activeTicket.complaintNarrative || 'No narrative provided.'}
                                        </p>
                                    </div>

                                    {studentIsAnonymous ? (
                                        <div className="mb-5 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                                            <p className="font-semibold text-white mb-1">Anonymous submission</p>
                                            <p>
                                                The student filed this case anonymously, so identity details are intentionally hidden in the editor.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="mb-5 rounded-xl border border-white/10 bg-white/5 p-4">
                                            <p className="text-sm font-semibold text-white mb-3">Student Information</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                                <div>
                                                    <p className="text-slate-400 text-xs uppercase tracking-wide">Student ID</p>
                                                    <p className="text-slate-100 mt-1 break-words">{activeTicket.studentId || 'Not provided'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-400 text-xs uppercase tracking-wide">Student Name</p>
                                                    <p className="text-slate-100 mt-1 break-words">{activeTicket.studentName || 'Not provided'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-400 text-xs uppercase tracking-wide">Email</p>
                                                    <p className="text-slate-100 mt-1 break-words">{activeTicket.studentEmail || 'Not provided'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-slate-400 text-xs uppercase tracking-wide">Campus</p>
                                                    <p className="text-slate-100 mt-1 break-words">{activeTicket.campus || 'Campus N/A'}</p>
                                                </div>
                                                <div className="sm:col-span-2">
                                                    <p className="text-slate-400 text-xs uppercase tracking-wide">College / Institute</p>
                                                    <p className="text-slate-100 mt-1 break-words">{activeTicket.college || 'College N/A'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <div className="mb-5 rounded-xl border border-white/10 bg-black/20 p-3.5">
                                        <div className="flex items-center justify-between gap-3 mb-2">
                                            <p className="text-sm font-semibold text-white">Grievance and Appeals Attachments</p>
                                            {commentsLoading ? <span className="text-xs text-slate-400">Loading thread...</span> : null}
                                        </div>

                                        {visibleAttachmentItems.length === 0 ? (
                                            <p className="text-xs text-slate-400">No attachment is available for this ticket yet.</p>
                                        ) : (
                                            <div className="space-y-2 mb-3 max-h-36 overflow-auto pr-1 pb-1">
                                                {visibleAttachmentItems.map((item) => (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        onClick={() => setSelectedAttachmentUrl(item.url)}
                                                        className={`w-full text-left rounded-lg border px-3 py-2 text-xs transition ${selectedAttachmentUrl === item.url ? 'border-blue-400/50 bg-blue-500/10 text-blue-200' : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'}`}
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <span>{item.label}</span>
                                                            <span className={`px-1.5 py-0.5 rounded border ${item.source === 'grievance' ? 'border-cyan-400/40 text-cyan-200 bg-cyan-500/10' : 'border-orange-400/40 text-orange-200 bg-orange-500/10'}`}>
                                                                {item.source === 'grievance' ? 'Grievance' : 'Appeal'}
                                                            </span>
                                                        </div>
                                                        {item.timestamp ? <p className="mt-1 text-[11px] text-slate-500">{item.timestamp}</p> : null}
                                                    </button>
                                                ))}
                                            </div>
                                        )}

                                        {commentsError ? <p className="text-xs text-red-300 mb-2">{commentsError}</p> : null}

                                        {selectedAttachmentUrl ? (
                                            <>
                                                <div className="pdf-embed-shell h-52">
                                                    <iframe
                                                        title="Attachment preview"
                                                        src={toGooglePreviewUrl(selectedAttachmentUrl)}
                                                        className="h-52"
                                                    />
                                                </div>
                                                <a
                                                    href={selectedAttachmentUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="mt-2 inline-flex items-center gap-1.5 text-xs text-blue-200 hover:text-blue-100"
                                                >
                                                    Open attachment in new tab <ExternalLink size={12} />
                                                </a>
                                            </>
                                        ) : null}
                                    </div>

                                    <div className="space-y-4 flex-1 min-h-0">
                                        <label className="block">
                                            <span className="text-sm text-slate-300">Case Status</span>
                                            <select
                                                value={status}
                                                onChange={(event) => setStatus(event.target.value as TicketStatus)}
                                                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 text-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                            >
                                                {STATUS_OPTIONS.map((option) => (
                                                    <option key={option} value={option} className="bg-slate-900">{option}</option>
                                                ))}
                                            </select>
                                        </label>

                                        <button
                                            type="button"
                                            onClick={handleQuickAppeal}
                                            disabled={quickAppealSaving || status === 'Appealed'}
                                            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600/80 hover:bg-orange-500/80 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-4 py-2.5 transition"
                                        >
                                            {quickAppealSaving ? <Loader2 size={16} className="animate-spin" /> : null}
                                            One-Click: Move To Appealed Queue
                                        </button>

                                        <label className="block">
                                            <span className="text-sm text-slate-300">Resolution Notes (Sheet column M)</span>
                                            <textarea
                                                value={resolutionNotes}
                                                onChange={(event) => setResolutionNotes(event.target.value)}
                                                rows={6}
                                                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 text-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
                                                placeholder="Write officer resolution notes..."
                                            />
                                        </label>

                                        <div className="rounded-xl border border-white/10 bg-black/20 p-3.5">
                                            <p className="text-sm text-slate-300 mb-2 flex items-center gap-1.5">
                                                <Paperclip size={14} /> Optional Evidence Attachment
                                                <span className="text-xs text-slate-500">(PNG, JPG, PDF, DOC — max 10 MB)</span>
                                            </p>
                                            {resolutionAttachment ? (
                                                <div className="flex items-center gap-2 rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                                                    <Paperclip size={13} />
                                                    <span className="flex-1 truncate">{resolutionAttachment.name}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setResolutionAttachment(null)}
                                                        className="text-emerald-300 hover:text-white transition"
                                                        aria-label="Remove attachment"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-white/20 bg-white/5 hover:bg-white/10 px-3 py-2 text-sm text-slate-400 hover:text-slate-200 transition">
                                                    <Paperclip size={14} />
                                                    <span>Click to attach a file</span>
                                                    <input
                                                        type="file"
                                                        className="sr-only"
                                                        accept=".png,.jpg,.jpeg,.pdf,.doc,.docx"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) setResolutionAttachment(file);
                                                            e.target.value = '';
                                                        }}
                                                    />
                                                </label>
                                            )}
                                            {!publishNow && resolutionAttachment && (
                                                <p className="mt-2 text-[11px] text-amber-300/80">
                                                    Attachment is only uploaded to Drive and linked in the comment thread when &quot;Publish&quot; is checked.
                                                </p>
                                            )}
                                        </div>

                                        <label className="block">
                                            <span className="text-sm text-slate-300">Publish Note (Officer metadata)</span>
                                            <input
                                                value={publishNote}
                                                onChange={(event) => setPublishNote(event.target.value)}
                                                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 text-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                                placeholder="Optional release note for this update"
                                            />
                                        </label>

                                        <label className="flex items-center gap-2 text-sm text-slate-200">
                                            <input
                                                type="checkbox"
                                                checked={publishNow}
                                                onChange={(event) => setPublishNow(event.target.checked)}
                                                className="h-4 w-4 rounded border-white/20 bg-black/30"
                                            />
                                            Mark this update as Published (allows outbound notifications)
                                        </label>

                                        <button
                                            type="button"
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-4 py-3 transition"
                                        >
                                            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                            Save Controls to Sheet
                                        </button>

                                        {saveMessage ? (
                                            <p className="text-sm text-emerald-300 inline-flex items-start gap-2">
                                                <CheckCircle2 size={16} className="mt-0.5" /> {saveMessage}
                                            </p>
                                        ) : null}
                                    </div>

                                    <div className="mt-6 rounded-xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                                        <p className="font-semibold inline-flex items-center gap-2 mb-1">
                                            <ShieldAlert size={16} /> Audit-safe architecture
                                        </p>
                                        <p>
                                            This console writes directly to the same Tickets sheet columns used by the existing grievance workflow.
                                            Spreadsheet history and formulas remain your canonical audit trail.
                                        </p>
                                    </div>
                                </>
                            )}
                        </AdminInspector>
                    </div>

                    <details open className="mt-6 border border-white/10 bg-white/[0.04] p-5 md:p-6 shadow-[0_12px_36px_rgba(0,0,0,0.2)]">
                        <summary className="cursor-pointer list-none text-lg font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200">Officer Activity Log</summary>
                        <div className="mt-4">
                        {activityEntries.length === 0 ? (
                            <p className="text-sm text-slate-400">No officer activity metadata found yet.</p>
                        ) : (
                            <div className="space-y-2 max-h-72 overflow-auto pr-1">
                                {activityEntries.map((entry) => (
                                    <div key={entry.key} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm">
                                        <div className="flex flex-wrap items-center gap-2 text-slate-200">
                                            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${entry.kind === 'published' ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200' : 'bg-blue-500/15 border-blue-400/40 text-blue-200'}`}>
                                                {entry.kind === 'published' ? 'Published' : 'Updated'}
                                            </span>
                                            <span className="font-medium">{entry.ticketId}</span>
                                            <span className="text-slate-400">{entry.at}</span>
                                        </div>
                                        <p className="text-slate-300 mt-1">{entry.detail}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">by {entry.by}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                        </div>
                    </details>

                    {error ? (
                        <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 text-red-200 px-4 py-3 text-sm">
                            {error}
                        </div>
                    ) : null}
        </AdminPageShell>
    );
}
