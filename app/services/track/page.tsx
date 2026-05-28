'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeft,
    AlertTriangle,
    BookOpen,
    Loader2,
    MessageSquare,
    Search,
    Send,
    Ticket,
    UploadCloud,
    XCircle,
} from 'lucide-react';
import { formatManilaDateTime, formatManilaShortDate } from '@/lib/date-time';
import type { TicketStatus } from '@/lib/ticket-constants';
import { TrackActionWorkspace } from '@/components/track/TrackActionWorkspace';
import { TrackCaseDetails } from '@/components/track/TrackCaseDetails';
import { TrackCaseSummary } from '@/components/track/TrackCaseSummary';
import { TrackEntryRail } from '@/components/track/TrackEntryRail';
import { TrackProgressPanel } from '@/components/track/TrackProgressPanel';
import { TrackRedactedShell } from '@/components/track/TrackRedactedShell';
import type { StoredTicket, TrackStep, TrackTicket } from '@/components/track/types';

const STORAGE_KEY = 'osr_submitted_tickets';
const ACCESS_TOKEN_STORAGE_KEY = 'osr_ticket_access_tokens';
const FAKE_TICKET_ID = 'TKT-0000-FAKE';

const MAX_FOLLOW_UP_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const FOLLOW_UP_ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.pdf', '.doc', '.docx']);
const FOLLOW_UP_ALLOWED_MIME_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const STEPS: TrackStep[] = [
    {
        label: 'Ticket received',
        description: 'Your grievance was received and securely logged in the system.',
        activeFor: ['Open', 'In Progress', 'Resolved', 'Closed', 'Appealed'],
    },
    {
        label: 'Under review',
        description: 'The Student Regent is actively reviewing or coordinating a resolution for your concern.',
        activeFor: ['In Progress', 'Resolved', 'Closed', 'Appealed'],
    },
    {
        label: 'Resolved or waiting for closure',
        description: 'A resolution has been issued or the case is now waiting for final closure and any follow-up.',
        activeFor: ['Resolved', 'Closed', 'Appealed'],
    },
    {
        label: 'Appeal submitted',
        description: 'A formal appeal or follow-up reply is now part of the official discussion thread.',
        activeFor: ['Appealed'],
    },
];

interface ServerTicketListItem {
    ticketId: string;
    submittedAt: string;
    category: string;
    subject: string;
}

function getFileExtension(fileName: string): string {
    const lowered = fileName.toLowerCase();
    return lowered.includes('.') ? lowered.slice(lowered.lastIndexOf('.')) : '';
}

function normalizeStatus(raw: string): TicketStatus {
    const normalized = raw.replace(/^[\p{Emoji}\s]+/u, '').trim().toLowerCase();
    if (normalized === 'open') return 'Open';
    if (normalized === 'in progress' || normalized === 'under review' || normalized === 'in-progress') return 'In Progress';
    if (normalized === 'resolved' || normalized === 'done') return 'Resolved';
    if (normalized === 'closed') return 'Closed';
    if (normalized === 'appealed' || normalized === 'appeal submitted') return 'Appealed';
    return 'Open';
}

function formatSubmittedDate(value: string | undefined): string {
    return formatManilaDateTime(value);
}

function formatShortSubmittedDate(value: string | undefined): string {
    return formatManilaShortDate(value);
}

function loadStoredTickets(): StoredTicket[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as StoredTicket[]) : [];
        const sanitized = parsed.filter((ticket) => ticket.id.toUpperCase() !== FAKE_TICKET_ID);
        if (sanitized.length !== parsed.length) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
        }
        return sanitized;
    } catch {
        return [];
    }
}

function loadStoredAccessTokens(): Record<string, string> {
    try {
        const raw = sessionStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
        return raw ? (JSON.parse(raw) as Record<string, string>) : {};
    } catch {
        return {};
    }
}

function saveStoredAccessToken(ticketId: string, accessToken: string): void {
    const normalizedTicketId = ticketId.trim().toUpperCase();
    const normalizedToken = accessToken.trim();
    if (!normalizedTicketId || !normalizedToken) return;

    try {
        const existing = loadStoredAccessTokens();
        existing[normalizedTicketId] = normalizedToken;
        sessionStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, JSON.stringify(existing));
    } catch {
        // session storage unavailable
    }
}

function getStoredAccessToken(ticketId: string): string {
    const normalizedTicketId = ticketId.trim().toUpperCase();
    if (!normalizedTicketId) return '';
    const tokens = loadStoredAccessTokens();
    return tokens[normalizedTicketId] || '';
}

function mergeTicketHistory(serverTickets: StoredTicket[], localTickets: StoredTicket[]): StoredTicket[] {
    const merged = new Map<string, StoredTicket>();

    for (const ticket of [...serverTickets, ...localTickets]) {
        const normalizedId = String(ticket.id || '').trim().toUpperCase();
        if (!normalizedId || normalizedId === FAKE_TICKET_ID) {
            continue;
        }

        if (!merged.has(normalizedId)) {
            merged.set(normalizedId, {
                id: normalizedId,
                submittedAt: ticket.submittedAt || '',
                category: ticket.category || '',
                subject: ticket.subject || '',
            });
        }
    }

    return Array.from(merged.values()).slice(0, 25);
}

function getLatestOfficialUpdate(ticket: TrackTicket): string {
    if (ticket.resolutionNotes?.trim()) {
        return ticket.resolutionNotes.trim();
    }

    switch (ticket.status) {
        case 'Open':
            return 'Your grievance has been received and queued for intake review.';
        case 'In Progress':
            return 'An OSR officer is actively reviewing the concern or coordinating the next resolution step.';
        case 'Resolved':
            return 'A resolution has been recorded. Review the case details and thread for the latest context.';
        case 'Closed':
            return 'The case has been closed. If the outcome needs to be revisited, use the follow-up workspace to submit an appeal.';
        case 'Appealed':
            return 'A formal appeal has been submitted and is now part of the official discussion thread.';
        default:
            return 'The case record has been updated.';
    }
}

function getNextStepGuidance(ticket: TrackTicket): string {
    switch (ticket.status) {
        case 'Open':
            return 'Keep the ticket ID handy. The next visible change usually happens when OSR starts active review.';
        case 'In Progress':
            return 'Wait for the latest official response or add a focused follow-up only if new details materially change the case.';
        case 'Resolved':
            return 'Review the resolution notes first. If something important is missing, you can send a follow-up or formal appeal.';
        case 'Closed':
            return 'Closed cases stay on record. Use the action workspace only if you need to contest the outcome with new supporting context.';
        case 'Appealed':
            return 'Your appeal is already in motion. Add supporting files only when they strengthen the record instead of repeating earlier points.';
        default:
            return 'Keep monitoring the ticket here for official updates.';
    }
}

export function saveTicketToHistory(ticket: StoredTicket, accessToken?: string) {
    try {
        if (ticket.id.toUpperCase() === FAKE_TICKET_ID) return;
        if (accessToken) {
            saveStoredAccessToken(ticket.id, accessToken);
        }

        const existing = loadStoredTickets();
        if (existing.some((current) => current.id === ticket.id)) return;
        const updated = [ticket, ...existing].slice(0, 10);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
        // local storage unavailable
    }
}

function FollowUpThread({ ticketId, detailsRedacted }: { ticketId: string; detailsRedacted: boolean }) {
    const [comments, setComments] = useState<Array<{
        commentId?: string;
        timestamp: string;
        author: string;
        authorRole?: string;
        message: string;
        attachmentUrl?: string;
        isAppeal?: boolean;
    }>>([]);
    const [loading, setLoading] = useState(true);
    const [posting, setPosting] = useState(false);
    const [message, setMessage] = useState('');
    const [isAppeal, setIsAppeal] = useState(false);
    const [attachment, setAttachment] = useState<File | null>(null);
    const [attachmentError, setAttachmentError] = useState<string | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (detailsRedacted) {
            setLoading(false);
            return;
        }

        let mounted = true;
        const fetchComments = async () => {
            try {
                const trackingToken = getStoredAccessToken(ticketId);
                const query = trackingToken ? `?access=${encodeURIComponent(trackingToken)}` : '';
                const response = await fetch(`/api/tickets/${ticketId}/comments${query}`, { cache: 'no-store' });
                const data = await response.json();
                if (mounted && response.ok) {
                    setComments(data.comments || []);
                }
            } catch {
                // ignore load errors for thread shell
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchComments();
        return () => {
            mounted = false;
        };
    }, [ticketId, detailsRedacted]);

    const handleAttachmentChange = (file: File | null) => {
        if (!file) {
            setAttachment(null);
            setAttachmentError(null);
            return;
        }

        if (file.size > MAX_FOLLOW_UP_ATTACHMENT_BYTES) {
            setAttachment(null);
            setAttachmentError('Follow-up document must be 10MB or smaller.');
            return;
        }

        const extension = getFileExtension(file.name);
        if (!FOLLOW_UP_ALLOWED_EXTENSIONS.has(extension)) {
            setAttachment(null);
            setAttachmentError('Allowed file extensions: .png, .jpg, .jpeg, .pdf, .doc, .docx');
            return;
        }

        if (file.type && !FOLLOW_UP_ALLOWED_MIME_TYPES.has(file.type)) {
            setAttachment(null);
            setAttachmentError('Unsupported file type. Please upload PNG, JPG, PDF, DOC, or DOCX files only.');
            return;
        }

        setAttachment(file);
        setAttachmentError(null);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!message.trim() || posting || detailsRedacted) return;

        if (attachmentError) {
            setError(attachmentError);
            return;
        }

        if (!attachment) {
            const proceed = window.confirm(
                'You are submitting this follow-up without supporting documents. This is allowed, but evidence improves appeal review quality and turnaround. Do you want to continue?'
            );
            if (!proceed) {
                return;
            }
        }

        setPosting(true);
        setError('');

        try {
            const trackingToken = getStoredAccessToken(ticketId);
            const payload = new FormData();
            payload.set('message', message);
            payload.set('trackingToken', trackingToken);
            payload.set('isAppeal', String(isAppeal));
            if (attachment) {
                payload.set('attachment', attachment);
            }

            const response = await fetch(`/api/tickets/${ticketId}/comments`, {
                method: 'POST',
                body: payload,
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to post follow-up reply');
            }

            setComments((current) => [...current, data.comment]);
            setMessage('');
            setIsAppeal(false);
            setAttachment(null);
            setAttachmentError(null);
        } catch (submissionError: unknown) {
            setError(submissionError instanceof Error ? submissionError.message : 'Failed to post follow-up reply');
        } finally {
            setPosting(false);
        }
    };

    if (detailsRedacted) {
        return null;
    }

    return (
        <div className="space-y-5">
            <div className="rounded-xl border border-[rgba(35,72,116,0.14)] bg-white p-4">
                <div className="flex items-center gap-2">
                    <MessageSquare size={16} className="text-subtle" />
                    <p className="text-sm font-semibold text-strong">Thread history</p>
                </div>

                <div className="mt-4 overflow-hidden rounded-xl border border-[rgba(35,72,116,0.14)] bg-white">
                    {loading ? (
                        <div className="flex items-center gap-2 text-sm text-subtle">
                            <Loader2 className="animate-spin" size={14} />
                            Loading discussion...
                        </div>
                    ) : comments.length === 0 ? (
                        <p className="text-sm italic text-subtle">No comments or appeals yet.</p>
                    ) : (
                        comments.map((comment, index) => (
                            <div key={comment.commentId || index} className="border-b border-[rgba(35,72,116,0.1)] p-4 last:border-b-0">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold text-strong">{comment.author}</span>
                                        {comment.authorRole === 'OFFICER' ? (
                                            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                                Official action
                                            </span>
                                        ) : null}
                                        {comment.isAppeal ? (
                                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                                Formal appeal
                                            </span>
                                        ) : null}
                                    </div>
                                    <span className="text-xs text-subtle">{formatSubmittedDate(comment.timestamp)}</span>
                                </div>
                                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-body">{comment.message}</p>
                                {comment.attachmentUrl ? (
                                    <a
                                        href={comment.attachmentUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="mt-3 inline-flex text-xs font-medium text-brand hover:underline"
                                    >
                                        View follow-up document
                                    </a>
                                ) : null}
                            </div>
                        ))
                    )}
                </div>
            </div>

            <form onSubmit={handleSubmit} className="rounded-xl border border-[rgba(35,72,116,0.14)] bg-white p-4">
                <div className="mb-4">
                    <p className="text-sm font-semibold text-strong">Send a follow-up or formal appeal</p>
                    <p className="mt-1 text-sm text-subtle">
                        Keep replies factual and specific. Use the appeal toggle only when you want to formally contest the current outcome.
                    </p>
                </div>

                {error ? <p className="mb-3 text-xs text-red-600">{error}</p> : null}

                <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Write your follow-up update, clarification, or appeal message..."
                    className="min-h-[120px] w-full rounded-2xl border border-soft bg-surface-soft p-3 text-sm text-strong outline-none transition-all focus:border-[color:var(--accent-secondary)] focus:ring-2 focus:ring-[rgba(203,165,77,0.16)]"
                    disabled={posting}
                />

                <label className="mt-4 flex items-center gap-3 text-sm text-body">
                    <input
                        type="checkbox"
                        checked={isAppeal}
                        onChange={(event) => setIsAppeal(event.target.checked)}
                        className="h-4 w-4"
                        disabled={posting}
                    />
                    Submit this reply as a formal appeal
                </label>

                <div className="mt-4 rounded-xl border border-[rgba(35,72,116,0.14)] bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-subtle">
                        Optional attachment
                    </p>
                    <input
                        id="track-follow-up-attachment"
                        type="file"
                        accept=".png,.jpg,.jpeg,.pdf,.doc,.docx,image/png,image/jpeg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        disabled={posting}
                        onChange={(event) => handleAttachmentChange(event.target.files?.[0] || null)}
                        className="sr-only"
                    />
                    <label
                        htmlFor="track-follow-up-attachment"
                        className="mt-3 flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[rgba(35,72,116,0.2)] bg-[rgba(35,72,116,0.04)] px-4 text-sm text-strong"
                    >
                        <UploadCloud size={15} />
                        <span>{attachment ? 'Replace selected file' : 'Attach supporting document'}</span>
                    </label>

                    <p className="mt-2 text-[11px] text-subtle">Allowed: PNG, JPG, PDF, DOC, DOCX. Maximum 10MB.</p>
                    {attachmentError ? <p className="mt-1 text-[11px] text-red-600">{attachmentError}</p> : null}
                    {attachment && !attachmentError ? <p className="mt-1 text-[11px] text-green-700">Selected: {attachment.name}</p> : null}
                    {!attachment && !attachmentError ? (
                        <div className="mt-3 rounded-xl border border-[rgba(203,165,77,0.24)] bg-[rgba(203,165,77,0.08)] px-3 py-2">
                            <p className="inline-flex items-start gap-2 text-[11px] leading-relaxed text-body">
                                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                                You may continue without proof, but supporting documents make appeals easier to evaluate and faster to resolve.
                            </p>
                        </div>
                    ) : null}
                </div>

                <div className="mt-4 flex justify-end">
                    <button
                        type="submit"
                        disabled={posting || !message.trim()}
                        className="btn-primary px-5 py-2 text-sm"
                    >
                        <span className="inline-flex items-center gap-2">
                            {posting ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                            {posting ? 'Posting...' : 'Post reply'}
                        </span>
                    </button>
                </div>
            </form>
        </div>
    );
}

function TrackContent() {
    const { status: authStatus } = useSession();
    const searchParams = useSearchParams();
    const router = useRouter();
    const initialId = searchParams?.get('id') || '';
    const initialAccess = searchParams?.get('access') || '';

    const [ticketId, setTicketId] = useState(initialId);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [history, setHistory] = useState<StoredTicket[]>([]);
    const [ticket, setTicket] = useState<TrackTicket | null>(null);

    useEffect(() => {
        setHistory(loadStoredTickets());
    }, []);

    useEffect(() => {
        if (authStatus !== 'authenticated') return;

        let cancelled = false;
        const loadServerHistory = async () => {
            try {
                const response = await fetch('/api/tickets/mine', { cache: 'no-store' });
                if (!response.ok) return;

                const data = await response.json();
                const serverTickets = ((data?.tickets || []) as ServerTicketListItem[]).map((item) => ({
                    id: String(item.ticketId || '').trim().toUpperCase(),
                    submittedAt: String(item.submittedAt || '').trim(),
                    category: String(item.category || '').trim(),
                    subject: String(item.subject || '').trim(),
                }));

                if (!cancelled) {
                    setHistory((current) => mergeTicketHistory(serverTickets, current));
                }
            } catch {
                // keep local history when server history fails
            }
        };

        loadServerHistory();
        return () => {
            cancelled = true;
        };
    }, [authStatus]);

    const handleSearch = useCallback(async (searchId: string, providedAccessToken = '') => {
        const normalized = searchId.trim().toUpperCase();
        const id = normalized.startsWith('TKT-') ? normalized : `TKT-${normalized}`;
        const token = providedAccessToken.trim() || getStoredAccessToken(id);
        if (!id || id === 'TKT-') return;

        if (token) {
            saveStoredAccessToken(id, token);
        }

        setLoading(true);
        setError(null);
        setTicket(null);

        const query = new URLSearchParams({ id });
        if (token) {
            query.set('access', token);
        }
        router.replace(`?${query.toString()}`);

        try {
            const responseQuery = token ? `?access=${encodeURIComponent(token)}` : '';
            const response = await fetch(`/api/tickets/${encodeURIComponent(id)}${responseQuery}`, { cache: 'no-store' });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error?.message || 'Failed to locate ticket');
            }

            const rawStatus = data.ticket?.status || 'Open';
            setTicket({
                ticketId: data.ticket?.ticketId || id,
                status: normalizeStatus(rawStatus),
                submittedAt: data.ticket?.submittedAt || '',
                detailsRedacted: Boolean(data.ticket?.detailsRedacted),
                studentId: data.ticket?.studentId || '',
                campus: data.ticket?.campus || '',
                college: data.ticket?.college || '',
                category: data.ticket?.category || '',
                subject: data.ticket?.subject || '',
                complaintNarrative: data.ticket?.complaintNarrative || '',
                attachmentUrl: data.ticket?.attachmentUrl || '',
                resolutionNotes: data.ticket?.resolutionNotes || '',
            });

            setTicketId('');
        } catch (lookupError: unknown) {
            setError(lookupError instanceof Error ? lookupError.message : 'An error occurred while tracking this ticket.');
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        if (initialId) {
            handleSearch(initialId, initialAccess);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const ownerView = Boolean(ticket && !ticket.detailsRedacted);
    const redactedView = Boolean(ticket && ticket.detailsRedacted);

    return (
        <div className="container-main max-w-6xl pb-24">
            <div className="mb-8">
                <Link href="/services" className="group inline-flex items-center gap-2 text-sm text-subtle transition-colors hover:text-body">
                    <ArrowLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
                    Back to Services
                </Link>
            </div>

            {!ticket && !error ? (
                <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
                    <div className="relative overflow-hidden rounded-2xl border border-[rgba(35,72,116,0.18)] bg-[linear-gradient(145deg,rgba(255,255,255,0.96),rgba(242,247,252,0.9))] p-5 shadow-[0_16px_36px_-26px_rgba(16,35,59,0.5)]">
                        <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[rgba(125,211,252,0.22)] blur-2xl" />
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand/75">
                            How this works
                        </p>
                        <h2 className="mt-1 text-xl font-semibold tracking-tight text-strong">A layered case workspace for grievance tracking</h2>
                        <p className="mt-2 text-sm leading-relaxed text-subtle">
                            Signed-in students see their own case history first. Manual lookup stays available at all times for ticket IDs and access tokens, and any result that is not verified for ownership remains in a privacy-protected shell.
                        </p>
                    </div>

                    <div className="rounded-2xl border border-[rgba(203,165,77,0.24)] bg-[linear-gradient(160deg,rgba(203,165,77,0.14),rgba(255,255,255,0.95))] p-5 shadow-[0_14px_32px_-28px_rgba(120,82,18,0.55)]">
                        <div className="flex items-center gap-2">
                            <BookOpen size={16} className="text-[var(--rtu-gold-dark)]" />
                            <p className="text-sm font-semibold text-strong">Before you search</p>
                        </div>
                        <ul className="mt-3 space-y-2 text-sm leading-relaxed text-subtle">
                            <li>Use the exact ticket ID from your confirmation email.</li>
                            <li>Sign in to load My cases automatically.</li>
                            <li>Use the follow-up workspace only for meaningful updates or a formal appeal.</li>
                        </ul>
                    </div>
                </div>
            ) : null}

            <div className="sticky top-20 z-10 mb-6">
                <TrackEntryRail
                    compact={Boolean(ticket || error)}
                    loading={loading}
                    ticketId={ticketId}
                    history={history}
                    authStatus={authStatus}
                    activeStatus={ticket?.status}
                    onTicketIdChange={setTicketId}
                    onSubmit={() => handleSearch(ticketId)}
                    onSelectHistory={(value) => handleSearch(value, getStoredAccessToken(value))}
                    formatShortDate={formatShortSubmittedDate}
                />
            </div>

            <AnimatePresence mode="wait">
                {error && !loading ? (
                    <motion.section
                        key="no-result"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        className="rounded-2xl border border-[rgba(220,38,38,0.18)] bg-[linear-gradient(180deg,rgba(220,38,38,0.07),rgba(255,255,255,0.98))] p-6 shadow-[0_18px_42px_-34px_rgba(127,29,29,0.45)]"
                    >
                        <div className="flex gap-4">
                            <XCircle className="mt-0.5 shrink-0 text-red-500" size={20} />
                            <div>
                                <h3 className="text-lg font-semibold tracking-tight text-strong">We couldn&apos;t find that ticket</h3>
                                <p className="mt-2 text-sm text-body">{error}</p>
                                <p className="mt-4 border-t border-[rgba(220,38,38,0.12)] pt-4 text-sm text-subtle">
                                    Double-check the exact ID from your confirmation email. Newly submitted tickets may take a few moments to appear, and protected tickets may also require the access token that came with the confirmation link.
                                </p>
                            </div>
                        </div>
                    </motion.section>
                ) : null}

                {ticket && !loading ? (
                    <motion.div
                        key={`ticket-${ticket.ticketId}`}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.9fr)]"
                    >
                        <div className="space-y-6">
                            <TrackCaseSummary
                                ticketId={ticket.ticketId}
                                title={ticket.detailsRedacted ? 'Ticket status workspace' : (ticket.subject || `${ticket.category} grievance`)}
                                status={ticket.status}
                                submittedAtLabel={formatSubmittedDate(ticket.submittedAt)}
                                submittedAtShort={formatShortSubmittedDate(ticket.submittedAt)}
                                latestOfficialUpdate={getLatestOfficialUpdate(ticket)}
                                nextStepGuidance={getNextStepGuidance(ticket)}
                                isOwnerView={ownerView}
                                category={ticket.detailsRedacted ? '' : ticket.category}
                            />

                            {redactedView ? (
                                <TrackRedactedShell
                                    ticketId={ticket.ticketId}
                                    status={ticket.status}
                                    submittedAtLabel={formatSubmittedDate(ticket.submittedAt)}
                                />
                            ) : (
                                <>
                                    <TrackProgressPanel
                                        status={ticket.status}
                                        steps={STEPS}
                                        resolutionNotes={ticket.resolutionNotes}
                                    />
                                    <TrackCaseDetails ticket={ticket} />
                                </>
                            )}
                        </div>

                        <div className="space-y-6">
                            <TrackActionWorkspace actionAllowed={ownerView}>
                                <FollowUpThread ticketId={ticket.ticketId} detailsRedacted={ticket.detailsRedacted} />
                            </TrackActionWorkspace>
                        </div>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </div>
    );
}

export default function TrackPage() {
    return (
        <>
            <section className="page-header relative overflow-hidden bg-[linear-gradient(165deg,#10233b_0%,#173455_46%,#22456d_100%)] text-slate-100">
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_8%_12%,rgba(247,217,150,0.24),transparent_52%),radial-gradient(120%_120%_at_92%_10%,rgba(125,211,252,0.22),transparent_58%)]" />
                <div className="container-main relative grid items-end gap-8 py-3 lg:grid-cols-[minmax(0,1.12fr)_minmax(280px,0.88fr)] lg:py-6">
                    <div>
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-100">
                            <Ticket size={12} />
                            Case workspace
                        </div>
                        <h1 className="page-header-title mb-3 font-bold text-white">
                            Track Your <span className="text-gradient-gold">Grievance</span>
                        </h1>
                        <p className="max-w-2xl text-base leading-relaxed text-slate-200">
                            Review case status, open your owner workspace, and keep follow-up actions separate from the official record so the whole process stays clearer and more privacy-safe.
                        </p>
                    </div>
                    <div className="rounded-2xl border border-white/15 bg-white/[0.07] p-4 backdrop-blur-sm">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-sky-100/80">Workspace principles</p>
                        <ul className="mt-3 space-y-2 text-sm text-slate-100/90">
                            <li>Owner-first case context when signed in</li>
                            <li>Manual lookup always available</li>
                            <li>Protected records stay privacy-redacted</li>
                        </ul>
                    </div>
                </div>
            </section>

            <section className="section-tight bg-surface-base">
                <Suspense
                    fallback={
                        <div className="container-main flex max-w-6xl justify-center py-16">
                            <Loader2 className="animate-spin text-subtle" size={24} />
                        </div>
                    }
                >
                    <TrackContent />
                </Suspense>
            </section>
        </>
    );
}
