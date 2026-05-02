'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { NoncedStyle } from '@/components/CspNonceProvider';
import { formatManilaDateTime, formatManilaShortDate } from '@/lib/date-time';
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle2,
    ChevronRight,
    Clock3,
    FileText,
    Lightbulb,
    Loader2,
    MessageSquare,
    Search,
    Send,
    ShieldCheck,
    UploadCloud,
} from 'lucide-react';

type ProposalStatus = 'Pending Review' | 'Under Review' | 'Approved' | 'Rejected' | 'Needs Revision';

interface ProposalItem {
    proposalId: string;
    rowNumber: number;
    submittedAt: string;
    submitterEmail: string;
    submitterName: string;
    category: string;
    title: string;
    status: ProposalStatus;
    attachmentUrl: string;
    description: string;
    projectType: string;
    reviewNotes: string;
    updatedBy: string;
    updatedAt: string;
}

interface ProposalComment {
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

const ACCESS_TOKEN_STORAGE_KEY = 'osr_proposal_access_tokens';

const TIMELINE_STEPS: Array<{
    label: string;
    description: string;
    activeFor: ProposalStatus[];
}> = [
    {
        label: 'Submitted',
        description: 'Your proposal document and summary were logged into the review queue.',
        activeFor: ['Pending Review', 'Under Review', 'Needs Revision', 'Approved', 'Rejected'],
    },
    {
        label: 'Under Review',
        description: 'The reviewing office is assessing feasibility, policy alignment, and supporting details.',
        activeFor: ['Under Review', 'Needs Revision', 'Approved', 'Rejected'],
    },
    {
        label: 'Revisions Needed',
        description: 'The reviewing office requested updates before final board action.',
        activeFor: ['Needs Revision'],
    },
    {
        label: 'Board Decision',
        description: 'Final decision and reviewer notes are available in the tracker.',
        activeFor: ['Approved', 'Rejected'],
    },
];

function getFileExtension(fileName: string): string {
    const lowered = fileName.toLowerCase();
    return lowered.includes('.') ? lowered.slice(lowered.lastIndexOf('.')) : '';
}

function normalizeProposalId(value: string): string {
    return String(value || '').trim().toUpperCase();
}

function loadStoredAccessTokens(): Record<string, string> {
    try {
        const raw = sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
        return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
        return {};
    }
}

function saveStoredAccessToken(proposalId: string, accessToken: string): void {
    const normalizedProposalId = normalizeProposalId(proposalId);
    const normalizedToken = String(accessToken || '').trim();
    if (!normalizedProposalId || !normalizedToken) {
        return;
    }

    try {
        const existing = loadStoredAccessTokens();
        existing[normalizedProposalId] = normalizedToken;
        sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, JSON.stringify(existing));
    } catch {
    }
}

function getStoredAccessToken(proposalId: string): string {
    const normalizedProposalId = normalizeProposalId(proposalId);
    if (!normalizedProposalId) {
        return '';
    }

    return loadStoredAccessTokens()[normalizedProposalId] || '';
}

function Timeline({ status }: { status: ProposalStatus }) {
    const currentIndex = TIMELINE_STEPS.findLastIndex((step) => step.activeFor.includes(status));

    return (
        <div className="proposal-card p-6">
            <h3 className="text-sm font-semibold text-white mb-5">Proposal Timeline</h3>
            <div className="relative">
                <div className="absolute left-[15px] top-6 bottom-6 w-px bg-white/10" />
                <div className="space-y-6">
                    {TIMELINE_STEPS.map((step, index) => {
                        const isActive = step.activeFor.includes(status);
                        const isCurrent = currentIndex === index;
                        return (
                            <div key={step.label} className="flex gap-4 relative">
                                <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center z-10 ring-4 ring-[#173252] ${
                                    isActive
                                        ? isCurrent && status !== 'Approved' && status !== 'Rejected'
                                            ? 'bg-sky-400/20 text-sky-200'
                                            : 'bg-emerald-400/20 text-emerald-200'
                                        : 'bg-white/5 text-slate-500'
                                }`}>
                                    {isActive ? <CheckCircle2 size={16} /> : <Clock3 size={16} />}
                                </div>
                                <div className="pt-1 min-w-0">
                                    <p className={`text-sm font-semibold ${isActive ? 'text-white' : 'text-slate-400'}`}>{step.label}</p>
                                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{step.description}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

export default function ProposalTrackingPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [query, setQuery] = useState('');
    const [proposals, setProposals] = useState<ProposalItem[]>([]);
    const [selectedId, setSelectedId] = useState('');
    const [proposal, setProposal] = useState<ProposalItem | null>(null);
    const [comments, setComments] = useState<ProposalComment[]>([]);
    const [message, setMessage] = useState('');
    const [attachment, setAttachment] = useState<File | null>(null);
    const [attachmentError, setAttachmentError] = useState('');
    const [loadingList, setLoadingList] = useState(true);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [loadingComments, setLoadingComments] = useState(false);
    const [posting, setPosting] = useState(false);
    const [error, setError] = useState('');
    const [threadError, setThreadError] = useState('');

    useEffect(() => {
        let cancelled = false;

        const fetchProposalList = async () => {
            setLoadingList(true);
            setError('');

            try {
                const response = await fetch('/api/proposals', { cache: 'no-store' });
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data?.error?.message || data?.error || 'Unable to load proposals.');
                }

                if (cancelled) {
                    return;
                }

                const rows: ProposalItem[] = Array.isArray(data.proposals) ? data.proposals : [];
                setProposals(rows);

                const searchParams = new URLSearchParams(window.location.search);
                const initialId = normalizeProposalId(searchParams.get('id') || '');
                const initialAccessToken = String(searchParams.get('access') || '').trim();
                if (initialId && initialAccessToken) {
                    saveStoredAccessToken(initialId, initialAccessToken);
                }
                const fallbackId = initialId || rows[0]?.proposalId || '';
                setQuery(fallbackId);
                setSelectedId(fallbackId);
            } catch (fetchError: unknown) {
                if (!cancelled) {
                    setError(fetchError instanceof Error ? fetchError.message : 'Unable to load proposals.');
                }
            } finally {
                if (!cancelled) {
                    setLoadingList(false);
                }
            }
        };

        fetchProposalList();

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const loadProposal = async () => {
            if (!selectedId) {
                setProposal(null);
                setComments([]);
                return;
            }

            setLoadingDetail(true);
            setLoadingComments(true);
            setError('');
            setThreadError('');

            try {
                const accessToken = getStoredAccessToken(selectedId);
                const querySuffix = accessToken ? `?access=${encodeURIComponent(accessToken)}` : '';
                const [proposalResponse, commentsResponse] = await Promise.all([
                    fetch(`/api/proposals/${encodeURIComponent(selectedId)}${querySuffix}`, { cache: 'no-store' }),
                    fetch(`/api/proposals/${encodeURIComponent(selectedId)}/comments${querySuffix}`, { cache: 'no-store' }),
                ]);

                const proposalData = await proposalResponse.json();
                const commentsData = await commentsResponse.json();

                if (!proposalResponse.ok) {
                    throw new Error(proposalData?.error?.message || proposalData?.error || 'Unable to load that proposal.');
                }

                if (!cancelled) {
                    setProposal(proposalData.proposal || null);
                    setComments(Array.isArray(commentsData.comments) ? commentsData.comments : []);
                    router.replace(`?id=${encodeURIComponent(selectedId)}`);
                }

                if (!commentsResponse.ok && !cancelled) {
                    setThreadError(commentsData?.error?.message || commentsData?.error || 'Unable to load discussion thread.');
                }
            } catch (loadError: unknown) {
                if (!cancelled) {
                    setProposal(null);
                    setComments([]);
                    setError(loadError instanceof Error ? loadError.message : 'Unable to load that proposal.');
                }
            } finally {
                if (!cancelled) {
                    setLoadingDetail(false);
                    setLoadingComments(false);
                }
            }
        };

        loadProposal();

        return () => {
            cancelled = true;
        };
    }, [router, selectedId]);

    function handleSelectProposal(proposalId: string) {
        const normalized = normalizeProposalId(proposalId);
        setSelectedId(normalized);
        setQuery(normalized);
    }

    function handleAttachmentChange(file: File | null) {
        if (!file) {
            setAttachment(null);
            setAttachmentError('');
            return;
        }

        if (file.size > MAX_ATTACHMENT_BYTES) {
            setAttachment(null);
            setAttachmentError('Attachment must be 10MB or smaller.');
            return;
        }

        const extension = getFileExtension(file.name);
        if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(extension)) {
            setAttachment(null);
            setAttachmentError('Allowed files: PNG, JPG, PDF, DOC, and DOCX.');
            return;
        }

        if (file.type && !ALLOWED_ATTACHMENT_MIME_TYPES.has(file.type)) {
            setAttachment(null);
            setAttachmentError('Unsupported file type for discussion attachment.');
            return;
        }

        setAttachment(file);
        setAttachmentError('');
    }

    async function handleCommentSubmit(event: React.FormEvent) {
        event.preventDefault();
        if (!selectedId || !message.trim() || posting) {
            return;
        }

        if (attachmentError) {
            setThreadError(attachmentError);
            return;
        }

        setPosting(true);
        setThreadError('');

        try {
            const payload = new FormData();
            payload.set('message', message);
            payload.set('trackingToken', getStoredAccessToken(selectedId));
            if (attachment) {
                payload.set('attachment', attachment);
            }

            const response = await fetch(`/api/proposals/${encodeURIComponent(selectedId)}/comments`, {
                method: 'POST',
                body: payload,
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.error?.message || data?.error || 'Unable to post proposal comment.');
            }

            setComments((current) => [...current, data.comment]);
            setMessage('');
            setAttachment(null);
            setAttachmentError('');
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        } catch (submitError: unknown) {
            setThreadError(submitError instanceof Error ? submitError.message : 'Unable to post proposal comment.');
        } finally {
            setPosting(false);
        }
    }

    return (
        <div className="proposal-shell relative overflow-hidden min-h-screen">
            <div className="proposal-noise" aria-hidden="true" />
            <section className="relative z-10 pt-20 pb-12 md:pt-28 md:pb-16">
                <div className="container-main mx-auto w-full max-w-7xl">
                    <Link
                        href="/services/proposals"
                        className="inline-flex items-center gap-2 text-sm font-medium text-slate-200 hover:text-white transition-colors mb-8"
                    >
                        <ArrowLeft size={16} /> Return to Proposal Submission
                    </Link>

                    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-end mb-10">
                        <div>
                            <span className="proposal-eyebrow inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4">
                                <Lightbulb size={14} className="text-amber-300" />
                                Proposal Tracking Hub
                            </span>
                            <h1 className="proposal-display">
                                Follow Every <span className="proposal-display-accent">Official Action</span>
                            </h1>
                            <p className="proposal-lead mt-5 max-w-2xl text-slate-200">
                                Review your proposal history, monitor the status timeline, and continue the feedback loop with the reviewing office from one secure dashboard.
                            </p>
                        </div>

                        <div className="proposal-panel p-5 md:p-6">
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-400 mb-2">Lookup Proposal</p>
                            <form
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    handleSelectProposal(query);
                                }}
                                className="flex flex-col sm:flex-row gap-3"
                            >
                                <div className="flex items-center gap-2 flex-1 rounded-xl border border-white/10 bg-black/20 px-4">
                                    <Search size={16} className="text-slate-400" />
                                    <input
                                        value={query}
                                        onChange={(event) => setQuery(event.target.value)}
                                        placeholder="PROP-00042"
                                        className="w-full h-12 bg-transparent outline-none text-white font-mono text-sm placeholder:text-slate-500"
                                        spellCheck={false}
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={!query.trim() || loadingDetail}
                                    className="rounded-xl bg-amber-400 text-slate-950 font-semibold px-5 py-3 hover:bg-amber-300 disabled:opacity-60 disabled:cursor-not-allowed transition"
                                >
                                    {loadingDetail ? 'Loading...' : 'Open Tracker'}
                                </button>
                            </form>
                        </div>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-[0.84fr_1.16fr]">
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="proposal-card p-5 md:p-6"
                        >
                            <div className="flex items-center justify-between gap-4 mb-5">
                                <div>
                                    <h2 className="text-xl font-semibold text-white">Your Proposal History</h2>
                                    <p className="text-sm text-slate-400 mt-1">Only proposals tied to your signed-in institutional account appear here.</p>
                                </div>
                                {loadingList ? <Loader2 size={18} className="text-slate-300 animate-spin" /> : null}
                            </div>

                            {loadingList ? (
                                <div className="py-10 text-sm text-slate-400">Loading proposal ledger...</div>
                            ) : proposals.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6">
                                    <p className="text-white font-medium">No submitted proposals yet.</p>
                                    <p className="text-sm text-slate-400 mt-2">Once you submit a proposal, its tracker ID and review history will appear here automatically.</p>
                                </div>
                            ) : (
                                <div className="space-y-3 max-h-[68vh] overflow-auto pr-1">
                                    {proposals.map((item) => {
                                        const isActive = selectedId === item.proposalId;
                                        return (
                                            <button
                                                key={item.proposalId}
                                                type="button"
                                                onClick={() => handleSelectProposal(item.proposalId)}
                                                className={`w-full text-left rounded-2xl border p-4 transition ${
                                                    isActive
                                                        ? 'border-amber-300/40 bg-amber-300/10'
                                                        : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-mono text-slate-400 mb-1">{item.proposalId}</p>
                                                        <p className="text-sm md:text-base font-semibold text-white line-clamp-2">{item.title || 'Untitled Proposal'}</p>
                                                    </div>
                                                    <span className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/10 text-slate-200 whitespace-nowrap">
                                                        {item.status}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between gap-3 mt-3 text-xs text-slate-400">
                                                    <span>{item.projectType || 'Project'}</span>
                                                    <span>{formatManilaShortDate(item.submittedAt)}</span>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="space-y-6"
                        >
                            {error ? (
                                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-red-200">
                                    <div className="flex gap-3">
                                        <AlertCircle size={18} className="mt-0.5 shrink-0" />
                                        <div>
                                            <p className="font-semibold">Proposal lookup failed</p>
                                            <p className="text-sm text-red-100/80 mt-1">{error}</p>
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            {!proposal && !error ? (
                                <div className="proposal-card p-8">
                                    <p className="text-white font-medium">Select a proposal to view its tracker.</p>
                                    <p className="text-sm text-slate-400 mt-2">The tracker will show the proposal timeline, attached document, reviewer notes, and the discussion thread.</p>
                                </div>
                            ) : null}

                            {proposal ? (
                                <>
                                    <div className="proposal-card p-6 md:p-7 relative overflow-hidden">
                                        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                                            <ShieldCheck size={108} />
                                        </div>
                                        <div className="relative">
                                            <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                                                <div>
                                                    <p className="text-xs font-mono text-slate-400 mb-1">{proposal.proposalId}</p>
                                                    <h2 className="text-2xl md:text-3xl font-bold text-white leading-tight">{proposal.title}</h2>
                                                    <p className="text-sm text-slate-300 mt-3 max-w-3xl leading-relaxed">{proposal.description}</p>
                                                </div>
                                                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber-300/20 bg-amber-300/10 text-amber-100 text-xs font-semibold">
                                                    <Lightbulb size={14} />
                                                    {proposal.status}
                                                </span>
                                            </div>

                                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 text-sm">
                                                <div className="min-w-0 rounded-xl border border-white/10 bg-black/15 px-4 py-3">
                                                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400 mb-1">Submitted</p>
                                                    <p className="min-w-0 break-words [overflow-wrap:anywhere] text-white font-medium">{formatManilaDateTime(proposal.submittedAt)}</p>
                                                </div>
                                                <div className="min-w-0 rounded-xl border border-white/10 bg-black/15 px-4 py-3">
                                                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400 mb-1">Type</p>
                                                    <p className="min-w-0 break-words [overflow-wrap:anywhere] text-white font-medium">{proposal.projectType || 'N/A'}</p>
                                                </div>
                                                <div className="min-w-0 rounded-xl border border-white/10 bg-black/15 px-4 py-3">
                                                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400 mb-1">Category</p>
                                                    <p className="min-w-0 break-words [overflow-wrap:anywhere] text-white font-medium">{proposal.category || 'Uncategorized'}</p>
                                                </div>
                                                <div className="min-w-0 rounded-xl border border-white/10 bg-black/15 px-4 py-3">
                                                    <p className="text-xs uppercase tracking-[0.12em] text-slate-400 mb-1">Reviewer</p>
                                                    <p className="min-w-0 break-words [overflow-wrap:anywhere] text-white font-medium">{proposal.updatedBy || 'Awaiting assignment'}</p>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-3 mt-5">
                                                {proposal.attachmentUrl ? (
                                                    <a
                                                        href={proposal.attachmentUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-2 rounded-xl border border-sky-300/20 bg-sky-300/10 text-sky-100 px-4 py-2.5 text-sm font-semibold hover:bg-sky-300/15 transition"
                                                    >
                                                        <FileText size={16} />
                                                        Open Submitted Document
                                                    </a>
                                                ) : null}
                                                <button
                                                    type="button"
                                                    onClick={() => handleSelectProposal(proposal.proposalId)}
                                                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 text-white px-4 py-2.5 text-sm font-semibold hover:bg-white/10 transition"
                                                >
                                                    Refresh Proposal
                                                    <ChevronRight size={15} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <Timeline status={proposal.status} />


                                    <div className="proposal-card p-6">
                                        <div className="flex items-center justify-between gap-4 mb-5">
                                            <div>
                                                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                                    <MessageSquare size={16} className="text-amber-200" />
                                                    Feedback Loop
                                                </h3>
                                                <p className="text-xs text-slate-400 mt-1">Official officer responses are labeled below so organizational action is easy to distinguish.</p>
                                            </div>
                                            {loadingComments ? <Loader2 size={18} className="text-slate-300 animate-spin" /> : null}
                                        </div>
                                        {threadError ? (
                                            <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{threadError}</div>
                                        ) : null}

                                        {comments.length === 0 ? (
                                            <p className="text-sm text-slate-400 italic">No discussion entries yet.</p>
                                        ) : (
                                            <div className="space-y-4 mb-6">
                                                {comments.map((comment) => {
                                                    const isOfficial = comment.authorRole === 'OFFICER';
                                                    return (
                                                        <div key={comment.commentId} className={`rounded-2xl border p-4 ${
                                                            isOfficial
                                                                ? 'border-emerald-400/20 bg-emerald-400/10'
                                                                : 'border-white/10 bg-white/5'
                                                        }`}>
                                                            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm font-semibold text-white">
                                                                        {comment.authorName || (isOfficial ? 'OSR Officer' : 'Proposal Submitter')}
                                                                    </span>
                                                                    {isOfficial ? (
                                                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-300/15 border border-emerald-300/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-100">
                                                                            Official Action
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                                <span className="text-xs text-slate-400">{formatManilaDateTime(comment.timestamp)}</span>
                                                            </div>
                                                            <p className="text-sm text-slate-100 whitespace-pre-wrap leading-relaxed">{comment.message}</p>
                                                            {comment.attachmentUrl ? (
                                                                <a
                                                                    href={comment.attachmentUrl}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="inline-flex items-center gap-2 mt-3 text-sm font-medium text-sky-200 hover:text-sky-100"
                                                                >
                                                                    <FileText size={14} />
                                                                    Open attachment
                                                                </a>
                                                            ) : null}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        <form onSubmit={handleCommentSubmit} className="space-y-4">
                                            <div>
                                                <label htmlFor="proposal-comment" className="block text-sm font-medium text-slate-200 mb-2">Add a reply</label>
                                                <textarea
                                                    id="proposal-comment"
                                                    value={message}
                                                    onChange={(event) => setMessage(event.target.value)}
                                                    placeholder="Reply to reviewer notes, clarify scope, or submit your revision response..."
                                                    rows={5}
                                                    className="w-full rounded-2xl border border-white/10 bg-black/20 text-white px-4 py-3 resize-none outline-none focus:ring-2 focus:ring-amber-300/25 focus:border-amber-300/30"
                                                    disabled={posting}
                                                />
                                            </div>

                                            <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-4">
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    className="hidden"
                                                    accept=".png,.jpg,.jpeg,.pdf,.doc,.docx"
                                                    onChange={(event) => handleAttachmentChange(event.target.files?.[0] || null)}
                                                />
                                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-medium text-white">Optional support attachment</p>
                                                        <p className="text-xs text-slate-400 mt-1">PNG, JPG, PDF, DOC, or DOCX. Maximum 10MB.</p>
                                                        {attachment ? (
                                                            <p className="text-xs text-amber-200 mt-2">{attachment.name}</p>
                                                        ) : null}
                                                        {attachmentError ? (
                                                            <p className="text-xs text-red-300 mt-2">{attachmentError}</p>
                                                        ) : null}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => fileInputRef.current?.click()}
                                                            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 text-white px-4 py-2.5 text-sm font-semibold hover:bg-white/10 transition"
                                                        >
                                                            <UploadCloud size={16} />
                                                            Choose File
                                                        </button>
                                                        {attachment ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setAttachment(null);
                                                                    setAttachmentError('');
                                                                    if (fileInputRef.current) {
                                                                        fileInputRef.current.value = '';
                                                                    }
                                                                }}
                                                                className="rounded-xl border border-red-400/20 bg-red-400/10 text-red-100 px-4 py-2.5 text-sm font-semibold hover:bg-red-400/15 transition"
                                                            >
                                                                Remove
                                                            </button>
                                                        ) : null}
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={posting || !message.trim()}
                                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 text-slate-950 font-semibold px-5 py-3 hover:bg-amber-300 disabled:opacity-60 disabled:cursor-not-allowed transition"
                                            >
                                                {posting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                                                {posting ? 'Sending Reply...' : 'Send Reply'}
                                            </button>
                                        </form>
                                    </div>
                                </>
                            ) : null}
                        </motion.div>
                    </div>
                </div>
            </section>
            <NoncedStyle css={`
                .proposal-shell {
                    background: linear-gradient(135deg, #102845 0%, #1c436c 45%, #245f82 100%);
                    background-image:
                        radial-gradient(90% 100% at 8% 12%, rgba(244, 192, 82, 0.18) 0%, rgba(244, 192, 82, 0) 48%),
                        radial-gradient(120% 120% at 92% 12%, rgba(94, 184, 255, 0.18) 0%, rgba(94, 184, 255, 0) 52%),
                        linear-gradient(135deg, #102845 0%, #1c436c 45%, #245f82 100%);
                    color: #e2e8f0;
                }

                .proposal-shell::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(circle at top, rgba(255,255,255,0.03) 0%, transparent 100%);
                    pointer-events: none;
                    z-index: 1;
                }

                .proposal-noise {
                    position: absolute;
                    inset: 0;
                    background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px);
                    background-size: 30px 30px;
                    opacity: 0.2;
                    mask-image: linear-gradient(to bottom, black 55%, transparent 100%);
                    pointer-events: none;
                    z-index: 2;
                }

                .proposal-eyebrow {
                    background: rgba(244, 192, 82, 0.12);
                    border: 1px solid rgba(244, 192, 82, 0.2);
                    color: #fde68a;
                    font-size: 0.8rem;
                    font-weight: 600;
                    backdrop-filter: blur(8px);
                }

                .proposal-display {
                    font-size: clamp(2.3rem, 5vw, 4.4rem);
                    line-height: 1.05;
                    color: #ffffff;
                    max-width: 14ch;
                    font-weight: 700;
                    text-wrap: balance;
                }

                .proposal-display-accent {
                    color: transparent;
                    background: linear-gradient(135deg, #fde68a 0%, #f59e0b 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .proposal-lead {
                    font-size: clamp(1rem, 1.1vw + 0.5rem, 1.15rem);
                    line-height: 1.7;
                }

                .proposal-card,
                .proposal-panel {
                    position: relative;
                    border-radius: 1.5rem;
                    background: linear-gradient(145deg, rgba(12, 22, 36, 0.42), rgba(11, 20, 34, 0.62));
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    box-shadow: 0 20px 50px rgba(4, 10, 22, 0.26);
                    backdrop-filter: blur(18px);
                    -webkit-backdrop-filter: blur(18px);
                }
            `} />
        </div>
    );
}
