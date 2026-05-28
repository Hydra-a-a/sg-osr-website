'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Crown, Loader2, Medal, Trophy } from 'lucide-react';
import { NoncedStyle } from '@/components/CspNonceProvider';
import type { LeaderboardEntry } from '@/schemas/commute';

function getRankAccent(rank: number) {
    if (rank === 1) return 'leaderboard-card-gold';
    if (rank === 2) return 'leaderboard-card-silver';
    if (rank === 3) return 'leaderboard-card-bronze';
    return 'leaderboard-card-default';
}

function getRankIcon(rank: number) {
    if (rank === 1) return <Crown size={18} />;
    return <Medal size={18} />;
}

export default function CommuteLeaderboardPage() {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;

        async function loadLeaderboard() {
            setLoading(true);
            setError('');

            try {
                const response = await fetch('/api/hub/commute/leaderboard', { cache: 'no-store' });
                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data?.error?.message || 'Unable to load the Local Guides board.');
                }

                if (!cancelled) {
                    setEntries(Array.isArray(data.entries) ? data.entries : []);
                }
            } catch (fetchError: any) {
                if (!cancelled) {
                    setError(fetchError?.message || 'Unable to load the Local Guides board.');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        loadLeaderboard();
        return () => {
            cancelled = true;
        };
    }, []);

    const podium = useMemo(() => entries.slice(0, 3), [entries]);
    const rest = useMemo(() => entries.slice(3), [entries]);

    return (
        <div className="leaderboard-shell min-h-screen">
            <section className="max-w-6xl mx-auto px-4 py-10 md:py-14">
                <Link href="/hub/commute" className="inline-flex items-center gap-2 text-sm font-medium text-slate-200 hover:text-white transition-colors">
                    <ArrowLeft size={16} /> Back to Commuter Maps
                </Link>

                <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div className="max-w-2xl">
                        <span className="leaderboard-kicker">Local Guides</span>
                        <h1 className="mt-4 text-4xl font-bold text-white leading-tight">Community route leaderboard</h1>
                        <p className="mt-4 text-slate-200 leading-relaxed">
                            Approved routes earn 100 points. Helpful votes add 10, and routes needing updates deduct 5.
                        </p>
                        <p className="mt-2 text-sm text-slate-400">
                            The board only counts approved contributors. Route review flags help officers maintain quality and are not shown here as public callouts.
                        </p>
                    </div>

                    <div className="leaderboard-stat-chip">
                        <Trophy size={18} />
                        {entries.length} active guides
                    </div>
                </div>

                {loading ? (
                    <div className="leaderboard-loading">
                        <Loader2 size={22} className="animate-spin" />
                        Loading Local Guides board...
                    </div>
                ) : error ? (
                    <div className="leaderboard-error">{error}</div>
                ) : entries.length === 0 ? (
                    <div className="leaderboard-empty">
                        <Trophy size={28} className="text-amber-300" />
                        <p className="mt-3 text-white font-semibold">No approved route guides yet.</p>
                        <p className="mt-2 text-sm text-slate-300">Once officers approve community routes, the rankings will show up here.</p>
                    </div>
                ) : (
                    <div className="mt-8 space-y-8">
                        <div className="grid gap-4 lg:grid-cols-3">
                            {podium.map((entry) => (
                                <div key={entry.contributorKey} className={`leaderboard-card ${getRankAccent(entry.rank)}`}>
                                    <div className="leaderboard-rank-badge">
                                        {getRankIcon(entry.rank)}
                                        <span>Top {entry.rank}</span>
                                    </div>
                                    <h2 className="mt-5 text-2xl font-bold text-white">@{entry.displayLabel}</h2>
                                    <p className="mt-2 text-sm text-slate-200">{entry.approvedRoutes} approved routes</p>
                                    <div className="mt-6 text-4xl font-bold text-white">{entry.points}</div>
                                    <p className="text-sm text-slate-300">total points</p>
                                    <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                                        <div className="leaderboard-metric">
                                            <span>Upvotes</span>
                                            <strong>{entry.upvotes}</strong>
                                        </div>
                                        <div className="leaderboard-metric">
                                            <span>Downvotes</span>
                                            <strong>{entry.downvotes}</strong>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="leaderboard-table-shell">
                            <div className="leaderboard-table-header">
                                <span>Rankings</span>
                                <span>Live route karma standings</span>
                            </div>

                            <div className="space-y-3">
                                {entries.map((entry) => (
                                    <div key={`${entry.rank}-${entry.contributorKey}`} className="leaderboard-row">
                                        <div className="leaderboard-row-rank">#{entry.rank}</div>
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-white">@{entry.displayLabel}</p>
                                            <p className="text-xs text-slate-400">{entry.approvedRoutes} approved routes</p>
                                        </div>
                                        <div className="leaderboard-row-metrics">
                                            <span>{entry.upvotes} up</span>
                                            <span>{entry.downvotes} down</span>
                                            <strong>{entry.points} pts</strong>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {rest.length === 0 ? null : (
                                <p className="mt-4 text-xs text-slate-400">
                                    Rankings update from approved community routes in the commuter map sheet.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </section>

            <NoncedStyle css={`
                .leaderboard-shell {
                    background:
                        radial-gradient(100% 120% at 10% 12%, rgba(244, 192, 82, 0.16) 0%, rgba(244, 192, 82, 0) 50%),
                        radial-gradient(90% 100% at 90% 8%, rgba(111, 191, 255, 0.15) 0%, rgba(111, 191, 255, 0) 48%),
                        linear-gradient(135deg, #0c2239 0%, #12314f 45%, #173b5e 100%);
                    color: #e2e8f0;
                }
                .leaderboard-kicker,
                .leaderboard-stat-chip,
                .leaderboard-rank-badge,
                .leaderboard-metric,
                .leaderboard-row,
                .leaderboard-table-shell,
                .leaderboard-loading,
                .leaderboard-empty,
                .leaderboard-error,
                .leaderboard-card {
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    background: linear-gradient(145deg, rgba(12, 22, 36, 0.44), rgba(11, 20, 34, 0.68));
                    box-shadow: 0 20px 50px rgba(4, 10, 22, 0.26);
                    backdrop-filter: blur(14px);
                }
                .leaderboard-kicker {
                    display: inline-flex;
                    border-radius: 0.6rem;
                    padding: 0.45rem 0.95rem;
                    color: #fde68a;
                    background: rgba(244, 192, 82, 0.12);
                    clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%);
                }
                .leaderboard-stat-chip {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.55rem;
                    border-radius: 0.65rem;
                    padding: 0.75rem 1rem;
                    color: #f8fafc;
                    font-weight: 600;
                    width: fit-content;
                    clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%);
                }
                .leaderboard-loading,
                .leaderboard-empty,
                .leaderboard-error {
                    margin-top: 2rem;
                    border-radius: 1.5rem;
                    padding: 1.4rem 1.2rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.75rem;
                }
                .leaderboard-empty {
                    flex-direction: column;
                    text-align: center;
                }
                .leaderboard-error {
                    color: #fecaca;
                    border-color: rgba(248, 113, 113, 0.22);
                    background: rgba(127, 29, 29, 0.35);
                }
                .leaderboard-card {
                    position: relative;
                    overflow: hidden;
                    border-radius: 1.5rem;
                    padding: 1.4rem;
                    clip-path: polygon(0 0, calc(100% - 16px) 0, 100% 16px, 100% 100%, 0 100%);
                }
                .leaderboard-card::after {
                    content: "";
                    position: absolute;
                    left: 0.8rem;
                    bottom: 0.72rem;
                    width: 2.4rem;
                    height: 1.15rem;
                    background:
                        linear-gradient(130deg, rgba(214, 238, 255, 0.14), rgba(214, 238, 255, 0.02)),
                        repeating-linear-gradient(135deg, rgba(214, 238, 255, 0.1) 0 1px, transparent 1px 5px);
                    clip-path: polygon(0 20%, 100% 0, 84% 100%, 0 100%);
                    opacity: 0.38;
                    pointer-events: none;
                }
                .leaderboard-card-gold { border-color: rgba(250, 204, 21, 0.32); }
                .leaderboard-card-silver { border-color: rgba(226, 232, 240, 0.22); }
                .leaderboard-card-bronze { border-color: rgba(251, 146, 60, 0.24); }
                .leaderboard-card-default { border-color: rgba(255, 255, 255, 0.08); }
                .leaderboard-rank-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.45rem;
                    border-radius: 0.55rem;
                    padding: 0.45rem 0.8rem;
                    color: #f8fafc;
                    width: fit-content;
                    clip-path: polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 0 100%);
                }
                .leaderboard-metric {
                    border-radius: 1rem;
                    padding: 0.8rem 0.9rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.2rem;
                    color: #cbd5e1;
                }
                .leaderboard-metric strong {
                    color: #fff;
                    font-size: 1rem;
                }
                .leaderboard-table-shell {
                    border-radius: 0.95rem;
                    padding: 1.2rem;
                    clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%);
                }
                .leaderboard-table-header {
                    display: flex;
                    justify-content: space-between;
                    gap: 1rem;
                    margin-bottom: 1rem;
                    color: #cbd5e1;
                    font-size: 0.85rem;
                }
                .leaderboard-row {
                    position: relative;
                    overflow: hidden;
                    border-radius: 1rem;
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    padding: 0.95rem 1rem;
                    display: grid;
                    grid-template-columns: 60px minmax(0, 1fr) auto;
                    gap: 1rem;
                    align-items: center;
                    clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%);
                }
                .leaderboard-row::before {
                    content: "";
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    width: 2px;
                    background: linear-gradient(180deg, rgba(125, 211, 252, 0.24), rgba(248, 226, 171, 0.58), rgba(125, 211, 252, 0.24));
                }
                .leaderboard-row::after {
                    content: "";
                    position: absolute;
                    left: 0.65rem;
                    bottom: 0.5rem;
                    width: 2.1rem;
                    height: 1rem;
                    background:
                        linear-gradient(128deg, rgba(214, 238, 255, 0.14), rgba(214, 238, 255, 0.03)),
                        repeating-linear-gradient(135deg, rgba(214, 238, 255, 0.1) 0 1px, transparent 1px 5px);
                    clip-path: polygon(0 22%, 100% 0, 84% 100%, 0 100%);
                    opacity: 0.32;
                    pointer-events: none;
                }
                .leaderboard-row-rank {
                    color: #fcd34d;
                    font-weight: 700;
                }
                .leaderboard-row-metrics {
                    display: flex;
                    align-items: center;
                    gap: 0.85rem;
                    color: #cbd5e1;
                    font-size: 0.82rem;
                    flex-wrap: wrap;
                    justify-content: flex-end;
                }
                .leaderboard-row-metrics strong {
                    color: #fff;
                    font-size: 0.95rem;
                }
                @media (max-width: 640px) {
                    .leaderboard-row {
                        grid-template-columns: 48px minmax(0, 1fr);
                    }
                    .leaderboard-row-metrics {
                        grid-column: 1 / -1;
                        justify-content: flex-start;
                    }
                }
            `} />
        </div>
    );
}
