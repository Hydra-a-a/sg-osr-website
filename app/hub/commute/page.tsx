'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { NoncedStyle } from '@/components/CspNonceProvider';
import { 
    ArrowLeft, ArrowRightLeft, Bus, Footprints, Map, TrainFront, 
    AlertTriangle, Info, ExternalLink, Navigation, Clock, Banknote,
    CarFront, Star, Share2, Copy, Check, X, History, Zap, Coins, GitFork
} from 'lucide-react';
import type { CommuteResponse, CommuteStep } from '@/schemas/commute';

// ── localStorage helpers ──
type SavedRoute = { origin: string; destination: string; savedAt: number };
type RecentSearch = { origin: string; destination: string; ts: number };
const MAX_SAVED = 8;
const MAX_RECENT = 5;
const LS_SAVED = 'commute_saved_routes';
const LS_RECENT = 'commute_recent_searches';

function readLS<T>(key: string, fallback: T): T {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function writeLS<T>(key: string, value: T) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function normalize(s: string) { return s.toLowerCase().replace(/[^a-z0-9]/g, ''); }

const PRESET_DESTINATIONS = [
    'PITX', 'Pasay (Taft)', 'SM Bicutan', 'Alabang (Starmall)', 
    'Cubao', 'Binangonan', 'Tanay', 'RTU Boni', 'RTU Pasig'
];

function getStepIcon(type: CommuteStep['type']) {
    switch (type) {
        case 'WALK': return <Footprints className="w-5 h-5" />;
        case 'JEEP': return <CarFront className="w-5 h-5" />;
        case 'BUS': return <Bus className="w-5 h-5" />;
        case 'MRT': 
        case 'LRT': return <TrainFront className="w-5 h-5" />;
        case 'TRICYCLE': return <Navigation className="w-5 h-5" />;
        case 'UV': return <CarFront className="w-5 h-5" />;
        default: return <Navigation className="w-5 h-5" />;
    }
}

function getStepColorClass(type: CommuteStep['type']) {
    switch (type) {
        case 'WALK': return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
        case 'JEEP': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
        case 'BUS': return 'bg-green-500/20 text-green-400 border-green-500/30';
        case 'MRT': 
        case 'LRT': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
        case 'TRICYCLE': 
        case 'UV': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
        default: return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
}

export default function CommuterMapsPage() {
    const router = useRouter();
    const [origin, setOrigin] = useState('');
    const [destination, setDestination] = useState('');
    const [preference, setPreference] = useState<'fastest' | 'cheapest' | 'fewest_transfers'>('fastest');
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<CommuteResponse | null>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
    const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
    const [toastMsg, setToastMsg] = useState('');
    const [isSaved, setIsSaved] = useState(false);

    // Load localStorage on mount
    useEffect(() => {
        setSavedRoutes(readLS<SavedRoute[]>(LS_SAVED, []));
        setRecentSearches(readLS<RecentSearch[]>(LS_RECENT, []));
    }, []);

    // Check if current result is already saved
    useEffect(() => {
        if (origin && destination) {
            setIsSaved(savedRoutes.some(r => normalize(r.origin) === normalize(origin) && normalize(r.destination) === normalize(destination)));
        }
    }, [origin, destination, savedRoutes]);

    const showToast = (msg: string) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(''), 2500);
    };

    const handleSwap = () => {
        setOrigin(destination);
        setDestination(origin);
    };

    const handleSearch = async (searchOrigin?: string, searchDest?: string) => {
        const o = searchOrigin || origin;
        const d = searchDest || destination;
        if (!o.trim() || !d.trim()) return;
        if (searchOrigin) setOrigin(searchOrigin);
        if (searchDest) setDestination(searchDest);

        setIsLoading(true);
        setErrorMsg('');
        setResult(null);

        try {
            const res = await fetch('/api/hub/commute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ origin: o, destination: d, preference }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error?.message || 'Failed to fetch route');
            setResult(json.data);

            // Track recent search
            const recent = readLS<RecentSearch[]>(LS_RECENT, []);
            const deduped = recent.filter(r => !(normalize(r.origin) === normalize(o) && normalize(r.destination) === normalize(d)));
            const updated = [{ origin: o, destination: d, ts: Date.now() }, ...deduped].slice(0, MAX_RECENT);
            writeLS(LS_RECENT, updated);
            setRecentSearches(updated);
        } catch (err: any) {
            setErrorMsg(err.message || 'An unexpected error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveRoute = () => {
        if (!origin || !destination) return;
        const existing = readLS<SavedRoute[]>(LS_SAVED, []);
        if (existing.some(r => normalize(r.origin) === normalize(origin) && normalize(r.destination) === normalize(destination))) {
            // Unsave
            const filtered = existing.filter(r => !(normalize(r.origin) === normalize(origin) && normalize(r.destination) === normalize(destination)));
            writeLS(LS_SAVED, filtered);
            setSavedRoutes(filtered);
            showToast('Route removed from saved');
            return;
        }
        const updated = [{ origin, destination, savedAt: Date.now() }, ...existing].slice(0, MAX_SAVED);
        writeLS(LS_SAVED, updated);
        setSavedRoutes(updated);
        showToast('Route saved! ⭐');
    };

    const handleDeleteSaved = (idx: number) => {
        const existing = readLS<SavedRoute[]>(LS_SAVED, []);
        existing.splice(idx, 1);
        writeLS(LS_SAVED, existing);
        setSavedRoutes([...existing]);
    };

    const handleShareRoute = async () => {
        if (!result || result.status === 'error') return;
        const dur = result.summary.totalDurationMins ? `⏱️ ~${result.summary.totalDurationMins} mins` : '';
        const fare = result.summary.fareEstimateRange ? `💵 ₱${result.summary.fareEstimateRange}` : '';
        const parts = [`📍 ${origin} → ${destination}`, dur, fare].filter(Boolean);
        const text = parts.join(' | ') + (result.externalUrl ? `\n🔗 ${result.externalUrl}` : '');
        try {
            await navigator.clipboard.writeText(text);
            showToast('Route copied to clipboard! 📋');
        } catch {
            showToast('Could not copy to clipboard');
        }
    };

    const studentFare = (fareRange: string | undefined): string | null => {
        if (!fareRange) return null;
        const match = fareRange.match(/^(\d+)(?:-(\d+))?$/);
        if (!match) return null;
        const lo = Math.round(Number(match[1]) * 0.8);
        const hi = match[2] ? Math.round(Number(match[2]) * 0.8) : lo;
        return lo === hi ? `${lo}` : `${lo}-${hi}`;
    };

    return (
        <div className="min-h-screen hub-shell">
            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button 
                        onClick={() => router.push('/hub')}
                        className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                        aria-label="Back to Hub"
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-300" />
                    </button>
                    <div>
                        <span className="hub-eyebrow px-3 py-1 rounded-full mb-2 inline-block">Commuter Maps</span>
                        <h1 className="text-3xl font-bold text-white">Plan your route</h1>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* Search Sidebar */}
                    <div className="lg:col-span-4 space-y-6">
                        <div className="hub-panel p-6">
                            <div className="space-y-4 relative">
                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">From</label>
                                    <input 
                                        type="text"
                                        value={origin}
                                        onChange={(e) => setOrigin(e.target.value)}
                                        placeholder="e.g. PITX"
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all"
                                    />
                                </div>

                                <div className="flex justify-center -my-2 relative z-10">
                                    <button 
                                        onClick={handleSwap}
                                        className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 border border-white/10 text-slate-300 hover:text-white hover:border-amber-500/50 transition-all shadow-md"
                                        title="Swap Origin and Destination"
                                    >
                                        <ArrowRightLeft className="w-4 h-4 rotate-90" />
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">To</label>
                                    <input 
                                        type="text"
                                        value={destination}
                                        onChange={(e) => setDestination(e.target.value)}
                                        placeholder="e.g. RTU Boni"
                                        className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all"
                                    />
                                </div>

                                {/* Preference Tabs */}
                                <div className="flex gap-1 p-1 rounded-xl bg-slate-900/60 border border-white/5">
                                    {([
                                        { key: 'fastest' as const, icon: <Zap className="w-3.5 h-3.5" />, label: 'Fastest' },
                                        { key: 'cheapest' as const, icon: <Coins className="w-3.5 h-3.5" />, label: 'Cheapest' },
                                        { key: 'fewest_transfers' as const, icon: <GitFork className="w-3.5 h-3.5" />, label: 'Fewest' },
                                    ]).map(tab => (
                                        <button
                                            key={tab.key}
                                            onClick={() => setPreference(tab.key)}
                                            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                                                preference === tab.key
                                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                                    : 'text-slate-400 hover:text-slate-300'
                                            }`}
                                        >
                                            {tab.icon} {tab.label}
                                        </button>
                                    ))}
                                </div>

                                <button 
                                    onClick={() => handleSearch()}
                                    disabled={!origin || !destination || isLoading}
                                    className="w-full hub-action-primary mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? 'Searching...' : 'Find Route'}
                                </button>
                            </div>
                        </div>

                        <div className="hub-panel p-6">
                            <h3 className="text-sm font-medium text-slate-300 mb-4">Quick Presets</h3>
                            <div className="flex flex-wrap gap-2">
                                {PRESET_DESTINATIONS.map(preset => (
                                    <button
                                        key={preset}
                                        onClick={() => {
                                            if (!origin) setOrigin(preset);
                                            else if (!destination) setDestination(preset);
                                            else setOrigin(preset);
                                        }}
                                        className="hub-mini-chip hover:bg-white/10 transition-colors text-xs"
                                    >
                                        {preset}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Saved Routes */}
                        {savedRoutes.length > 0 && (
                            <div className="hub-panel p-6">
                                <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
                                    <Star className="w-4 h-4 text-amber-400" /> Saved Routes
                                </h3>
                                <div className="space-y-2">
                                    {savedRoutes.map((route, idx) => (
                                        <div key={idx} className="flex items-center gap-2 group">
                                            <button
                                                onClick={() => handleSearch(route.origin, route.destination)}
                                                className="flex-1 text-left text-sm text-slate-300 hover:text-white py-2 px-3 rounded-lg hover:bg-white/5 transition-colors truncate"
                                            >
                                                {route.origin} → {route.destination}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteSaved(idx)}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                                                title="Remove"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Recent Searches */}
                        {recentSearches.length > 0 && !result && !isLoading && (
                            <div className="hub-panel p-6">
                                <h3 className="text-sm font-medium text-slate-300 mb-4 flex items-center gap-2">
                                    <History className="w-4 h-4 text-slate-400" /> Recent
                                </h3>
                                <div className="space-y-2">
                                    {recentSearches.map((s, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => handleSearch(s.origin, s.destination)}
                                            className="w-full text-left text-sm text-slate-400 hover:text-white py-2 px-3 rounded-lg hover:bg-white/5 transition-colors truncate"
                                        >
                                            {s.origin} → {s.destination}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Results Area */}
                    <div className="lg:col-span-8">
                        <AnimatePresence mode="wait">
                            {isLoading && (
                                <motion.div 
                                    key="loading"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="space-y-4"
                                >
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="hub-panel p-6 animate-pulse">
                                            <div className="h-6 bg-white/5 rounded w-1/3 mb-4"></div>
                                            <div className="flex gap-4">
                                                <div className="h-10 w-10 bg-white/5 rounded-full"></div>
                                                <div className="flex-1 space-y-2">
                                                    <div className="h-4 bg-white/5 rounded w-full"></div>
                                                    <div className="h-4 bg-white/5 rounded w-5/6"></div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </motion.div>
                            )}

                            {errorMsg && !isLoading && (
                                <motion.div 
                                    key="error"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="hub-panel p-6 border-red-500/30 bg-red-500/5 flex items-start gap-4"
                                >
                                    <AlertTriangle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
                                    <div>
                                        <h3 className="font-semibold text-red-400 text-lg mb-1">Search Failed</h3>
                                        <p className="text-slate-300">{errorMsg}</p>
                                    </div>
                                </motion.div>
                            )}

                            {result && !isLoading && (
                                <motion.div 
                                    key="result"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-6"
                                >
                                    {/* Notices Banner */}
                                    {result.notices.length > 0 && (
                                        <div className="space-y-3">
                                            {result.notices.map((notice, idx) => (
                                                <div 
                                                    key={idx} 
                                                    className={`p-4 rounded-xl border flex items-start gap-3 ${
                                                        notice.type === 'warning' 
                                                            ? 'border-red-500/30 bg-red-500/10 text-red-200' 
                                                            : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                                                    }`}
                                                >
                                                    {notice.type === 'warning' ? <AlertTriangle className="w-5 h-5 shrink-0" /> : <Info className="w-5 h-5 shrink-0" />}
                                                    <p className="text-sm font-medium">{notice.message}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Only show route card when there are actual steps */}
                                    {result.status !== 'error' && result.steps.length > 0 && (
                                        <div className="hub-panel overflow-hidden">
                                            <div className="p-6 border-b border-white/5 bg-white/[0.02]">
                                                <div className="flex flex-wrap items-center justify-between gap-4">
                                                    <div>
                                                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                                            <Map className="w-5 h-5 text-amber-400" />
                                                            Suggested Route
                                                        </h2>
                                                        {result.provider === 'curated' && (
                                                            <span className="text-xs font-medium text-amber-400/80 uppercase tracking-wider mt-1 block">Community-Curated Route</span>
                                                        )}
                                                    </div>
                                                    
                                                    <div className="flex gap-4 text-sm font-medium text-slate-300">
                                                        {result.summary.totalDurationMins && (
                                                            <div className="flex items-center gap-1.5">
                                                                <Clock className="w-4 h-4 text-slate-400" />
                                                                ~{result.summary.totalDurationMins} mins
                                                            </div>
                                                        )}
                                                        {result.summary.fareEstimateRange && (
                                                            <div className="flex flex-col items-end">
                                                                <div className="flex items-center gap-1.5">
                                                                    <Banknote className="w-4 h-4 text-green-400" />
                                                                    ₱{result.summary.fareEstimateRange}
                                                                </div>
                                                                {studentFare(result.summary.fareEstimateRange) && (
                                                                    <span className="text-xs text-emerald-400/70 mt-0.5">🎓 Student: ₱{studentFare(result.summary.fareEstimateRange)}</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-6">
                                                {/* Mode Timeline Strip */}
                                                <div className="flex items-center gap-1 mb-8 pb-6 border-b border-white/5 overflow-x-auto">
                                                    {result.steps.map((step, idx) => (
                                                        <div key={idx} className="flex items-center gap-1 shrink-0">
                                                            <div className={`w-9 h-9 rounded-full border flex items-center justify-center ${getStepColorClass(step.type)}`} title={`${step.type}${step.durationMins ? ` (~${step.durationMins}m)` : ''}`}>
                                                                {getStepIcon(step.type)}
                                                            </div>
                                                            {idx < result.steps.length - 1 && (
                                                                <div className="w-6 h-px bg-white/20 mx-0.5" />
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Step-by-step Timeline */}
                                                <div className="space-y-6 relative ml-5 border-l border-white/10">
                                                    {result.steps.map((step, idx) => (
                                                        <div key={idx} className="relative flex items-start gap-5 pl-6">
                                                            <div className={`absolute -left-[13px] w-[26px] h-[26px] shrink-0 rounded-full border-2 flex items-center justify-center bg-slate-900/80 ${getStepColorClass(step.type)}`}>
                                                                {getStepIcon(step.type)}
                                                            </div>
                                                            <div className="flex-1 pt-0.5">
                                                                <div className="flex items-baseline gap-2 mb-1">
                                                                    <span className={`text-xs font-bold uppercase tracking-wider ${getStepColorClass(step.type).split(' ')[1]}`}>
                                                                        {step.type}
                                                                    </span>
                                                                    {step.durationMins && (
                                                                        <span className="text-xs text-slate-400">~{step.durationMins}m</span>
                                                                    )}
                                                                    {step.fare && (
                                                                        <span className="text-xs text-green-400">₱{step.fare}</span>
                                                                    )}
                                                                </div>
                                                                <p className="text-slate-200 leading-relaxed text-sm lg:text-base">
                                                                    {step.instruction}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="p-4 bg-white/[0.02] border-t border-white/5 flex flex-wrap justify-between gap-3">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={handleSaveRoute}
                                                        className={`hub-action-secondary text-sm ${isSaved ? 'border-amber-500/40 text-amber-400' : ''}`}
                                                        title={isSaved ? 'Remove from saved' : 'Save this route'}
                                                    >
                                                        <Star className={`w-4 h-4 mr-1 ${isSaved ? 'fill-amber-400' : ''}`} />
                                                        {isSaved ? 'Saved' : 'Save'}
                                                    </button>
                                                    <button onClick={handleShareRoute} className="hub-action-secondary text-sm">
                                                        <Share2 className="w-4 h-4 mr-1" /> Share
                                                    </button>
                                                </div>
                                                <div className="flex gap-2">
                                                    {result.externalUrl && (
                                                        <a 
                                                            href={result.externalUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="hub-action-secondary text-sm"
                                                        >
                                                            Open in Google Maps
                                                            <ExternalLink className="w-4 h-4 ml-1" />
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Error-specific empty state (no steps) */}
                                    {result.status === 'error' && (
                                        <div className="hub-panel p-8 flex flex-col items-center text-center">
                                            <Map className="w-10 h-10 text-slate-500 mb-4 opacity-50" />
                                            <h3 className="text-lg font-medium text-white mb-2">No route available</h3>
                                            <p className="text-slate-400 max-w-md text-sm mb-5">
                                                We couldn&apos;t find a matching route in our curated database. Try a broader landmark name, or use Google Maps directly.
                                            </p>
                                            {result.externalUrl && (
                                                <a 
                                                    href={result.externalUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="hub-action-primary text-sm"
                                                >
                                                    Try on Google Maps
                                                    <ExternalLink className="w-4 h-4 ml-1" />
                                                </a>
                                            )}
                                        </div>
                                    )}
                                </motion.div>
                            )}

                            {!result && !isLoading && !errorMsg && (
                                <div className="hub-empty-state py-16 flex flex-col items-center justify-center">
                                    <Map className="w-12 h-12 text-slate-500 mb-4 opacity-50" />
                                    <h3 className="text-lg font-medium text-white mb-2">Ready to travel?</h3>
                                    <p className="text-slate-400 max-w-md text-center text-sm">
                                        Enter your starting point and destination to find the best transit routes, fare estimates, and travel times.
                                    </p>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>

                </div>
            </div>

            {/* Reuse hub inline styles */}
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
                .hub-eyebrow {
                    background: rgba(244, 192, 82, 0.12);
                    border: 1px solid rgba(244, 192, 82, 0.2);
                    color: #fde68a;
                    font-size: 0.8rem;
                }
                .hub-action-primary {
                    display: inline-flex; justify-content: center; align-items: center;
                    border-radius: 0.9rem; padding: 0.78rem 1rem; font-weight: 600;
                    background: #fbbf24; color: #0f172a; transition: all 0.2s;
                }
                .hub-action-primary:hover:not(:disabled) { background: #fcd34d; transform: translateY(-1px); }
                .hub-action-secondary {
                    display: inline-flex; justify-content: center; align-items: center;
                    border-radius: 0.9rem; padding: 0.78rem 1rem; font-weight: 600;
                    background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; transition: all 0.2s;
                }
                .hub-action-secondary:hover { background: rgba(255,255,255,0.08); transform: translateY(-1px); }
                .hub-mini-chip {
                    display: inline-flex; align-items: center; justify-content: center;
                    border-radius: 999px; padding: 0.35rem 0.7rem; font-weight: 600;
                    background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.08); color: rgba(226, 232, 240, 0.88);
                }
            `} />

            {/* Toast Notification */}
            <AnimatePresence>
                {toastMsg && (
                    <motion.div
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 40 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-slate-900/95 border border-white/10 text-white text-sm font-medium shadow-2xl backdrop-blur-xl"
                    >
                        {toastMsg}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
