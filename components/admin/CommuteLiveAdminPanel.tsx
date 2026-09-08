'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { ExternalLink, Loader2, Radio, ShieldCheck } from 'lucide-react';
import { COMMUTE_LIVE_CORRIDORS } from '@/schemas/commute-live';

type WindowMetric = {
  days: number;
  studentReports: number;
  confirmations: number;
  officialUpdates: number;
  activeStudents: number;
  corridors: number;
};

type AdminAlert = {
  alertId: string;
  corridorLabel: string;
  kind: string;
  severity: string;
  reporterEmail: string;
  privateNote: string;
  officialTitle: string;
  officialSummary: string;
  sourceUrl: string;
  confirmationCount: number;
  createdAt: string;
  expiresAt: string;
};

type AdminResponse = { success: true; windows: WindowMetric[]; alerts: AdminAlert[] };

async function fetchSnapshot(url: string): Promise<AdminResponse> {
  const response = await fetch(url, { cache: 'no-store' });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || 'Unable to load commute pulse.');
  return payload;
}

export default function CommuteLiveAdminPanel() {
  const { data, error, isLoading, mutate } = useSWR<AdminResponse>('/api/admin/commute-live', fetchSnapshot);
  const [formOpen, setFormOpen] = useState(false);
  const [pending, setPending] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState<{
    corridorId: string;
    title: string;
    summary: string;
    sourceUrl: string;
    durationMinutes: number;
  }>({
    corridorId: COMMUTE_LIVE_CORRIDORS[0].id,
    title: '',
    summary: '',
    sourceUrl: '',
    durationMinutes: 180,
  });

  async function publish(event: React.FormEvent) {
    event.preventDefault();
    setPending('publish');
    setMessage('');
    try {
      const response = await fetch('/api/admin/commute-live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || 'Unable to publish the update.');
      setForm((current) => ({ ...current, title: '', summary: '', sourceUrl: '' }));
      setFormOpen(false);
      setMessage('Official update published.');
      await mutate();
    } catch (publishError) {
      setMessage(publishError instanceof Error ? publishError.message : 'Unable to publish the update.');
    } finally {
      setPending('');
    }
  }

  async function moderate(alertId: string, action: 'RESOLVE' | 'HIDE') {
    setPending(alertId);
    setMessage('');
    try {
      const response = await fetch('/api/admin/commute-live', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertId, action }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.message || 'Unable to update this report.');
      await mutate();
    } catch (moderationError) {
      setMessage(moderationError instanceof Error ? moderationError.message : 'Unable to update this report.');
    } finally {
      setPending('');
    }
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 sm:p-5" aria-labelledby="commute-pulse-admin-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="h-4 w-4 text-emerald-400" />
            <h2 id="commute-pulse-admin-title" className="text-lg font-semibold text-white">Commute pulse</h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">Moderate active reports and publish sourced transport notices.</p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen((open) => !open)}
          className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-400/15"
        >
          {formOpen ? 'Close' : 'Publish official update'}
        </button>
      </div>

      {formOpen && (
        <form onSubmit={publish} className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2">
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
            Duration
            <select
              value={form.durationMinutes}
              onChange={(event) => setForm({ ...form, durationMinutes: Number(event.target.value) })}
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-white"
            >
              <option value={60}>1 hour</option>
              <option value={180}>3 hours</option>
              <option value={360}>6 hours</option>
              <option value={1440}>24 hours</option>
            </select>
          </label>
          <label className="text-sm text-slate-300 sm:col-span-2">
            Headline
            <input
              required
              maxLength={100}
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-white"
            />
          </label>
          <label className="text-sm text-slate-300 sm:col-span-2">
            Summary
            <textarea
              required
              maxLength={240}
              rows={2}
              value={form.summary}
              onChange={(event) => setForm({ ...form, summary: event.target.value })}
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-white"
            />
          </label>
          <label className="text-sm text-slate-300 sm:col-span-2">
            Official source URL
            <input
              required
              type="url"
              value={form.sourceUrl}
              onChange={(event) => setForm({ ...form, sourceUrl: event.target.value })}
              placeholder="https://mmda.gov.ph/..."
              className="mt-1.5 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-white placeholder:text-slate-600"
            />
          </label>
          <button type="submit" disabled={pending === 'publish'} className="rounded-lg bg-amber-500 px-4 py-2.5 font-semibold text-slate-950 disabled:opacity-60 sm:col-start-2">
            {pending === 'publish' ? 'Publishing…' : 'Publish update'}
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Loading commute pulse…</div>
      ) : data ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {data.windows.map((metric) => (
              <div key={metric.days} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last {metric.days} days</p>
                <p className="mt-2 text-2xl font-semibold text-white">{metric.studentReports + metric.confirmations}</p>
                <p className="text-xs text-slate-400">student actions</p>
                <p className="mt-2 text-xs text-slate-500">{metric.activeStudents} students · {metric.corridors} corridors · {metric.officialUpdates} official</p>
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="font-semibold text-white">Active updates</h3>
              <span className="text-xs text-slate-500">{data.alerts.length} active</span>
            </div>
            {data.alerts.length === 0 ? (
              <p className="text-sm text-slate-400">No active commute updates.</p>
            ) : (
              <div className="space-y-2">
                {data.alerts.map((alert) => (
                  <article key={alert.alertId} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-white">{alert.officialTitle || alert.kind}</p>
                          <span className="text-xs text-slate-500">{alert.corridorLabel}</span>
                        </div>
                        {alert.officialSummary && <p className="mt-1 text-sm text-slate-300">{alert.officialSummary}</p>}
                        <p className="mt-1 text-xs text-slate-500">{alert.reporterEmail} · {alert.confirmationCount} confirmations</p>
                        {alert.privateNote && <p className="mt-2 rounded-lg bg-slate-900/80 px-2.5 py-2 text-sm text-slate-300">Officer note: {alert.privateNote}</p>}
                        {alert.sourceUrl && (
                          <a href={alert.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-sky-300">
                            Verify source <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => void moderate(alert.alertId, 'RESOLVE')}
                          disabled={pending === alert.alertId}
                          className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-3 text-xs font-semibold text-emerald-200 disabled:opacity-60"
                        >
                          <ShieldCheck className="h-4 w-4" />Resolve
                        </button>
                        <button
                          type="button"
                          onClick={() => void moderate(alert.alertId, 'HIDE')}
                          disabled={pending === alert.alertId}
                          className="min-h-10 rounded-lg border border-red-400/25 bg-red-400/10 px-3 text-xs font-semibold text-red-200 disabled:opacity-60"
                        >
                          Hide
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}

      {(error || message) && <p className="mt-4 text-sm text-amber-200" role="status">{message || error?.message}</p>}
    </section>
  );
}
