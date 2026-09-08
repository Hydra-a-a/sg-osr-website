'use client';

import { useState } from 'react';
import useSWR from 'swr';
import type { z } from 'zod';
import { reportMetadataSchema, budgetLineSchema, budgetTotals } from '@/schemas/transparency';
import AdminDataGrid from './AdminDataGrid';
import AdminInspector from './AdminInspector';
import { AdminTabs } from './AdminTabs';
import { AdminPageShell, AdminActionButton, AdminNotice } from './AdminPageShell';
import useAdminUnsavedChanges from './useAdminUnsavedChanges';

type Metadata = z.infer<typeof reportMetadataSchema>;
type Line = z.infer<typeof budgetLineSchema>;
type Report = Metadata & { id: string; slug: string; version: number; status: string; preparerEmail: string | null; publisherEmail: string | null; pdfFileId: string | null; pdfFileName: string; predecessorId: string | null; lines: Line[]; withdrawalReason: string; reviewNote: string };
type Intake = { id: string; title: string; leaderName: string; leaderEmail: string; submittedLink: string; status: string; reviewNote: string; reportId: string | null; updatedAt: string; classroomSubmissionId: string | null };
type Feedback = { id: string; report: { title: string }; submitterName: string; submitterEmail: string; category: string; message: string; status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED'; response: string; createdAt: string };
type Snapshot = { submissions: Intake[]; reports: Report[]; feedback: Feedback[] };
const input = 'mt-1 min-h-11 w-full border border-white/20 bg-[#101d31] px-3 py-2 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:opacity-70';
const blankLine = (): Line => ({ projectTitle: '', projectCode: '', category: '', publicNote: '', allocated: '0.00', spent: '0.00' });
function editReport(report: Report): Report { return { ...report, periodStart: report.periodStart.slice(0, 10), periodEnd: report.periodEnd.slice(0, 10), asOfDate: report.asOfDate.slice(0, 10), lines: report.lines.map(line => ({ ...line })) }; }
async function request(url: string, options?: RequestInit) {
    const response = await fetch(url, { cache: 'no-store', ...options });
    const result = await response.json();
    if (!response.ok || result.success === false) throw new Error(result.error?.message || (response.status === 409 ? 'This record changed. Reload it before continuing.' : 'Unable to complete this request. Try again.'));
    return result;
}
function sourceHref(value: string) { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : undefined; } catch { return undefined; } }

export default function TransparencyAdminWorkspace({ officerEmail }: { officerEmail: string }) {
    const { data, error, isLoading, mutate } = useSWR<Snapshot>('/api/admin/transparency', request, { revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false });
    const [tab, setTab] = useState('intake');
    const [intake, setIntake] = useState<Intake | null>(null);
    const [report, setReport] = useState<Report | null>(null);
    const [feedback, setFeedback] = useState<Feedback | null>(null);
    const [dirty, setDirty] = useState(false);
    const [pending, setPending] = useState(false);
    const [message, setMessage] = useState('');
    const [failure, setFailure] = useState('');
    const [predecessor, setPredecessor] = useState('');
    const [reason, setReason] = useState('');
    const [approved, setApproved] = useState(false);
    const [reconcileId, setReconcileId] = useState('');
    const [reconcileStatus, setReconcileStatus] = useState<'SUBMITTED' | 'FAILED'>('SUBMITTED');
    const { runGuarded } = useAdminUnsavedChanges({ isDirty: dirty });
    function close() { if (!pending) runGuarded(() => { setIntake(null); setReport(null); setFeedback(null); setDirty(false); setFailure(''); }); }
    function selectReport(row: Report) { runGuarded(() => { setReport(editReport(row)); setIntake(null); setFeedback(null); setDirty(false); setApproved(false); setReason(''); setFailure(''); }); }
    function patchReport(patch: Partial<Report>) { setReport(current => current ? { ...current, ...patch } : null); setDirty(true); }
    async function perform(url: string, body: unknown, method = 'PATCH', multipart = false) {
        setPending(true); setFailure(''); setMessage('');
        try {
            const result = await request(url, { method, ...(multipart ? {} : { headers: { 'Content-Type': 'application/json' } }), body: multipart ? body as FormData : JSON.stringify(body) });
            if (result.report) { setReport(editReport(result.report)); setIntake(null); setFeedback(null); setTab('reports'); }
            if (result.submission) setIntake(result.submission);
            setDirty(false); setApproved(false); setReason(''); setMessage('Changes saved.');
            await mutate();
        } catch (cause) { setFailure(cause instanceof Error ? cause.message : 'Unable to save. Your input has been retained.'); }
        finally { setPending(false); }
    }
    function reportAction(action: 'save' | 'ready' | 'publish' | 'changes' | 'withdraw') {
        if (!report) return;
        if (action === 'save') {
            const metadata = reportMetadataSchema.safeParse(report);
            const lines = budgetLineSchema.array().max(300).safeParse(report.lines);
            if (!metadata.success || !lines.success) { setFailure(!metadata.success ? metadata.error.issues[0].message : !lines.success ? `Project rows: ${lines.error.issues[0].message}` : 'Check this report.'); return; }
            void perform('/api/admin/transparency', { id: report.id, version: report.version, action, metadata: metadata.data, lines: lines.data });
        } else {
            if (action === 'publish' && !window.confirm('Publish this approved report and its PDF for everyone to view?')) return;
            if (action === 'withdraw' && !window.confirm('Withdraw this report immediately? Its PDF will become unavailable and your reason will remain public.')) return;
            void perform('/api/admin/transparency', { id: report.id, version: report.version, action, reason, approvedForPublicRelease: approved });
        }
    }
    const locked = report?.status !== 'DRAFT';
    const currentReports = data?.reports.filter(row => ['PUBLISHED', 'WITHDRAWN'].includes(row.status)) || [];
    const validAmounts = report?.lines.every(line => budgetLineSchema.safeParse(line).success);
    const totals = report && validAmounts ? budgetTotals(report.lines) : null;
    return <AdminPageShell title="SSC transparency" actions={<a href="/transparency" className="min-h-11 border border-white/20 px-4 py-2.5 text-sm">Open public portal</a>}>
        <div className="mt-6 space-y-4">
            {error ? <AdminNotice tone="danger" role="alert">Unable to load transparency records. <button className="underline" onClick={() => void mutate()}>Retry</button></AdminNotice> : null}
            {message ? <p role="status" className="text-sm text-emerald-200">{message}</p> : null}
            {isLoading ? <div role="status" aria-label="Loading transparency records" className="space-y-3 motion-safe:animate-pulse"><div className="h-11 bg-white/10" /><div className="h-64 bg-white/5" /></div> : <AdminTabs value={tab} onValueChange={value => runGuarded(() => { setTab(value); setDirty(false); setIntake(null); setReport(null); setFeedback(null); })} label="Transparency queues" items={[
                { id: 'intake', label: 'Intake', count: data?.submissions.length, panel: <div className="pt-5"><AdminDataGrid rows={data?.submissions || []} adapter={{ getId: row => row.id, getSearchText: row => `${row.title} ${row.leaderName} ${row.leaderEmail} ${row.status}` }} columns={[{ key: 'title', label: 'Report', sortable: true, getValue: row => row.title }, { key: 'leader', label: 'Leader', getValue: row => row.leaderName || row.leaderEmail }, { key: 'status', label: 'Status', sortable: true, getValue: row => row.status }]} onSelect={row => runGuarded(() => { setIntake(row); setReport(null); setFeedback(null); setPredecessor(''); setReason(''); setReconcileId(row.classroomSubmissionId || ''); setFailure(''); setDirty(false); })} searchPlaceholder="Search intake" emptyMessage="No portal submissions yet." /></div> },
                { id: 'reports', label: 'Financial reports', count: data?.reports.length, panel: <div className="pt-5"><AdminDataGrid rows={data?.reports || []} adapter={{ getId: row => row.id, getSearchText: row => `${row.title} ${row.academicYearStart} ${row.status}` }} columns={[{ key: 'title', label: 'Report', getValue: row => row.title, sortable: true }, { key: 'year', label: 'Academic year', getValue: row => `${row.academicYearStart}–${row.academicYearStart + 1}`, sortable: true }, { key: 'status', label: 'Status', getValue: row => row.status, sortable: true }, { key: 'preparer', label: 'Preparer', priority: 'secondary', getValue: row => row.preparerEmail || 'Not ready' }]} onSelect={selectReport} searchPlaceholder="Search financial reports" emptyMessage="Create a draft from a submitted intake record." /></div> },
                { id: 'feedback', label: 'Student feedback', count: data?.feedback.length, panel: <div className="pt-5"><AdminDataGrid rows={data?.feedback || []} adapter={{ getId: row => row.id, getSearchText: row => `${row.report.title} ${row.submitterName} ${row.category} ${row.status} ${row.message}` }} columns={[{ key: 'report', label: 'Report', getValue: row => row.report.title }, { key: 'category', label: 'Category', getValue: row => row.category }, { key: 'status', label: 'Status', getValue: row => row.status, sortable: true }, { key: 'date', label: 'Received', getValue: row => row.createdAt.slice(0, 10), sortable: true }]} onSelect={row => runGuarded(() => { setFeedback({ ...row }); setIntake(null); setReport(null); setFailure(''); setDirty(false); })} searchPlaceholder="Search private feedback" emptyMessage="No student feedback yet." /></div> },
            ]} />}
        </div>
        <AdminInspector mode="drawer" open={!!intake || !!report || !!feedback} onClose={close} title={report?.title || intake?.title || 'Student feedback'} closeOnBackdrop={!pending} closeOnEscape={!pending}>
            <div className="space-y-6 text-sm text-slate-200">
                {failure ? <AdminNotice role="alert" tone="danger">{failure} <button className="underline" disabled={pending} onClick={() => runGuarded(async () => { const fresh = await mutate(); if (report) { const row = fresh?.reports.find(candidate => candidate.id === report.id); if (row) selectReport(row); } })}>Reload records</button></AdminNotice> : null}
                {intake ? <>
                    <dl className="grid gap-2"><dt>Status</dt><dd>{intake.status}</dd><dt>Leader</dt><dd>{intake.leaderName} · {intake.leaderEmail}</dd></dl>
                    {sourceHref(intake.submittedLink) ? <a className="inline-block min-h-11 py-3 text-amber-200 underline" href={sourceHref(intake.submittedLink)} target="_blank" rel="noopener noreferrer">Open submitted source</a> : <p>Source link unavailable.</p>}
                    {intake.reviewNote ? <AdminNotice tone="warning">{intake.reviewNote}</AdminNotice> : null}
                    {intake.reportId ? <AdminActionButton onClick={() => { const row = data?.reports.find(item => item.id === intake.reportId); if (row) selectReport(row); }}>Open resulting report</AdminActionButton> : intake.status === 'SUBMITTED' ? <>
                        <label className="block">Correction of<select className={input} value={predecessor} onChange={event => setPredecessor(event.target.value)}><option value="">New report</option>{currentReports.map(row => <option key={row.id} value={row.id}>{row.title} ({row.status})</option>)}</select></label>
                        <AdminActionButton disabled={pending} onClick={() => void perform('/api/admin/transparency', { submissionId: intake.id, ...(predecessor ? { predecessorId: predecessor } : {}) }, 'POST')}>Create draft</AdminActionButton>
                    </> : null}
                    {intake.status === 'RECONCILIATION' ? <form onSubmit={event => { event.preventDefault(); void perform('/api/admin/transparency/intake', { id: intake.id, status: reconcileStatus, reviewNote: reason, classroomSubmissionId: reconcileId, expectedUpdatedAt: intake.updatedAt }); }} className="space-y-4">
                        <AdminNotice tone="warning">Verify the submission directly in Classroom before reconciling. Reconciliation becomes available five minutes after the last update.</AdminNotice>
                        <label className="block">Verified outcome<select className={input} value={reconcileStatus} onChange={event => setReconcileStatus(event.target.value as typeof reconcileStatus)}><option value="SUBMITTED">Submitted in Classroom</option><option value="FAILED">Not submitted</option></select></label>
                        <label className="block">Classroom submission ID<input className={input} value={reconcileId} required={reconcileStatus === 'SUBMITTED'} onChange={event => { setReconcileId(event.target.value); setDirty(true); }} /></label>
                        <label className="block">Verification note<textarea className={input} required minLength={5} maxLength={2000} value={reason} onChange={event => { setReason(event.target.value); setDirty(true); }} /></label>
                        <AdminActionButton type="submit" disabled={pending || Date.now() - new Date(intake.updatedAt).getTime() < 300000}>Confirm reconciliation</AdminActionButton>
                    </form> : null}
                </> : null}
                {report ? <>
                    <p>{report.status} · Version {report.version}</p>
                    {locked ? <AdminNotice>{report.status === 'READY' ? `Ready drafts are locked. A different active officer must publish. Preparer: ${report.preparerEmail || 'Unknown'}.` : 'Published history is immutable. Create a correction from a new submitted intake record.'}</AdminNotice> : null}
                    {report.reviewNote ? <AdminNotice tone="warning">{report.reviewNote}</AdminNotice> : null}
                    {report.withdrawalReason ? <AdminNotice tone="danger">Withdrawal reason: {report.withdrawalReason}</AdminNotice> : null}
                    <form onSubmit={event => { event.preventDefault(); reportAction('save'); }} className="space-y-6">
                        <fieldset disabled={locked || pending} className="grid gap-4 sm:grid-cols-2">
                            <legend className="mb-4 text-lg font-semibold text-white">Report details</legend>
                            <label className="sm:col-span-2">Title<input className={input} required minLength={3} maxLength={200} value={report.title} onChange={event => patchReport({ title: event.target.value })} /></label>
                            <label>Academic year starts<input type="number" className={input} min={2000} max={2100} required value={report.academicYearStart} onChange={event => patchReport({ academicYearStart: Number(event.target.value) })} /></label>
                            <label>Period type<select className={input} value={report.periodKind} onChange={event => patchReport({ periodKind: event.target.value as Report['periodKind'], periodNumber: event.target.value === 'ANNUAL' ? null : 1 })}>{['ANNUAL', 'SEMESTER', 'QUARTER', 'MONTH'].map(kind => <option key={kind}>{kind}</option>)}</select></label>
                            {report.periodKind !== 'ANNUAL' ? <label>Period number<input className={input} type="number" required min={1} max={{ ANNUAL: 1, SEMESTER: 2, QUARTER: 4, MONTH: 12 }[report.periodKind]} value={report.periodNumber ?? 1} onChange={event => patchReport({ periodNumber: Number(event.target.value) })} /></label> : null}
                            {(['periodStart', 'periodEnd', 'asOfDate'] as const).map((key, index) => <label key={key}>{['Period starts', 'Period ends', 'As of date'][index]}<input className={input} required type="date" value={report[key]} onChange={event => patchReport({ [key]: event.target.value })} /></label>)}
                            <label className="sm:col-span-2">Public report notes<textarea className={input} rows={3} maxLength={10000} value={report.notes || ''} onChange={event => patchReport({ notes: event.target.value })} /></label>
                            {report.predecessorId ? <label className="sm:col-span-2">Public correction reason<textarea className={input} required minLength={5} maxLength={2000} value={report.correctionReason || ''} onChange={event => patchReport({ correctionReason: event.target.value })} /></label> : null}
                        </fieldset>
                        <fieldset disabled={locked || pending} className="space-y-5">
                            <legend className="mb-3 text-lg font-semibold text-white">Project rows</legend>
                            <p>The approved PDF is the canonical record. These figures are its student-readable representation.</p>
                            {report.lines.map((line, index) => <fieldset key={index} className="grid gap-3 border-t border-white/15 pt-4 sm:grid-cols-2"><legend className="px-1 font-semibold">Project {index + 1}</legend>
                                {(['projectTitle', 'projectCode', 'category', 'allocated', 'spent', 'publicNote'] as const).map((key, fieldIndex) => <label key={key} className={key === 'publicNote' ? 'sm:col-span-2' : ''}>{['Project name', 'Project code (optional)', 'Category', 'Allocated (PHP)', 'Spent (PHP)', 'Public note / variance explanation'][fieldIndex]}<input className={input} required={['projectTitle', 'category', 'allocated', 'spent'].includes(key)} inputMode={key === 'allocated' || key === 'spent' ? 'decimal' : 'text'} maxLength={key === 'publicNote' ? 2000 : key === 'projectCode' ? 50 : key === 'category' ? 100 : 200} value={line[key]} onChange={event => patchReport({ lines: report.lines.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: event.target.value } : row) })} /></label>)}
                                <p className="sm:col-span-2 text-xs text-amber-100">Spending above allocation requires a public explanation of at least 10 characters.</p>
                                {!locked ? <AdminActionButton onClick={() => patchReport({ lines: report.lines.filter((_, rowIndex) => rowIndex !== index) })}>Remove project {index + 1}</AdminActionButton> : null}
                            </fieldset>)}
                            {!locked ? <AdminActionButton disabled={report.lines.length >= 300} onClick={() => patchReport({ lines: [...report.lines, blankLine()] })}>Add project</AdminActionButton> : null}
                        </fieldset>
                        {totals ? <p>Allocated PHP {totals.allocated} · Spent PHP {totals.spent} · Balance PHP {totals.balance} · Utilization {totals.utilization === null ? 'unavailable' : `${totals.utilization}%`}</p> : null}
                        {!locked ? <AdminActionButton type="submit" disabled={pending || !dirty}>Save draft</AdminActionButton> : null}
                    </form>
                    <section className="space-y-3 border-t border-white/15 pt-4"><h3 className="text-lg font-semibold">Approved PDF</h3>
                        {report.pdfFileId ? <a className="inline-block min-h-11 py-3 text-amber-200 underline" target="_blank" rel="noopener noreferrer" href={`/api/admin/transparency/pdf?id=${encodeURIComponent(report.id)}`}>View {report.pdfFileName || 'approved PDF'}</a> : <p>No approved PDF uploaded.</p>}
                        {!locked ? <label className="block">{report.pdfFileId ? 'Replace PDF' : 'Upload PDF'} (PDF only, maximum 20 MB)<input className={input} type="file" accept="application/pdf,.pdf" disabled={pending || dirty} onChange={event => { const file = event.target.files?.[0]; if (!file) return; if (file.size > 20 * 1024 * 1024) { setFailure('PDF must be at most 20 MB.'); return; } const form = new FormData(); form.set('id', report.id); form.set('version', String(report.version)); form.set('file', file); void perform('/api/admin/transparency/pdf', form, 'POST', true); event.target.value = ''; }} />{dirty ? <span>Save your draft before uploading or marking ready.</span> : null}</label> : null}
                    </section>
                    {report.status === 'DRAFT' ? <AdminActionButton disabled={pending || dirty || !report.pdfFileId || !report.lines.length} onClick={() => reportAction('ready')}>Mark ready for second-officer review</AdminActionButton> : null}
                    {report.status === 'READY' ? <div className="space-y-4">
                        <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 size-5" checked={approved} onChange={event => setApproved(event.target.checked)} />I reviewed the PDF and figures. The document is approved for public release and contains no private student data.</label>
                        <AdminActionButton disabled={pending || !approved || report.preparerEmail?.toLowerCase() === officerEmail.toLowerCase()} onClick={() => reportAction('publish')}>Publish report</AdminActionButton>
                        {report.preparerEmail?.toLowerCase() === officerEmail.toLowerCase() ? <p>A different active officer must publish your prepared report.</p> : null}
                    </div> : null}
                    {['READY', 'PUBLISHED', 'SUPERSEDED'].includes(report.status) ? <div className="space-y-3 border-t border-white/15 pt-4"><label className="block">{report.status === 'READY' ? 'Requested changes' : 'Public emergency withdrawal reason'}<textarea className={input} minLength={5} maxLength={2000} value={reason} onChange={event => setReason(event.target.value)} /></label><AdminActionButton disabled={pending || reason.trim().length < 5} onClick={() => reportAction(report.status === 'READY' ? 'changes' : 'withdraw')}>{report.status === 'READY' ? 'Return to draft' : 'Withdraw immediately'}</AdminActionButton></div> : null}
                </> : null}
                {feedback ? <form className="space-y-4" onSubmit={event => { event.preventDefault(); void perform('/api/admin/transparency/feedback', { id: feedback.id, status: feedback.status, response: feedback.response || '' }); }}>
                    <p className="font-semibold">{feedback.report.title}</p><p>{feedback.submitterName} · {feedback.submitterEmail}</p><p>{feedback.category} · {feedback.createdAt.slice(0, 10)}</p><p className="whitespace-pre-wrap break-words">{feedback.message}</p>
                    <AdminNotice>Your response is private and visible only to the submitting student and authorized officers.</AdminNotice>
                    <label className="block">Status<select className={input} disabled={pending} value={feedback.status} onChange={event => { setFeedback({ ...feedback, status: event.target.value as Feedback['status'] }); setDirty(true); }}>{['OPEN', 'IN_REVIEW', 'RESOLVED'].map(status => <option key={status}>{status}</option>)}</select></label>
                    <label className="block">Private response<textarea className={input} disabled={pending} rows={5} maxLength={4000} value={feedback.response || ''} onChange={event => { setFeedback({ ...feedback, response: event.target.value }); setDirty(true); }} /></label>
                    <AdminActionButton type="submit" disabled={pending || !dirty}>Save response and status</AdminActionButton>
                </form> : null}
                {pending ? <p role="status">Saving…</p> : null}
            </div>
        </AdminInspector>
    </AdminPageShell>;
}
