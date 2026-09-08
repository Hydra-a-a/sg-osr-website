'use client';

import { ChevronRight, Loader2, Search } from 'lucide-react';
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
        <div className={`rounded-3xl border border-white/10 bg-[linear-gradient(145deg,rgba(12,22,36,0.72),rgba(11,20,34,0.56))] shadow-[0_20px_50px_rgba(4,10,22,0.2)] ${compact ? 'p-4' : 'p-6'}`}>
            <div className={`grid gap-5 ${compact ? 'xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]' : 'xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]'}`}>
                <div>
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div className="space-y-1">
                            <h2 className={`${compact ? 'text-base' : 'text-xl'} font-semibold tracking-tight text-white`}>
                                {compact ? 'Track another ticket' : 'Track a grievance'}
                            </h2>
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
                        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-4 transition-all focus-within:border-amber-300/50 focus-within:ring-2 focus-within:ring-amber-300/20">
                            <Search className="shrink-0 text-slate-400" size={16} />
                            <input
                                type="text"
                                value={ticketId}
                                onChange={(event) => onTicketIdChange(event.target.value)}
                                placeholder="TKT-2604-1KMZ9D1Q7T"
                                className="h-12 flex-1 bg-transparent font-mono text-sm uppercase tracking-wider text-white outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-500"
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
                                {loading ? 'Searching…' : 'Open ticket'}
                            </span>
                        </button>
                    </form>
                </div>

                <div className="border-l border-white/10 pl-4">
                    <div className="mb-3">
                        <h3 className="text-sm font-semibold text-white">My cases</h3>
                    </div>

                    {history.length > 0 ? (
                        <ul className="divide-y divide-white/10 rounded-xl border border-white/10 bg-black/10">
                            {history.slice(0, compact ? 3 : 5).map((item) => (
                                <li key={item.id}>
                                    <button
                                        onClick={() => onSelectHistory(item.id)}
                                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-all hover:bg-white/[0.06]"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate font-mono text-xs font-bold text-white">{item.id}</p>
                                            <p className="mt-1 truncate text-xs text-slate-400">
                                                {item.category}
                                                {item.subject ? ` · ${item.subject}` : ''}
                                            </p>
                                        </div>
                                        <div className="flex shrink-0 items-center gap-2 text-slate-400">
                                            <span className="hidden text-xs sm:inline">{formatShortDate(item.submittedAt)}</span>
                                            <ChevronRight size={14} />
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="rounded-xl border border-dashed border-white/20 bg-white/[0.04] p-4">
                            <p className="text-sm font-medium text-slate-200">
                                {authStatus === 'authenticated' ? 'No saved cases' : 'Sign in to view your cases'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
