'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ExternalLink, Loader2, MessageSquare, Paperclip, Save, Search, Send } from 'lucide-react';
import { NoncedStyle } from '@/components/CspNonceProvider';

const STATUS_OPTIONS = ['Pending Review', 'Under Review', 'Approved', 'Rejected', 'Needs Revision'] as const;
type ProposalStatus = typeof STATUS_OPTIONS[number];

interface ProposalItem {
    proposalId: string;
    rowNumber: number;
    submittedAt: string;
    submitterEmail: string;
    submitterName: string;
    category: string;
    title: string;
    status: string;
    attachmentUrl: string;
    description: string;
    projectType: string;
    reviewNotes: string;
    updatedBy: string;
    updatedAt: string;
}

interface ProposalCommentItem {
    commentId: string;
    proposalId: string;
    timestamp: string;
    authorEmail: string;
    authorRole: string;
    authorName?: string;
    message: string;
    attachmentUrl: string;
}

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.pdf', '.doc', '.docx']);
const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export default function AdminProposalsPage() {
    const attachmentInputRef = useRef<HTMLInputElement>(null);
    const reviewAttachmentInputRef = useRef<HTMLInputElement>(null);
    const [proposals, setProposals] = useState<ProposalItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [query, setQuery] = useState('');

    const [activeRow, setActiveRow] = useState<number | null>(null);
    const [status, setStatus] = useState<ProposalStatus>('Pending Review');
    const [reviewNotes, setReviewNotes] = useState('');
    const [reviewAttachment, setReviewAttachment] = useState<File | null>(null);
    const [reviewAttachmentError, setReviewAttachmentError] = useState('');
    const [comments, setComments] = useState<ProposalCommentItem[]>([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentsError, setCommentsError] = useState('');
    const [replyMessage, setReplyMessage] = useState('');
    const [replyAttachment, setReplyAttachment] = useState<File | null>(null);
    const [replyAttachmentError, setReplyAttachmentError] = useState('');
    const [replySubmitting, setReplySubmitting] = useState(false);

    const activeProposal = useMemo(
        () => proposals.find((proposal) => proposal.rowNumber === activeRow) || null,
        [proposals, activeRow]
    );

    const filteredProposals = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        if (!normalized) return proposals;

        return proposals.filter((proposal) => (
            proposal.title.toLowerCase().includes(normalized)
            || proposal.status.toLowerCase().includes(normalized)
            || proposal.category.toLowerCase().includes(normalized)
            || proposal.submitterName.toLowerCase().includes(normalized)
            || proposal.submitterEmail.toLowerCase().includes(normalized)
        ));
    }, [proposals, query]);

    useEffect(() => {
        let cancelled = false;

        const fetchComments = async () => {
            if (!activeProposal?.proposalId) {
                setComments([]);
                setCommentsError('');
                return;
            }

            setCommentsLoading(true);
            setCommentsError('');

            try {
                const response = await fetch(`/api/proposals/${encodeURIComponent(activeProposal.proposalId)}/comments`, {
                    cache: 'no-store',
                });
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data?.error?.message || data?.error || 'Unable to load proposal feedback thread.');
                }

                if (!cancelled) {
                    setComments(Array.isArray(data.comments) ? data.comments : []);
                }
            } catch (commentError: any) {
                if (!cancelled) {
                    setComments([]);
                    setCommentsError(commentError?.message || 'Unable to load proposal feedback thread.');
                }
            } finally {
                if (!cancelled) {
                    setCommentsLoading(false);
                }
            }
        };

        fetchComments();

        return () => {
            cancelled = true;
        };
    }, [activeProposal?.proposalId]);

    useEffect(() => {
        let cancelled = false;

        const fetchProposals = async () => {
            setLoading(true);
            setError('');

            try {
                const response = await fetch('/api/admin/proposals', { cache: 'no-store' });
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data?.error || 'Unable to load proposals queue.');
                }

                if (!cancelled) {
                    const rows: ProposalItem[] = Array.isArray(data.proposals) ? data.proposals : [];
                    setProposals(rows);
                    if (rows.length > 0) {
                        selectProposal(rows[0]);
                    }
                }
            } catch (fetchError: any) {
                if (!cancelled) {
                    setError(fetchError?.message || 'Unable to load proposals queue.');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        fetchProposals();

        return () => {
            cancelled = true;
        };
    }, []);

    function selectProposal(proposal: ProposalItem) {
        setActiveRow(proposal.rowNumber);
        setStatus((STATUS_OPTIONS.includes(proposal.status as ProposalStatus) ? proposal.status : 'Pending Review') as ProposalStatus);
        setReviewNotes(proposal.reviewNotes || '');
        setReviewAttachment(null);
        setReviewAttachmentError('');
        setComments([]);
        setCommentsError('');
        setReplyMessage('');
        setReplyAttachment(null);
        setReplyAttachmentError('');
        setSuccess('');
    }

    function handleReviewAttachmentChange(file: File | null) {
        if (!file) {
            setReviewAttachment(null);
            setReviewAttachmentError('');
            return;
        }
        if (file.size > MAX_ATTACHMENT_BYTES) {
            setReviewAttachment(null);
            setReviewAttachmentError('Attachment must be 10 MB or smaller.');
            return;
        }
        const lowerName = file.name.toLowerCase();
        const ext = lowerName.includes('.') ? lowerName.slice(lowerName.lastIndexOf('.')) : '';
        if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(ext)) {
            setReviewAttachment(null);
            setReviewAttachmentError('Allowed files: PNG, JPG, PDF, DOC, and DOCX.');
            return;
        }
        if (file.type && !ALLOWED_ATTACHMENT_MIME_TYPES.has(file.type)) {
            setReviewAttachment(null);
            setReviewAttachmentError('Unsupported attachment type.');
            return;
        }
        setReviewAttachment(file);
        setReviewAttachmentError('');
    }

    function handleAttachmentChange(file: File | null) {
        if (!file) {
            setReplyAttachment(null);
            setReplyAttachmentError('');
            return;
        }

        if (file.size > MAX_ATTACHMENT_BYTES) {
            setReplyAttachment(null);
            setReplyAttachmentError('Attachment must be 10MB or smaller.');
            return;
        }

        const lowerName = file.name.toLowerCase();
        const extension = lowerName.includes('.') ? lowerName.slice(lowerName.lastIndexOf('.')) : '';

        if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(extension)) {
            setReplyAttachment(null);
            setReplyAttachmentError('Allowed files: PNG, JPG, PDF, DOC, and DOCX.');
            return;
        }

        if (file.type && !ALLOWED_ATTACHMENT_MIME_TYPES.has(file.type)) {
            setReplyAttachment(null);
            setReplyAttachmentError('Unsupported attachment type.');
            return;
        }

        setReplyAttachment(file);
        setReplyAttachmentError('');
    }

    async function handleSave() {
        if (!activeProposal) return;

        setSaving(true);
        setError('');
        setSuccess('');

        try {
            let response: Response;
            if (reviewAttachment) {
                const form = new FormData();
                form.set('rowNumber', String(activeProposal.rowNumber));
                form.set('status', status);
                form.set('reviewNotes', reviewNotes);
                form.set('reviewAttachment', reviewAttachment);
                response = await fetch('/api/admin/proposals', { method: 'PATCH', body: form });
            } else {
                response = await fetch('/api/admin/proposals', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rowNumber: activeProposal.rowNumber, status, reviewNotes }),
                });
            }

            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.error || 'Failed to save proposal controls.');
            }

            setProposals((current) =>
                current.map((proposal) => {
                    if (proposal.rowNumber !== activeProposal.rowNumber) return proposal;
                    return {
                        ...proposal,
                        status,
                        reviewNotes,
                        updatedBy: data.updatedBy || proposal.updatedBy,
                        updatedAt: data.updatedAt || proposal.updatedAt,
                    };
                })
            );

            setReviewAttachment(null);
            setReviewAttachmentError('');
            if (reviewAttachmentInputRef.current) reviewAttachmentInputRef.current.value = '';
            setSuccess('Proposal status and notes saved to the sheet.');
        } catch (saveError: any) {
            setError(saveError?.message || 'Failed to save proposal controls.');
        } finally {
            setSaving(false);
        }
    }

    async function handleReplySubmit() {
        if (!activeProposal?.proposalId || !replyMessage.trim() || replySubmitting) return;

        if (replyAttachmentError) {
            setCommentsError(replyAttachmentError);
            return;
        }

        setReplySubmitting(true);
        setCommentsError('');

        try {
            const payload = new FormData();
            payload.set('message', replyMessage);
            if (replyAttachment) {
                payload.set('attachment', replyAttachment);
            }

            const response = await fetch(`/api/proposals/${encodeURIComponent(activeProposal.proposalId)}/comments`, {
                method: 'POST',
                body: payload,
            });
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data?.error?.message || data?.error || 'Failed to send officer follow-up.');
            }

            setComments((current) => [...current, data.comment]);
            setReplyMessage('');
            setReplyAttachment(null);
            setReplyAttachmentError('');
            if (attachmentInputRef.current) {
                attachmentInputRef.current.value = '';
            }
        } catch (replyError: any) {
            setCommentsError(replyError?.message || 'Failed to send officer follow-up.');
        } finally {
            setReplySubmitting(false);
        }
    }

    return (
        <div className="services-shell relative overflow-hidden min-h-screen">
            <div className="services-noise" aria-hidden="true" />

            <section className="relative z-10 pt-20 pb-14 md:pt-28 md:pb-20">
                <div className="container-main max-w-7xl">
                    <Link
                        href="/services/admin"
                        className="inline-flex items-center gap-2 text-sm font-medium text-slate-200 hover:text-white transition-colors mb-8"
                    >
                        <ArrowLeft size={16} /> Return to Admin Hub
                    </Link>

                    <div className="mb-8 md:mb-10">
                        <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight tracking-tight">
                            Project Proposals Control Console
                        </h1>
                        <p className="mt-4 text-slate-300 max-w-3xl leading-relaxed">
                            Review submissions, update proposal outcomes, and keep decision notes synchronized to your sheet ledger.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-6">
                        <div className="rounded-2xl border border-white/10 bg-[#0f223f]/60 backdrop-blur-sm p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-5">
                                <h2 className="text-xl font-semibold text-white">Sheet-Synced Proposals</h2>
                                <div className="relative w-full md:w-80">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input
                                        value={query}
                                        onChange={(event) => setQuery(event.target.value)}
                                        placeholder="Search submitter, title, status..."
                                        className="w-full rounded-xl border border-white/10 bg-black/20 text-white placeholder:text-slate-500 pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                    />
                                </div>
                            </div>

                            {loading ? (
                                <div className="flex items-center justify-center py-16 text-slate-300 gap-2">
                                    <Loader2 size={18} className="animate-spin" /> Loading proposals...
                                </div>
                            ) : filteredProposals.length === 0 ? (
                                <div className="py-16 text-center text-slate-400">No proposals matched your filters.</div>
                            ) : (
                                <div className="max-h-[62vh] overflow-auto pr-1 space-y-3">
                                    {filteredProposals.map((proposal) => {
                                        const isActive = activeRow === proposal.rowNumber;
                                        return (
                                            <button
                                                key={`${proposal.rowNumber}-${proposal.title}`}
                                                type="button"
                                                onClick={() => selectProposal(proposal)}
                                                className={`w-full text-left rounded-xl border p-4 transition ${isActive
                                                    ? 'border-blue-400/60 bg-blue-500/15'
                                                    : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between gap-3">
                                                    <p className="text-sm md:text-base font-semibold text-white line-clamp-1">{proposal.title || 'Untitled Proposal'}</p>
                                                    <span className="text-xs px-2 py-1 rounded-full bg-white/10 text-slate-200 border border-white/10">
                                                        {proposal.status}
                                                    </span>
                                                </div>
                                                <p className="mt-2 text-sm text-slate-300 line-clamp-1">{proposal.submitterName} • {proposal.projectType || 'N/A'}</p>
                                                <div className="mt-2 text-xs text-slate-400 flex flex-wrap gap-3">
                                                    <span>{proposal.category || 'Uncategorized'}</span>
                                                    <span>{proposal.submittedAt || 'No timestamp'}</span>
                                                    <span>Row {proposal.rowNumber}</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-[#0f223f]/60 backdrop-blur-sm p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
                            {!activeProposal ? (
                                <div className="text-slate-300 py-10">Select a proposal to edit controls.</div>
                            ) : (
                                <>
                                    <div className="mb-5">
                                        <p className="text-xs uppercase tracking-wide text-slate-400">Editing Proposal</p>
                                        <p className="text-xl font-bold text-white mt-1">{activeProposal.title || 'Untitled Proposal'}</p>
                                        <p className="text-sm text-slate-300 mt-2 line-clamp-4">{activeProposal.description || 'No description provided.'}</p>
                                    </div>

                                    {activeProposal.attachmentUrl ? (
                                        <a
                                            href={activeProposal.attachmentUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="mb-4 inline-flex items-center gap-1.5 text-sm text-blue-200 hover:text-blue-100"
                                        >
                                            Open attached proposal document <ExternalLink size={14} />
                                        </a>
                                    ) : null}

                                    <div className="space-y-4">
                                        <label className="block">
                                            <span className="text-sm text-slate-300">Review Status</span>
                                            <select
                                                value={status}
                                                onChange={(event) => setStatus(event.target.value as ProposalStatus)}
                                                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 text-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                                            >
                                                {STATUS_OPTIONS.map((option) => (
                                                    <option key={option} value={option} className="bg-slate-900">{option}</option>
                                                ))}
                                            </select>
                                        </label>

                                        <label className="block">
                                            <span className="text-sm text-slate-300">Review Notes</span>
                                            <textarea
                                                value={reviewNotes}
                                                onChange={(event) => setReviewNotes(event.target.value)}
                                                rows={8}
                                                className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 text-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
                                                placeholder="Document reviewer rationale and action items..."
                                            />
                                        </label>

                                        {/* Optional attachment for the review note */}
                                        <div className="rounded-xl border border-white/10 bg-black/10 p-3">
                                            <p className="text-xs font-medium text-slate-300 mb-2 flex items-center gap-1.5">
                                                <Paperclip size={12} />
                                                Supporting Document <span className="text-slate-500 font-normal">(optional — appended to thread)</span>
                                            </p>
                                            <input
                                                ref={reviewAttachmentInputRef}
                                                type="file"
                                                id="review-note-attachment"
                                                accept=".png,.jpg,.jpeg,.pdf,.doc,.docx"
                                                className="hidden"
                                                onChange={(e) => handleReviewAttachmentChange(e.target.files?.[0] || null)}
                                            />
                                            <label
                                                htmlFor="review-note-attachment"
                                                className="inline-flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-white/20 bg-white/5 hover:bg-white/10 text-slate-300 text-xs px-3 py-2 transition"
                                            >
                                                <Paperclip size={13} />
                                                {reviewAttachment ? reviewAttachment.name : 'Attach file...'}
                                            </label>
                                            {reviewAttachment && (
                                                <button
                                                    type="button"
                                                    onClick={() => { setReviewAttachment(null); setReviewAttachmentError(''); if (reviewAttachmentInputRef.current) reviewAttachmentInputRef.current.value = ''; }}
                                                    className="ml-2 text-xs text-red-300 hover:text-red-200 transition"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                            {reviewAttachmentError && <p className="mt-1.5 text-xs text-red-300">{reviewAttachmentError}</p>}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-4 py-3 transition"
                                        >
                                            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                                            Save Proposal Controls
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {activeProposal ? (
                        <div className="mt-6 rounded-2xl border border-white/10 bg-[#0f223f]/60 backdrop-blur-sm p-5 md:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.25)]">
                            <div className="flex items-center justify-between gap-4 mb-5">
                                <div>
                                    <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                                        <MessageSquare size={18} className="text-blue-300" />
                                        Proposal Feedback Loop
                                    </h2>
                                    <p className="text-sm text-slate-400 mt-1">Officer replies, submitter follow-ups, and attachment links are all shown here.</p>
                                </div>
                                {commentsLoading ? (
                                    <div className="flex items-center gap-2 text-sm text-slate-300">
                                        <Loader2 size={16} className="animate-spin" /> Loading thread...
                                    </div>
                                ) : null}
                            </div>

                            {commentsError ? (
                                <p className="mb-4 text-sm text-red-300">{commentsError}</p>
                            ) : null}

                            {comments.length === 0 ? (
                                <p className="text-sm text-slate-400 italic mb-6">No feedback entries yet.</p>
                            ) : (
                                <div className="space-y-4 mb-6 max-h-[32rem] overflow-auto pr-1">
                                    {comments.map((comment) => {
                                        const isOfficer = comment.authorRole === 'OFFICER';
                                        return (
                                            <div
                                                key={comment.commentId}
                                                className={`rounded-xl border p-4 ${isOfficer
                                                    ? 'border-emerald-400/25 bg-emerald-500/10'
                                                    : 'border-white/10 bg-white/5'
                                                }`}
                                            >
                                                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-sm font-semibold text-white">
                                                            {comment.authorName || (isOfficer ? 'OSR Officer' : activeProposal.submitterName || 'Submitter')}
                                                        </span>
                                                        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${isOfficer
                                                            ? 'border-emerald-300/25 bg-emerald-300/15 text-emerald-100'
                                                            : 'border-white/10 bg-white/10 text-slate-200'
                                                        }`}>
                                                            {comment.authorRole}
                                                        </span>
                                                    </div>
                                                    <span className="text-xs text-slate-400">{comment.timestamp}</span>
                                                </div>
                                                <p className="text-sm text-slate-100 whitespace-pre-wrap leading-relaxed">{comment.message}</p>
                                                {comment.attachmentUrl ? (
                                                    <a
                                                        href={comment.attachmentUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-blue-200 hover:text-blue-100"
                                                    >
                                                        <Paperclip size={14} />
                                                        Open attachment
                                                    </a>
                                                ) : null}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            <div className="space-y-4">
                                <label className="block">
                                    <span className="text-sm text-slate-300">Post Officer Follow-up</span>
                                    <textarea
                                        value={replyMessage}
                                        onChange={(event) => setReplyMessage(event.target.value)}
                                        rows={5}
                                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/20 text-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
                                        placeholder="Post a follow-up, request clarifications, or acknowledge submitted revisions..."
                                    />
                                </label>

                                <div className="rounded-xl border border-white/10 bg-black/10 p-4">
                                    <input
                                        ref={attachmentInputRef}
                                        type="file"
                                        className="hidden"
                                        accept=".png,.jpg,.jpeg,.pdf,.doc,.docx"
                                        onChange={(event) => handleAttachmentChange(event.target.files?.[0] || null)}
                                    />
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-white">Optional attachment</p>
                                            <p className="text-xs text-slate-400 mt-1">Attach annotated files, review sheets, or decision documents.</p>
                                            {replyAttachment ? (
                                                <p className="text-xs text-blue-200 mt-2">{replyAttachment.name}</p>
                                            ) : null}
                                            {replyAttachmentError ? (
                                                <p className="text-xs text-red-300 mt-2">{replyAttachmentError}</p>
                                            ) : null}
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                type="button"
                                                onClick={() => attachmentInputRef.current?.click()}
                                                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 text-white px-4 py-2.5 text-sm font-semibold hover:bg-white/10 transition"
                                            >
                                                <Paperclip size={15} />
                                                Choose File
                                            </button>
                                            {replyAttachment ? (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setReplyAttachment(null);
                                                        setReplyAttachmentError('');
                                                        if (attachmentInputRef.current) {
                                                            attachmentInputRef.current.value = '';
                                                        }
                                                    }}
                                                    className="rounded-xl border border-red-400/20 bg-red-500/10 text-red-100 px-4 py-2.5 text-sm font-semibold hover:bg-red-500/20 transition"
                                                >
                                                    Remove
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleReplySubmit}
                                    disabled={replySubmitting || !replyMessage.trim()}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-4 py-3 transition"
                                >
                                    {replySubmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                                    Send Officer Reply
                                </button>
                            </div>
                        </div>
                    ) : null}

                    {success ? (
                        <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-200 px-4 py-3 text-sm">{success}</div>
                    ) : null}

                    {error ? (
                        <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/10 text-red-200 px-4 py-3 text-sm">{error}</div>
                    ) : null}
                </div>
            </section>

            <NoncedStyle css={`
                .services-shell {
                    background: linear-gradient(130deg, #1a3352 0%, #234874 48%, #3e6596 100%);
                    background-image:
                        radial-gradient(130% 120% at 8% 12%, rgba(232, 207, 146, 0.18) 0%, rgba(232, 207, 146, 0) 52%),
                        radial-gradient(140% 120% at 92% 8%, rgba(87, 131, 186, 0.28) 0%, rgba(87, 131, 186, 0) 58%),
                        linear-gradient(130deg, #1a3352 0%, #234874 48%, #3e6596 100%);
                    color: #e2e8f0;
                }

                .services-shell::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(circle at top, rgba(255,255,255,0.03) 0%, transparent 100%);
                    pointer-events: none;
                    z-index: 1;
                }

                .services-noise {
                    position: absolute;
                    inset: 0;
                    background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px);
                    background-size: 32px 32px;
                    opacity: 0.2;
                    mask-image: linear-gradient(to bottom, black 40%, transparent 100%);
                    pointer-events: none;
                    z-index: 2;
                }
            `} />
        </div>
    );
}
