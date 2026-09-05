'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, MapPinned, RefreshCcw, Search, ShieldAlert, XCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { NoncedStyle } from '@/components/CspNonceProvider';
import { AdminActionButton, AdminPageShell } from '@/components/admin/AdminPageShell';
import AdminInspector from '@/components/admin/AdminInspector';

type ModerationAction = 'Approve' | 'Reject' | 'Mark for Review' | 'Approve with Warning' | 'Restore Confidence';

interface ModerationRoute {
    rowNumber: number;
    originAliases: string;
    destinationAliases: string;
    steps: string[];
    fareEstimateRange: string;
    durationMinutes?: number;
    notes: string;
    visible: boolean;
    reviewStatus: string;
    contributorName: string;
    contributorStudentId: string;
    contributorDisplayMode?: string;
    contributorDisplayLabel?: string;
    upvotes: number;
    downvotes: number;
    reviewNotes: string;
    submittedAt: string;
    reviewedBy: string;
    reviewedAt: string;
    healthStatus: 'healthy' | 'aging' | 'flagged';
    healthReason?: string;
    reviewBadgeLabel?: string;
    reviewReasonSummary?: string;
}

export default function AdminRoutesPage() {
    const [routes, setRoutes] = useState<ModerationRoute[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingRow, setSavingRow] = useState<number | null>(null);
    const [error, setError] = useState('');
    const [query, setQuery] = useState('');
    const [activeRow, setActiveRow] = useState<number | null>(null);
    const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
    const [reviewNotesDraft, setReviewNotesDraft] = useState<Record<number, string>>({});
    const [statusFilter, setStatusFilter] = useState<'all' | 'Pending' | 'Flagged for Review' | 'Approved with Warning' | 'Rejected'>('all');

    useEffect(() => {
        void loadRoutes();
    }, []);

    async function loadRoutes() {
        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/admin/routes', { cache: 'no-store' });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.error?.message || 'Unable to load route moderation queue.');
            }

            const nextRoutes = Array.isArray(data.routes) ? data.routes : [];
            setRoutes(nextRoutes);
            setActiveRow((current) => current ?? nextRoutes[0]?.rowNumber ?? null);
            setReviewNotesDraft((current) => {
                const nextDrafts = { ...current };
                nextRoutes.forEach((route: ModerationRoute) => {
                    if (typeof nextDrafts[route.rowNumber] === 'undefined') {
                        nextDrafts[route.rowNumber] = route.reviewNotes || '';
                    }
                });
                return nextDrafts;
            });
        } catch (fetchError: any) {
            setError(fetchError?.message || 'Unable to load route moderation queue.');
        } finally {
            setLoading(false);
        }
    }

    const filteredRoutes = useMemo(() => {
        const normalized = query.trim().toLowerCase();
        return routes.filter((route) => {
            if (!normalized) return true;
            return [
                route.originAliases,
                route.destinationAliases,
                route.contributorName,
                route.contributorDisplayLabel,
                route.reviewStatus,
            ].some((value) => String(value || '').toLowerCase().includes(normalized));
        }).filter((route) => {
            if (statusFilter === 'all') return true;
            return route.reviewStatus === statusFilter;
        });
    }, [query, routes, statusFilter]);

    const activeRoute = useMemo(
        () => filteredRoutes.find((route) => route.rowNumber === activeRow) || filteredRoutes[0] || null,
        [activeRow, filteredRoutes],
    );

    async function handleModeration(action: ModerationAction) {
        if (!activeRoute) return;

        setSavingRow(activeRoute.rowNumber);
        setError('');

        try {
            const response = await fetch('/api/admin/routes', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rowNumber: activeRoute.rowNumber,
                    action,
                    reviewNotes: reviewNotesDraft[activeRoute.rowNumber] || '',
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data?.error?.message || 'Unable to update route moderation state.');
            }

            await loadRoutes();
        } catch (saveError: any) {
            setError(saveError?.message || 'Unable to update route moderation state.');
        } finally {
            setSavingRow(null);
        }
    }

    return (
        <AdminPageShell
            title="Community routes queue"
            actions={(
                <AdminActionButton onClick={() => void loadRoutes()} disabled={loading}>
                        <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
                        Refresh queue
                </AdminActionButton>
            )}
        >

                <div className="mt-8">
                    <div className="admin-routes-panel admin-routes-queue min-h-0 w-full p-4">
                        <label className="admin-routes-search">
                            <Search size={16} />
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search contributor, origin, destination..."
                            />
                        </label>

                        <div className="mt-3 flex flex-wrap gap-2">
                            {(['all', 'Pending', 'Flagged for Review', 'Approved with Warning', 'Rejected'] as const).map((option) => (
                                <button
                                    key={option}
                                    onClick={() => setStatusFilter(option)}
                                    className={`admin-routes-filter ${statusFilter === option ? 'admin-routes-filter-active' : ''}`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>

                        {loading ? (
                            <div className="admin-routes-loading">
                                <Loader2 size={18} className="animate-spin" />
                                Loading queue...
                            </div>
                        ) : filteredRoutes.length === 0 ? (
                            <div className="admin-routes-empty">No matching route submissions found.</div>
                        ) : (
                            <div className="mt-4 max-h-[50dvh] space-y-3 overflow-y-auto overscroll-contain pr-1 sm:max-h-[62vh] xl:max-h-[calc(100dvh-18rem)]">
                                {filteredRoutes.map((route) => (
                                    <button
                                        key={route.rowNumber}
                                        onClick={() => { setActiveRow(route.rowNumber); setMobileDetailOpen(true); }}
                                        className={`admin-routes-row ${activeRoute?.rowNumber === route.rowNumber ? 'admin-routes-row-active' : ''}`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-white">{route.originAliases} → {route.destinationAliases}</p>
                                                <p className="mt-1 truncate text-xs text-slate-400">
                                                    {route.contributorDisplayLabel ? `@${route.contributorDisplayLabel}` : route.contributorName || 'Unknown contributor'}
                                                </p>
                                            </div>
                                            <span className={`admin-routes-badge admin-routes-badge-${(route.reviewStatus || 'Pending').toLowerCase()}`}>
                                                {route.reviewStatus || 'Pending'}
                                            </span>
                                        </div>
                                        {route.reviewReasonSummary ? (
                                            <p className="mt-2 text-xs text-slate-400 line-clamp-2">{route.reviewReasonSummary}</p>
                                        ) : null}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <AdminInspector mode="drawer" open={Boolean(activeRoute && mobileDetailOpen)} onClose={() => setMobileDetailOpen(false)} title={activeRoute ? `${activeRoute.originAliases} → ${activeRoute.destinationAliases}` : 'Route inspector'} drawerSize="xl">
                        {error ? (
                            <div className="admin-routes-error">
                                <ShieldAlert size={18} />
                                {error}
                            </div>
                        ) : null}

                        {!activeRoute ? (
                            <div className="admin-routes-empty min-h-[260px]">Select a route submission to review it.</div>
                        ) : (
                            <div className="space-y-6">
                                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                    <div>
                                        <h2 className="text-2xl font-bold text-white">{activeRoute.originAliases} → {activeRoute.destinationAliases}</h2>
                                        <p className="mt-2 text-sm text-slate-300">
                                            Submitted by {activeRoute.contributorName || 'Unknown contributor'}
                                            {activeRoute.contributorDisplayLabel ? ` as @${activeRoute.contributorDisplayLabel}` : ''}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-400">
                                            Row {activeRoute.rowNumber} • {activeRoute.submittedAt || 'Submission time unavailable'}
                                        </p>
                                        {activeRoute.reviewReasonSummary ? (
                                            <p className="mt-2 text-sm text-amber-100">{activeRoute.reviewReasonSummary}</p>
                                        ) : null}
                                    </div>

                                    <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                                        <span className="admin-routes-chip">{activeRoute.upvotes} upvotes</span>
                                        <span className="admin-routes-chip">{activeRoute.downvotes} downvotes</span>
                                        <span className="admin-routes-chip">{activeRoute.reviewStatus || 'Pending'}</span>
                                    </div>
                                </div>

                                <div className="grid gap-4 lg:grid-cols-3">
                                    <div className="admin-routes-metric">
                                        <span>Fare</span>
                                        <strong>{activeRoute.fareEstimateRange || 'Not provided'}</strong>
                                    </div>
                                    <div className="admin-routes-metric">
                                        <span>Duration</span>
                                        <strong>{activeRoute.durationMinutes ? `${activeRoute.durationMinutes} mins` : 'Not provided'}</strong>
                                    </div>
                                    <div className="admin-routes-metric">
                                        <span>Display mode</span>
                                        <strong>{activeRoute.contributorDisplayMode || 'Not set'}</strong>
                                    </div>
                                </div>

                                <div className={`admin-routes-health admin-routes-health-${activeRoute.healthStatus}`}>
                                    {activeRoute.healthStatus === 'flagged' ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
                                    <div>
                                        <p className="text-sm font-semibold text-white">Route health: {activeRoute.reviewBadgeLabel || activeRoute.healthStatus}</p>
                                        <p className="text-xs text-slate-200/90">{activeRoute.healthReason || 'No extra review concerns on this route right now.'}</p>
                                    </div>
                                </div>

                                <div>
                                    <p className="text-sm font-semibold text-white">Submitted steps</p>
                                    <div className="mt-3 space-y-3">
                                        {activeRoute.steps.map((step, index) => (
                                            <div key={`${activeRoute.rowNumber}-step-${index}`} className="admin-routes-step">
                                                <span className="admin-routes-step-index">{index + 1}</span>
                                                <p className="text-sm text-slate-200">{step}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="grid gap-4 lg:grid-cols-2">
                                    <div className="admin-routes-note-card">
                                        <p className="text-sm font-semibold text-white">Submitter notes</p>
                                        <p className="mt-2 text-sm text-slate-300">{activeRoute.notes || 'No notes supplied.'}</p>
                                    </div>
                                    <div className="admin-routes-note-card">
                                        <p className="text-sm font-semibold text-white">Verification details</p>
                                        <p className="mt-2 text-sm text-slate-300">Student ID: {activeRoute.contributorStudentId || 'Not provided'}</p>
                                        <p className="mt-2 text-sm text-slate-400">
                                            Reviewed by {activeRoute.reviewedBy || 'Nobody yet'} {activeRoute.reviewedAt ? `on ${activeRoute.reviewedAt}` : ''}
                                        </p>
                                    </div>
                                </div>

                                <label className="admin-routes-textarea">
                                    <span>Officer review notes</span>
                                    <textarea
                                        rows={5}
                                        value={reviewNotesDraft[activeRoute.rowNumber] || ''}
                                        onChange={(event) => setReviewNotesDraft((current) => ({
                                            ...current,
                                            [activeRoute.rowNumber]: event.target.value,
                                        }))}
                                        placeholder="Optional public-facing note or internal moderation context."
                                    />
                                </label>

                                <div className="flex flex-wrap gap-3">
                                    <button
                                        onClick={() => void handleModeration('Approve')}
                                        disabled={savingRow === activeRoute.rowNumber}
                                        className="admin-routes-approve"
                                    >
                                        {savingRow === activeRoute.rowNumber ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                        Approve Route
                                    </button>
                                    <button
                                        onClick={() => void handleModeration('Approve with Warning')}
                                        disabled={savingRow === activeRoute.rowNumber}
                                        className="admin-routes-neutral"
                                    >
                                        {savingRow === activeRoute.rowNumber ? <Loader2 size={16} className="animate-spin" /> : <AlertTriangle size={16} />}
                                        Approve with Warning
                                    </button>
                                    <button
                                        onClick={() => void handleModeration('Mark for Review')}
                                        disabled={savingRow === activeRoute.rowNumber}
                                        className="admin-routes-neutral"
                                    >
                                        {savingRow === activeRoute.rowNumber ? <Loader2 size={16} className="animate-spin" /> : <MapPinned size={16} />}
                                        Flagged for Review
                                    </button>
                                    <button
                                        onClick={() => void handleModeration('Restore Confidence')}
                                        disabled={savingRow === activeRoute.rowNumber}
                                        className="admin-routes-neutral"
                                    >
                                        {savingRow === activeRoute.rowNumber ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                                        Restore Confidence
                                    </button>
                                    <button
                                        onClick={() => void handleModeration('Reject')}
                                        disabled={savingRow === activeRoute.rowNumber}
                                        className="admin-routes-reject"
                                    >
                                        {savingRow === activeRoute.rowNumber ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
                                        Reject Route
                                    </button>
                                </div>
                            </div>
                        )}
                    </AdminInspector>
                </div>
            <NoncedStyle css={`
                .admin-routes-shell {
                    color: #f8fafc;
                }
                .admin-routes-panel,
                .admin-routes-row,
                .admin-routes-step,
                .admin-routes-chip,
                .admin-routes-metric,
                .admin-routes-note-card,
                .admin-routes-search,
                .admin-routes-refresh,
                .admin-routes-loading,
                .admin-routes-empty,
                .admin-routes-error,
                .admin-routes-kicker {
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    background: rgba(255, 255, 255, 0.04);
                    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.2);
                }
                .admin-routes-kicker {
                    display: inline-flex;
                    border-radius: 999px;
                    padding: 0.45rem 0.9rem;
                    color: #bbf7d0;
                    background: rgba(34, 197, 94, 0.12);
                }
                .admin-routes-panel {
                    border-radius: 0;
                }
                .admin-routes-search {
                    display: flex;
                    align-items: center;
                    gap: 0.65rem;
                    border-radius: 0.5rem;
                    padding: 0.85rem 0.95rem;
                    color: #cbd5e1;
                }
                .admin-routes-search input,
                .admin-routes-textarea textarea {
                    width: 100%;
                    border: 0;
                    outline: 0;
                    background: transparent;
                    color: #fff;
                }
                .admin-routes-refresh,
                .admin-routes-approve,
                .admin-routes-reject {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.55rem;
                    border-radius: 0.375rem;
                    padding: 0.85rem 1rem;
                    font-weight: 600;
                    transition: transform 0.2s ease, background 0.2s ease;
                }
                .admin-routes-refresh:hover,
                .admin-routes-approve:hover,
                .admin-routes-reject:hover {
                    transform: translateY(-1px);
                }
                .admin-routes-refresh {
                    color: #fff;
                }
                .admin-routes-row {
                    width: 100%;
                    border-radius: 0.5rem;
                    padding: 0.95rem;
                    text-align: left;
                }
                .admin-routes-filter {
                    border-radius: 0.375rem;
                    padding: 0.42rem 0.8rem;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    background: rgba(255, 255, 255, 0.04);
                    color: #cbd5e1;
                    font-size: 0.75rem;
                    font-weight: 600;
                }
                .admin-routes-filter-active {
                    background: rgba(251, 191, 36, 0.12);
                    border-color: rgba(251, 191, 36, 0.28);
                    color: #fef3c7;
                }
                .admin-routes-row-active {
                    border-color: rgba(251, 191, 36, 0.3);
                    background: rgba(251, 191, 36, 0.08);
                }
                .admin-routes-badge {
                    border-radius: 999px;
                    padding: 0.28rem 0.6rem;
                    font-size: 0.7rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                }
                .admin-routes-badge-pending {
                    background: rgba(250, 204, 21, 0.14);
                    color: #fde68a;
                }
                .admin-routes-badge-approved {
                    background: rgba(34, 197, 94, 0.14);
                    color: #bbf7d0;
                }
                .admin-routes-badge-rejected {
                    background: rgba(248, 113, 113, 0.14);
                    color: #fecaca;
                }
                .admin-routes-chip,
                .admin-routes-metric,
                .admin-routes-step,
                .admin-routes-note-card {
                    border-radius: 0.5rem;
                    padding: 0.9rem 1rem;
                }
                .admin-routes-step {
                    display: grid;
                    grid-template-columns: 34px minmax(0, 1fr);
                    gap: 0.8rem;
                    align-items: start;
                }
                .admin-routes-health {
                    display: flex;
                    gap: 0.75rem;
                    align-items: flex-start;
                    border-radius: 0.5rem;
                    padding: 0.95rem 1rem;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                }
                .admin-routes-health-flagged {
                    background: rgba(239, 68, 68, 0.12);
                    border-color: rgba(248, 113, 113, 0.24);
                }
                .admin-routes-health-aging {
                    background: rgba(245, 158, 11, 0.12);
                    border-color: rgba(245, 158, 11, 0.24);
                }
                .admin-routes-health-healthy {
                    background: rgba(34, 197, 94, 0.12);
                    border-color: rgba(34, 197, 94, 0.22);
                }
                .admin-routes-step-index {
                    width: 34px;
                    height: 34px;
                    display: grid;
                    place-items: center;
                    border-radius: 999px;
                    background: rgba(250, 204, 21, 0.14);
                    color: #fde68a;
                    font-size: 0.8rem;
                    font-weight: 700;
                }
                .admin-routes-metric {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                    color: #cbd5e1;
                }
                .admin-routes-metric strong {
                    color: #fff;
                    font-size: 1rem;
                }
                .admin-routes-textarea {
                    display: block;
                }
                .admin-routes-textarea span {
                    display: block;
                    margin-bottom: 0.55rem;
                    color: #fff;
                    font-size: 0.9rem;
                    font-weight: 600;
                }
                .admin-routes-textarea textarea {
                    min-height: 130px;
                    border-radius: 0.5rem;
                    padding: 0.95rem 1rem;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    background: rgba(8, 15, 28, 0.5);
                    resize: vertical;
                }
                .admin-routes-approve {
                    background: rgba(34, 197, 94, 0.16);
                    border: 1px solid rgba(34, 197, 94, 0.24);
                    color: #bbf7d0;
                }
                .admin-routes-neutral {
                    background: rgba(59, 130, 246, 0.14);
                    border: 1px solid rgba(96, 165, 250, 0.22);
                    color: #dbeafe;
                }
                .admin-routes-reject {
                    background: rgba(239, 68, 68, 0.14);
                    border: 1px solid rgba(239, 68, 68, 0.22);
                    color: #fecaca;
                }
                .admin-routes-loading,
                .admin-routes-empty,
                .admin-routes-error {
                    margin-top: 1rem;
                    border-radius: 0.5rem;
                    padding: 1rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.65rem;
                    text-align: center;
                }
                .admin-routes-error {
                    justify-content: flex-start;
                    color: #fecaca;
                    border-color: rgba(248, 113, 113, 0.22);
                }
            `} />
        </AdminPageShell>
    );
}
