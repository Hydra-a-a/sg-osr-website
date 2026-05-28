'use client';

import { BookOpen, ChevronRight, Loader2, Search, ShieldCheck } from 'lucide-react';
import { TrackStatusBadge } from '@/components/track/TrackStatusBadge';
import type { StoredTicket } from '@/components/track/types';

interface TrackEntryRailProps {
    compact: boolean;
    loading: boolean;
    ticketId: string;
    history: StoredTicket[];
    authStatus: 'authenticated' | 'loading' | 'unauthenticated';
    activeStatus?: string;
    onTicketIdChange: (value: string) => void;
    onSubmit: () => void;
    onSelectHistory: (ticketId: string) => void;
    formatShortDate: (value: string) => string;
}

export function TrackEntryRail({
    compact,
    loading,
    ticketId,
    history,
    authStatus,
    activeStatus,
    onTicketIdChange,
    onSubmit,
    onSelectHistory,
    formatShortDate,
}: TrackEntryRailProps) {
    return (
        <div className={`rounded-3xl border border-[rgba(35,72,116,0.14)] bg-[linear-gradient(160deg,rgba(255,255,255,0.98),rgba(241,246,252,0.92))] ${compact ? 'p-4' : 'p-6'}`}>
            <div className={`grid gap-5 ${compact ? 'xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]' : 'xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]'}`}>
                <div>
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand/75">
                                Entry rail
                            </p>
                            <h2 className={`${compact ? 'text-base' : 'text-xl'} font-semibold tracking-tight text-strong`}>
                                {compact ? 'Track another ticket or reopen your workspace' : 'Track a grievance with your ticket ID'}
                            </h2>
                            <p className="max-w-2xl text-sm leading-relaxed text-subtle">
                                Lookup always stays available. Signed-in students see My cases first, but manual tracking still works for any valid ticket and access token.
                            </p>
                        </div>

                        {activeStatus ? <TrackStatusBadge status={activeStatus} /> : null}
                    </div>

                    <form
                        onSubmit={(event) => {
                            event.preventDefault();
                        onSubmit();
                        }}
                        className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
                    >
                        <div className="flex items-center gap-2 rounded-xl border border-[rgba(35,72,116,0.18)] bg-white px-4 transition-all focus-within:border-[color:var(--accent-secondary)] focus-within:ring-2 focus-within:ring-[rgba(203,165,77,0.16)]">
                            <Search className="shrink-0 text-subtle" size={16} />
                            <input
                                type="text"
                                value={ticketId}
                                onChange={(event) => onTicketIdChange(event.target.value)}
                                placeholder="TKT-2604-1KMZ9D1Q7T"
                                className="h-12 flex-1 bg-transparent font-mono text-sm uppercase tracking-wider text-strong outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-subtle"
                                disabled={loading}
                                autoComplete="off"
                                spellCheck={false}
                                aria-label="Track grievance ticket ID"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !ticketId.trim()}
                            className="btn-primary h-12 min-w-[132px] px-6 text-sm"
                        >
                            <span className="inline-flex items-center justify-center gap-2">
                                {loading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
                                {loading ? 'Searching...' : 'Open workspace'}
                            </span>
                        </button>
                    </form>
                </div>

                <div className="border-l border-[rgba(35,72,116,0.12)] pl-4">
                    <div className="mb-3 flex items-center gap-2">
                        <BookOpen className="text-subtle" size={15} />
                        <h3 className="text-sm font-semibold text-strong">My cases</h3>
                    </div>

                    {history.length > 0 ? (
                        <ul className="divide-y divide-[rgba(35,72,116,0.1)] rounded-xl border border-[rgba(35,72,116,0.14)] bg-white">
                            {history.slice(0, compact ? 3 : 5).map((item) => (
                                <li key={item.id}>
                                    <button
                                        onClick={() => onSelectHistory(item.id)}
                                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-all hover:bg-[rgba(35,72,116,0.04)]"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate font-mono text-xs font-bold text-strong">{item.id}</p>
                                            <p className="mt-1 truncate text-xs text-subtle">
                                                {item.category}
                                                {item.subject ? ` · ${item.subject}` : ''}
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2 text-subtle">
                                            <span className="hidden text-xs sm:inline">{formatShortDate(item.submittedAt)}</span>
                                            <ChevronRight size={14} />
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="rounded-xl border border-dashed border-[rgba(35,72,116,0.2)] bg-white p-4">
                            <div className="mb-2 inline-flex rounded-full bg-[rgba(35,72,116,0.1)] p-2 text-brand">
                                <ShieldCheck size={16} />
                            </div>
                            <p className="text-sm font-medium text-strong">
                                {authStatus === 'authenticated' ? 'No saved cases yet' : 'Sign in to build your case list automatically'}
                            </p>
                            <p className="mt-1 text-sm leading-relaxed text-subtle">
                                {authStatus === 'authenticated'
                                    ? 'Your submitted grievances will appear here after filing or once you open them with a valid ticket ID.'
                                    : 'Manual ticket lookup still works below, but signing in is the easiest way to keep your own grievance history in one place.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
