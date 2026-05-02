'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { formatManilaDateTime, formatManilaShortDate } from '@/lib/date-time';
import {
    Search, Loader2, ArrowLeft, FileText,
    Clock, ShieldCheck, CheckCircle2, XCircle,
    Ticket, ChevronRight, BookOpen, MessageSquare, Send, UploadCloud, AlertTriangle
} from 'lucide-react';
import type { TicketStatus } from '@/lib/ticket-constants';

const MAX_FOLLOW_UP_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const FOLLOW_UP_ALLOWED_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.pdf', '.doc', '.docx']);
const FOLLOW_UP_ALLOWED_MIME_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function getFileExtension(fileName: string): string {
    const lowered = fileName.toLowerCase();
    return lowered.includes('.') ? lowered.slice(lowered.lastIndexOf('.')) : '';
}

// ── Status normalizer ──────────────────────────────────────────────────────────
// The Google Sheet might have emoji prefixes ("🔵 In Progress"), custom aliases
// ("Under Review"), or extra whitespace. This maps all variations to our canonical enum.
function normalizeStatus(raw: string): TicketStatus {
    const s = raw.replace(/^[\p{Emoji}\s]+/u, '').trim().toLowerCase();
    if (s === 'open') return 'Open';
    if (s === 'in progress' || s === 'under review' || s === 'in-progress') return 'In Progress';
    if (s === 'resolved' || s === 'closed' || s === 'done') return 'Resolved';
    if (s === 'closed') return 'Closed';
    if (s === 'appealed' || s === 'appeal submitted') return 'Appealed';
    return 'Open'; // safe default
}

// ── Safari-safe date parser ────────────────────────────────────────────────────
// "2026-04-02 17:47:12 PHT" -> valid browser Date object
function formatSubmittedDate(dStr: string | undefined): string {
    return formatManilaDateTime(dStr);
}

function formatShortSubmittedDate(dStr: string | undefined): string {
    return formatManilaShortDate(dStr);
}

// ── localStorage helpers ───────────────────────────────────────────────────────
const STORAGE_KEY = 'osr_submitted_tickets';
const ACCESS_TOKEN_STORAGE_KEY = 'osr_ticket_access_tokens';

interface StoredTicket {
    id: string;
    submittedAt: string; // ISO string
    category: string;
    subject: string;
}

interface ServerTicketListItem {
    ticketId: string;
    submittedAt: string;
    category: string;
    subject: string;
}

const FAKE_TICKET_ID = 'TKT-0000-FAKE';

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
        // sessionStorage unavailable
    }
}

function getStoredAccessToken(ticketId: string): string {
    const normalizedTicketId = ticketId.trim().toUpperCase();
    if (!normalizedTicketId) return '';
    const tokens = loadStoredAccessTokens();
    return tokens[normalizedTicketId] || '';
}

export function saveTicketToHistory(ticket: StoredTicket, accessToken?: string) {
    try {
        if (ticket.id.toUpperCase() === FAKE_TICKET_ID) return;
        if (accessToken) {
            saveStoredAccessToken(ticket.id, accessToken);
        }

        const existing = loadStoredTickets();
        // Avoid duplicates
        if (existing.some(t => t.id === ticket.id)) return;
        const updated = [ticket, ...existing].slice(0, 10); // Keep last 10
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {/* localStorage unavailable */ }
}

// ── Status helpers ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        'Open': 'bg-amber-100 text-amber-800 border-amber-200',
        'In Progress': 'bg-blue-100 text-blue-800 border-blue-200',
        'Resolved': 'bg-green-100 text-green-800 border-green-200',
        'Closed': 'bg-neutral-100 text-neutral-600 border-neutral-200',
        'Appealed': 'bg-orange-100 text-orange-800 border-orange-200',
    };
    const dot: Record<string, string> = {
        'Open': 'bg-amber-500',
        'In Progress': 'bg-blue-500',
        'Resolved': 'bg-green-500',
        'Closed': 'bg-neutral-400',
        'Appealed': 'bg-orange-500',
    };
    const cls = map[status] ?? 'bg-neutral-100 text-neutral-600 border-neutral-200';
    const dotCls = dot[status] ?? 'bg-neutral-400';
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${cls}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dotCls}`} />
            {status}
        </span>
    );
}

// ── Timeline steps ─────────────────────────────────────────────────────────────
const STEPS: Array<{
    label: string;
    description: string;
    activeFor: TicketStatus[];
}> = [
        {
            label: 'Ticket Received',
            description: 'Your grievance was received and securely logged in the system.',
            activeFor: ['Open', 'In Progress', 'Resolved', 'Closed'],
        },
        {
            label: 'Under Review',
            description: 'The Student Regent is actively reviewing or coordinating a resolution for your concern.',
            activeFor: ['In Progress', 'Resolved', 'Closed'],
        },
        {
            label: 'Resolved',
            description: 'The grievance has been addressed. Check the resolution notes below.',
            activeFor: ['Resolved', 'Closed'],
        },
        {
            label: 'Appeal Submitted',
            description: 'A formal appeal was filed with optional follow-up documents for re-evaluation.',
            activeFor: ['Appealed'],
        },
    ];

// ── Appeals component ────────────────────────────────────────────────────────
function AppealsThread({ ticketId, detailsRedacted }: { ticketId: string; detailsRedacted: boolean }) {
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

    useEffect(() => {
        let mounted = true;
        const fetchComments = async () => {
            try {
                const trackingToken = getStoredAccessToken(ticketId);
                const query = trackingToken ? `?access=${encodeURIComponent(trackingToken)}` : '';
                const res = await fetch(`/api/tickets/${ticketId}/comments${query}`, { cache: 'no-store' });
                const data = await res.json();
                if (mounted && res.ok) {
                    setComments(data.comments || []);
                }
            } catch {
                // Ignore load errors for now
            } finally {
                if (mounted) setLoading(false);
            }
        };
        fetchComments();
        return () => { mounted = false; };
    }, [ticketId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || posting) return;

        if (attachmentError) {
            setError(attachmentError);
            return;
        }

        if (!attachment) {
            const proceedWithoutDocument = window.confirm(
                'You are submitting this follow-up without supporting documents. This is allowed, but evidence improves appeal review quality and turnaround. Do you want to continue?'
            );
            if (!proceedWithoutDocument) {
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

            const res = await fetch(`/api/tickets/${ticketId}/comments`, {
                method: 'POST',
                body: payload,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to post appeal');

            setComments(prev => [...prev, data.comment]);
            setMessage('');
            setIsAppeal(false);
            setAttachment(null);
            setAttachmentError(null);
        } catch (err: unknown) {
            const messageFromError = err instanceof Error ? err.message : 'Failed to post follow-up reply';
            setError(messageFromError);
        } finally {
            setPosting(false);
        }
    };

    if (detailsRedacted) return null;

    return (
        <div className="card p-6 mt-6">
            <h3 className="text-sm font-semibold text-body mb-4 flex items-center gap-2">
                <MessageSquare size={16} className="text-subtle" />
                Appeals & Discussion
            </h3>
            
            <div className="space-y-4 mb-6">
                {loading ? (
                    <div className="flex items-center gap-2 text-subtle text-sm">
                        <Loader2 className="animate-spin" size={14} /> Loading thread...
                    </div>
                ) : comments.length === 0 ? (
                    <p className="text-sm text-subtle italic">No comments or appeals yet.</p>
                ) : (
                    comments.map((c, i) => (
                        <div key={c.commentId || i} className="bg-surface-muted/40 p-4 rounded-xl border border-soft">
                            <div className="flex items-center justify-between gap-4 mb-2">
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-sm text-body">{c.author}</span>
                                    {c.authorRole === 'OFFICER' && (
                                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                            Official Action
                                        </span>
                                    )}
                                </div>
                                <span className="text-xs text-subtle">{formatSubmittedDate(c.timestamp)}</span>
                            </div>
                            {c.isAppeal && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 mb-2">
                                    Formal Appeal
                                </span>
                            )}
                            <p className="text-sm text-body whitespace-pre-wrap">{c.message}</p>
                            {c.attachmentUrl && (
                                <div className="mt-2">
                                    <a
                                        href={c.attachmentUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs font-medium text-brand hover:underline"
                                    >
                                        View Follow-up Document
                                    </a>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            <form onSubmit={handleSubmit} className="relative space-y-3">
                {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
                <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write your appeal or reply..."
                    className="w-full min-h-[100px] p-3 text-sm bg-surface rounded-xl border border-soft focus:border-rtu-gold focus:ring-2 focus:ring-rtu-gold/20 outline-none resize-y transition-all"
                    disabled={posting}
                />

                <label className="flex items-center gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={isAppeal}
                        onChange={(e) => setIsAppeal(e.target.checked)}
                        className="h-4 w-4"
                        disabled={posting}
                    />
                    <span className="text-sm text-body font-medium">Submit this as a formal appeal</span>
                </label>

                <div className="rounded-xl border border-soft p-3 bg-surface-muted/30">
                    <p className="text-xs font-medium text-body mb-2">Follow-up Documents (Optional)</p>
                    <input
                        id="appeal-follow-up-attachment"
                        type="file"
                        accept=".png,.jpg,.jpeg,.pdf,.doc,.docx,image/png,image/jpeg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        disabled={posting}
                        onChange={(e) => handleAttachmentChange(e.target.files?.[0] || null)}
                        className="sr-only"
                    />
                    <label
                        htmlFor="appeal-follow-up-attachment"
                        className="field-input text-sm min-h-[42px] flex items-center justify-center gap-2 cursor-pointer border-dashed"
                    >
                        <UploadCloud size={15} />
                        <span>{attachment ? 'Replace selected file' : 'Attach follow-up document'}</span>
                    </label>

                    <p className="text-[11px] text-subtle mt-2">Allowed: .png, .jpg, .jpeg, .pdf, .doc, .docx (Max 10MB)</p>
                    {attachmentError && <p className="text-[11px] text-red-600 mt-1">{attachmentError}</p>}
                    {attachment && !attachmentError && <p className="text-[11px] text-green-700 mt-1">Selected: {attachment.name}</p>}

                    {!attachment && !attachmentError && (
                        <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
                            <p className="text-[11px] text-amber-900 inline-flex items-start gap-2">
                                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                                You may submit without follow-up documents, but supporting evidence helps establish a stronger basis for appeal review.
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex justify-end mt-2">
                    <button
                        type="submit"
                        disabled={posting || !message.trim()}
                        className="btn-primary py-2 px-5 text-sm flex items-center gap-2"
                    >
                        {posting ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                        Post Reply
                    </button>
                </div>
            </form>
        </div>
    );
}

// ── Main content (must be wrapped in Suspense due to useSearchParams) ──────────
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
    const [ticket, setTicket] = useState<{
        ticketId: string;
        status: string;
        submittedAt: string;
        detailsRedacted: boolean;
        studentId: string;
        campus: string;
        college: string;
        category: string;
        subject: string;
        complaintNarrative: string;
        attachmentUrl: string;
        resolutionNotes: string;
    } | null>(null);

    // Load localStorage history on mount (client-only)
    useEffect(() => {
        setHistory(loadStoredTickets());
    }, []);

    useEffect(() => {
        if (authStatus !== 'authenticated') {
            return;
        }

        let cancelled = false;

        const loadServerHistory = async () => {
            try {
                const response = await fetch('/api/tickets/mine', { cache: 'no-store' });
                if (!response.ok) {
                    return;
                }

                const data = await response.json();
                const serverTickets = ((data?.tickets || []) as ServerTicketListItem[]).map((ticket) => ({
                    id: String(ticket.ticketId || '').trim().toUpperCase(),
                    submittedAt: String(ticket.submittedAt || '').trim(),
                    category: String(ticket.category || '').trim(),
                    subject: String(ticket.subject || '').trim(),
                }));

                if (!cancelled) {
                    setHistory((current) => mergeTicketHistory(serverTickets, current));
                }
            } catch {
                // Keep local-only history when server history fails.
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

        // Push clean URL
        const query = new URLSearchParams({ id });
        if (token) {
            query.set('access', token);
        }
        router.replace(`?${query.toString()}`);

        try {
            const responseQuery = token ? `?access=${encodeURIComponent(token)}` : '';
            const res = await fetch(`/api/tickets/${encodeURIComponent(id)}${responseQuery}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || 'Failed to locate ticket');

            // Normalize status from whatever the Regent typed in the sheet
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

            // Clear the input so the placeholder is visible again
            setTicketId('');
        } catch (err: any) {
            setError(err.message || 'An error occurred while tracking this ticket.');
        } finally {
            setLoading(false);
        }
    }, [router]);

    // Auto-search if URL contains ?id=
    useEffect(() => {
        if (initialId) handleSearch(initialId, initialAccess);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="container-main max-w-3xl pb-24">

            {/* ── Back link ──────────────────────────────────────────────────── */}
            <div className="mb-8">
                <Link href="/services" className="inline-flex items-center gap-2 text-sm text-subtle hover:text-body transition-colors group">
                    <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                    Back to Services
                </Link>
            </div>

            {/* ── Search card ────────────────────────────────────────────────── */}
            <div className="card p-6 mb-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-rtu-blue/10 text-rtu-blue">
                        <Search size={18} />
                    </div>
                    <div>
                        <h2 className="font-semibold text-body leading-tight">Track a Ticket</h2>
                        <p className="text-xs text-subtle mt-0.5">
                            Enter your Ticket ID from the confirmation email — e.g.&nbsp;<span className="font-mono">TKT-2604-1KMZ9D1Q7T</span>
                        </p>
                    </div>
                </div>

                <form
                    onSubmit={(e) => { e.preventDefault(); handleSearch(ticketId); }}
                    className="flex flex-col sm:flex-row gap-3"
                >
                    <div className="flex items-center flex-1 gap-2 border border-soft rounded-xl px-4 bg-surface-muted/40 focus-within:border-rtu-gold focus-within:ring-2 focus-within:ring-rtu-gold/20 transition-all">
                        <Search className="text-subtle shrink-0 pointer-events-none" size={16} />
                        <input
                            type="text"
                            value={ticketId}
                            onChange={(e) => setTicketId(e.target.value)}
                            placeholder="TKT-2604-1KMZ9D1Q7T"
                            className="flex-1 h-11 bg-transparent outline-none uppercase tracking-wider font-mono text-sm text-body placeholder:text-subtle placeholder:normal-case placeholder:tracking-normal"
                            disabled={loading}
                            autoComplete="off"
                            spellCheck={false}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading || !ticketId.trim()}
                        className="btn-primary h-11 px-7 flex items-center justify-center gap-2 text-sm"
                    >
                        {loading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                        {loading ? 'Searching…' : 'Track'}
                    </button>
                </form>
            </div>

            {/* ── Saved ticket history ───────────────────────────────────────── */}
            {history.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="card p-5 mb-6"
                >
                    <h3 className="text-sm font-semibold text-body mb-3 flex items-center gap-2">
                        <BookOpen size={14} className="text-subtle" />
                        Your submitted tickets
                    </h3>
                    <ul className="space-y-2">
                        {history.map((t) => (
                            <li key={t.id}>
                                <button
                                    onClick={() => handleSearch(t.id, getStoredAccessToken(t.id))}
                                    className="w-full text-left flex items-center justify-between px-4 py-3 rounded-xl border border-soft bg-surface-muted/40 hover:border-rtu-blue/40 hover:bg-rtu-blue/5 transition-all group"
                                >
                                    <div className="min-w-0">
                                        <p className="font-mono text-xs font-bold text-body">{t.id}</p>
                                        <p className="text-xs text-subtle truncate mt-0.5">
                                            {t.category}{t.subject ? ` · ${t.subject}` : ''}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3 ml-4 shrink-0">
                                        <span className="text-xs text-subtle hidden sm:block">
                                            {formatShortSubmittedDate(t.submittedAt)}
                                        </span>
                                        <ChevronRight size={14} className="text-subtle group-hover:text-body group-hover:translate-x-0.5 transition-all" />
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                </motion.div>
            )}

            {/* ── Error state ────────────────────────────────────────────────── */}
            <AnimatePresence mode="wait">
                {error && !loading && (
                    <motion.div
                        key="error"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="card p-6 border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/40"
                    >
                        <div className="flex gap-4">
                            <XCircle className="shrink-0 text-red-500 mt-0.5" size={20} />
                            <div>
                                <h3 className="font-semibold text-red-900 dark:text-red-300 mb-1">Ticket not found</h3>
                                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                                <p className="text-xs text-red-600/70 dark:text-red-400/60 mt-3 pt-3 border-t border-red-200/50 dark:border-red-900/40">
                                    Double-check the exact ID from your confirmation email. Newly submitted tickets may take a few moments to appear.
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ── Ticket result ───────────────────────────────────────────── */}
                {ticket && !loading && (
                    <motion.div
                        key="ticket"
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                    >
                        {/* Header card */}
                        <div className="card p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-8 opacity-[0.04] pointer-events-none select-none">
                                <ShieldCheck size={100} />
                            </div>

                            <div className="relative">
                                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                                    <div>
                                        <p className="text-xs text-subtle font-mono mb-1">{ticket.ticketId}</p>
                                        <h2 className="text-xl font-bold text-body leading-snug">
                                            {ticket.detailsRedacted ? 'Ticket Status' : (ticket.subject || `${ticket.category} Grievance`)}
                                        </h2>
                                        {!ticket.detailsRedacted && ticket.category && (
                                            <p className="text-xs text-subtle mt-1">
                                                Category: <span className="font-medium text-body">{ticket.category}</span>
                                            </p>
                                        )}
                                    </div>
                                    <StatusBadge status={ticket.status} />
                                </div>

                                <p className="text-xs text-subtle">
                                    Submitted {formatSubmittedDate(ticket.submittedAt)}
                                </p>
                            </div>
                        </div>

                        {ticket.detailsRedacted && (
                            <div className="card p-5 border-amber-200 bg-amber-50">
                                <p className="text-sm text-amber-900 leading-relaxed">
                                    Detailed ticket metadata is protected. If you are signed in with the same account that filed this grievance, full details will load automatically from your submitted list.
                                </p>
                            </div>
                        )}

                        {!ticket.detailsRedacted && (
                            <div className="card p-6">
                                <h3 className="text-sm font-semibold text-body mb-3">Ticket Details</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                    <p><span className="text-subtle">Student ID:</span> <span className="text-body font-medium">{ticket.studentId || 'N/A'}</span></p>
                                    <p><span className="text-subtle">Campus:</span> <span className="text-body font-medium">{ticket.campus || 'N/A'}</span></p>
                                    <p className="sm:col-span-2"><span className="text-subtle">College / Institute:</span> <span className="text-body font-medium">{ticket.college || 'N/A'}</span></p>
                                </div>

                                {ticket.complaintNarrative?.trim() && (
                                    <>
                                        <p className="eyebrow-label text-subtle mt-4 mb-1">Complaint Narrative</p>
                                        <p className="text-sm text-body whitespace-pre-wrap leading-relaxed">{ticket.complaintNarrative}</p>
                                    </>
                                )}

                                {ticket.attachmentUrl?.trim() && (
                                    <div className="mt-4">
                                        {ticket.attachmentUrl.startsWith('https://') ? (
                                            <a
                                                href={ticket.attachmentUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-2 text-sm font-medium text-brand hover:underline"
                                            >
                                                View Attachment
                                            </a>
                                        ) : (
                                            <p className="text-xs text-subtle">Attachment link is unavailable.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Timeline card */}
                        <div className="card p-6">
                            <h3 className="text-sm font-semibold text-body mb-5">Resolution Progress</h3>

                            <div className="relative">
                                {/* Connector line */}
                                <div className="absolute left-[15px] top-6 bottom-6 w-px bg-soft" />

                                <div className="space-y-6">
                                    {STEPS.map((step, i) => {
                                        const isActive = step.activeFor.includes(ticket.status as TicketStatus);
                                        const isCurrent = i === STEPS.findLastIndex(s => s.activeFor.includes(ticket.status as TicketStatus));
                                        return (
                                            <div key={step.label} className="flex gap-4 relative">
                                                <div className={`
                                                    w-8 h-8 rounded-full shrink-0 flex items-center justify-center z-10
                                                    ring-4 ring-[var(--bg-surface,white)]
                                                    transition-colors duration-300
                                                    ${isActive
                                                        ? isCurrent && ticket.status !== 'Resolved' && ticket.status !== 'Closed'
                                                            ? 'bg-blue-100 text-blue-600'
                                                            : 'bg-green-100 text-green-600'
                                                        : 'bg-surface-muted text-subtle'
                                                    }
                                                `}>
                                                    {isActive ? <CheckCircle2 size={16} /> : <Clock size={16} />}
                                                </div>
                                                <div className="pt-1 min-w-0">
                                                    <p className={`text-sm font-semibold leading-snug ${isActive ? 'text-body' : 'text-subtle'}`}>
                                                        {step.label}
                                                    </p>
                                                    <p className="text-xs text-subtle mt-1 leading-relaxed">
                                                        {step.description}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Appeals Thread */}
                        <AppealsThread ticketId={ticket.ticketId} detailsRedacted={ticket.detailsRedacted} />

                        {/* Track another */}
                        <button
                            onClick={() => { setTicket(null); setError(null); setTicketId(''); router.replace('?'); }}
                            className="text-sm text-subtle hover:text-body transition-colors underline underline-offset-2"
                        >
                            ← Track a different ticket
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ── Page shell ─────────────────────────────────────────────────────────────────
export default function TrackPage() {
    return (
        <>
            <section className="bg-gradient-rtu page-header">
                <div className="container-main text-center">
                    <Ticket className="mx-auto mb-4 text-white/80" size={36} />
                    <h1 className="page-header-title font-bold text-white mb-3">
                        Track Your <span className="text-gradient-gold">Grievance</span>
                    </h1>
                    <p className="page-header-subtitle max-w-lg mx-auto">
                        Check real-time status of your submitted grievances. When signed in, your ticket list appears directly in-app.
                    </p>
                </div>
            </section>

            <section className="section-tight">
                <Suspense fallback={
                    <div className="container-main max-w-3xl flex justify-center py-16">
                        <Loader2 className="animate-spin text-subtle" size={24} />
                    </div>
                }>
                    <TrackContent />
                </Suspense>
            </section>
        </>
    );
}
