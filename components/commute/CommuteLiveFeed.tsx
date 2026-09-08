'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import {
  AlertTriangle,
  Check,
  Clock3,
  ExternalLink,
  Loader2,
  Plus,
  Radio,
  RefreshCw,
  X,
} from 'lucide-react';
import {
  COMMUTE_LIVE_CORRIDORS,
  STUDENT_COMMUTE_ALERT_KINDS,
  type PublicCommuteAlert,
} from '@/schemas/commute-live';

type FeedResponse = {
  success: true;
  alerts: PublicCommuteAlert[];
  corridors: ReadonlyArray<{ id: string; label: string }>;
  updatedAt: string;
};

const CACHE_KEY = 'commute_live_feed_v1';

async function fetchFeed(url: string): Promise<FeedResponse> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Live commute updates are unavailable.');
  return response.json();
}

function minutesAgo(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  return minutes < 1 ? 'just now' : `${minutes}m ago`;
}

function errorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const error = (payload as { error?: { message?: string } }).error;
    if (error?.message) return error.message;
  }
  return fallback;
}

const KIND_LABELS: Record<PublicCommuteAlert['kind'], string> = {
  DELAY: 'Delay',
  CROWDING: 'Crowding',
  FLOODING: 'Flooding',
  CLOSURE: 'Closure',
  RECOVERY: 'Service recovering',
  OFFICIAL: 'Official update',
};

export default function CommuteLiveFeed() {
  const { status: sessionStatus } = useSession();
  const [cached, setCached] = useState<FeedResponse | null>(null);
  const [corridor, setCorridor] = useState('all');
  const [reportOpen, setReportOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [confirming, setConfirming] = useState('');
  const [message, setMessage] = useState('');
  const [refreshMs, setRefreshMs] = useState(60_000);
  const [form, setForm] = useState<{
    corridorId: string;
    kind: string;
    severity: string;
    privateNote: string;
  }>({
    corridorId: COMMUTE_LIVE_CORRIDORS[0].id,
    kind: 'DELAY',
    severity: 'MODERATE',
    privateNote: '',
  });
  const { data, error, isLoading, isValidating, mutate } = useSWR<FeedResponse>(
    '/api/hub/commute/live',
    fetchFeed,
    { refreshInterval: refreshMs, revalidateOnFocus: true, refreshWhenHidden: false },
  );

  useEffect(() => {
    try {
      const value = localStorage.getItem(CACHE_KEY);
      const parsed = value ? (JSON.parse(value) as FeedResponse) : null;
      if (parsed && Array.isArray(parsed.alerts)) setCached(parsed);
    } catch {}

    const connection = (navigator as Navigator & {
      connection?: {
        saveData?: boolean;
        effectiveType?: string;
        addEventListener?: (type: string, listener: () => void) => void;
        removeEventListener?: (type: string, listener: () => void) => void;
      };
    }).connection;
    const updateInterval = () => {
      setRefreshMs(connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType || '') ? 180_000 : 60_000);
    };
    updateInterval();
    connection?.addEventListener?.('change', updateInterval);
    return () => connection?.removeEventListener?.('change', updateInterval);
  }, []);

  useEffect(() => {
    if (!data) return;
    setCached(data);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {}
  }, [data]);

  const feed = data || cached;
  const visibleAlerts = useMemo(
    () => (feed?.alerts || []).filter((alert) => corridor === 'all' || alert.corridorId === corridor),
    [corridor, feed],
  );

  async function submitReport(event: React.FormEvent) {
    event.preventDefault();
    setReporting(true);
    setMessage('');
    try {
      const response = await fetch('/api/hub/commute/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await response.json() as { alert?: PublicCommuteAlert; error?: { message?: string } };
      if (!response.ok) throw new Error(errorMessage(payload, 'Unable to post this update.'));
      if (payload.alert && feed) {
        void mutate({ ...feed, alerts: [payload.alert, ...feed.alerts.filter((alert) => alert.alertId !== payload.alert?.alertId)] }, false);
      }
      setMessage('Update posted. It will expire automatically.');
      setForm((current) => ({ ...current, privateNote: '' }));
      setReportOpen(false);
    } catch (submitError) {
      setMessage(submitError instanceof Error ? submitError.message : 'Unable to post this update.');
    } finally {
      setReporting(false);
    }
  }

  async function confirmAlert(alertId: string) {
    setConfirming(alertId);
    setMessage('');
    try {
      const response = await fetch('/api/hub/commute/live/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId }),
      });
      const payload = await response.json() as { alert?: PublicCommuteAlert; error?: { message?: string } };
      if (!response.ok) throw new Error(errorMessage(payload, 'Unable to confirm this update.'));
      if (payload.alert && feed) {
        void mutate({ ...feed, alerts: feed.alerts.map((alert) => alert.alertId === alertId ? payload.alert! : alert) }, false);
      }
    } catch (confirmError) {
      setMessage(confirmError instanceof Error ? confirmError.message : 'Unable to confirm this update.');
    } finally {
      setConfirming('');
    }
  }

  return (
    <section className="hub-panel mb-8 overflow-hidden" aria-labelledby="commute-live-title">
      <div className="border-b border-white/10 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-emerald-400" aria-hidden="true" />
              <h2 id="commute-live-title" className="text-lg font-semibold text-white">Commute pulse</h2>
              <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                Live
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">Recent conditions reported around RTU corridors.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void mutate()}
              className="hub-action-secondary min-h-10 px-3 text-sm"
              aria-label="Refresh commute updates"
            >
              <RefreshCw className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} aria-hidden="true" />
            </button>
            {sessionStatus === 'authenticated' ? (
              <button type="button" onClick={() => setReportOpen((open) => !open)} className="hub-action-primary min-h-10 px-4 text-sm">
                {reportOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {reportOpen ? 'Close' : 'Report update'}
              </button>
            ) : (
              <Link href="/login" className="hub-action-primary min-h-10 px-4 text-sm">Sign in to report</Link>
            )}
          </div>
        </div>
      </div>

      {reportOpen && (
        <form onSubmit={submitReport} className="grid gap-4 border-b border-white/10 bg-slate-950/35 px-5 py-5 sm:grid-cols-3 sm:px-6">
          <label className="text-sm text-slate-300">
            Corridor
            <select
              value={form.corridorId}
              onChange={(event) => setForm({ ...form, corridorId: event.target.value })}
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-white"
            >
              {COMMUTE_LIVE_CORRIDORS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-300">
            Condition
            <select
              value={form.kind}
              onChange={(event) => setForm({ ...form, kind: event.target.value })}
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-white"
            >
              {STUDENT_COMMUTE_ALERT_KINDS.map((kind) => <option key={kind} value={kind}>{KIND_LABELS[kind]}</option>)}
            </select>
          </label>
          <label className="text-sm text-slate-300">
            Impact
            <select
              value={form.severity}
              onChange={(event) => setForm({ ...form, severity: event.target.value })}
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-white"
            >
              <option value="INFO">Minor</option>
              <option value="MODERATE">Moderate</option>
              <option value="SEVERE">Severe</option>
            </select>
          </label>
          <label className="text-sm text-slate-300 sm:col-span-2">
            Note for officers <span className="text-slate-500">(optional, never public)</span>
            <input
              value={form.privateNote}
              onChange={(event) => setForm({ ...form, privateNote: event.target.value })}
              maxLength={300}
              placeholder="Details that help officers verify the update"
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-white placeholder:text-slate-600"
            />
          </label>
          <button type="submit" disabled={reporting} className="hub-action-primary min-h-11 self-end disabled:opacity-60">
            {reporting && <Loader2 className="h-4 w-4 animate-spin" />}
            Post update
          </button>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2 px-5 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => setCorridor('all')}
          className={`hub-mini-chip text-xs ${corridor === 'all' ? 'border-amber-400/40 bg-amber-400/10 text-amber-200' : ''}`}
        >
          All corridors
        </button>
        {COMMUTE_LIVE_CORRIDORS.map((item) => (
          <button
            type="button"
            key={item.id}
            onClick={() => setCorridor(item.id)}
            className={`hub-mini-chip text-xs ${corridor === item.id ? 'border-amber-400/40 bg-amber-400/10 text-amber-200' : ''}`}
          >
            {item.label.replace(' corridor', '')}
          </button>
        ))}
        {feed && <span className="ml-auto text-xs text-slate-500">Updated {minutesAgo(feed.updatedAt)}</span>}
      </div>

      <div className="border-t border-white/10">
        {isLoading && !feed ? (
          <div className="flex items-center gap-2 px-5 py-6 text-sm text-slate-400 sm:px-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading recent conditions…
          </div>
        ) : visibleAlerts.length === 0 ? (
          <div className="px-5 py-6 sm:px-6">
            <p className="text-sm font-medium text-slate-200">No active updates for this corridor.</p>
            <p className="mt-1 text-sm text-slate-500">That means no recent report—not a guarantee that service is normal.</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/10">
            {visibleAlerts.map((alert) => (
              <li key={alert.alertId} className="px-5 py-4 sm:px-6">
                <div className="flex items-start gap-3">
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                    alert.severity === 'SEVERE' ? 'bg-red-400' : alert.severity === 'MODERATE' ? 'bg-amber-400' : 'bg-sky-400'
                  }`} aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="font-semibold text-white">{alert.officialTitle || KIND_LABELS[alert.kind]}</p>
                      <span className="text-xs text-slate-500">{alert.corridorLabel}</span>
                    </div>
                    {alert.officialSummary && <p className="mt-1 text-sm text-slate-300">{alert.officialSummary}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{minutesAgo(alert.createdAt)}</span>
                      {alert.kind === 'OFFICIAL' ? (
                        <a href={alert.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200">
                          Official source <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <span className={alert.confirmationCount > 0 ? 'text-emerald-300' : 'text-amber-300'}>
                          {alert.confirmationCount > 0 ? `${alert.confirmationCount} confirmed` : 'Unconfirmed'}
                        </span>
                      )}
                    </div>
                  </div>
                  {alert.kind !== 'OFFICIAL' && sessionStatus === 'authenticated' && (
                    <button
                      type="button"
                      onClick={() => void confirmAlert(alert.alertId)}
                      disabled={confirming === alert.alertId}
                      className="hub-action-secondary min-h-10 shrink-0 px-3 text-xs disabled:opacity-60"
                    >
                      {confirming === alert.alertId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      <span className="hidden sm:inline">Confirm</span>
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(message || error) && (
        <div className="flex items-start gap-2 border-t border-white/10 px-5 py-3 text-sm text-amber-200 sm:px-6" role="status" aria-live="polite">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{message || 'Showing the last saved update while the network is unavailable.'}</span>
        </div>
      )}
    </section>
  );
}
