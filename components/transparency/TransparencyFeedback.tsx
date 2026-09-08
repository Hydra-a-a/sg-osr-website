'use client';

import { useRef, useState, type FormEvent } from 'react';

type Feedback = { id: string; reportId: string; category: string; message: string; status: string; response: string | null; createdAt: string };
const field = 'mt-2 min-h-11 w-full rounded-lg border border-slate-500 bg-slate-950 px-3 py-2 text-white focus:outline-2 focus:outline-offset-2 focus:outline-sky-400';

export default function TransparencyFeedback({ reportId, projects, allowCreation = true }: { reportId: string; projects: { id: string; title: string }[]; allowCreation?: boolean }) {
    const pending = useRef(false);
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState<Feedback[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState('');

    async function loadFeedback() {
        setLoading(true);
        setLoadError('');
        try {
            const response = await fetch('/api/transparency/feedback/mine', { cache: 'no-store' });
            if (!response.ok) throw new Error('Unable to load feedback. Please retry or sign in again.');
            const data = await response.json();
            setFeedback(data.feedback.filter((item: Feedback) => item.reportId === reportId));
        } catch { setLoadError('Unable to load feedback. Please retry or sign in again.'); }
        finally { setLoading(false); }
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (pending.current) return;
        const form = event.currentTarget;
        const data = new FormData(form);
        pending.current = true;
        setBusy(true);
        setError('');
        setNotice('');
        try {
            const response = await fetch('/api/transparency/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reportId, projectId: data.get('projectId') || null, category: data.get('category'), message: data.get('message') }) });
            if (!response.ok) {
                setError(response.status === 429 ? 'Too many requests. Wait a moment before trying again.' : response.status === 401 || response.status === 403 ? 'Sign in with your RTU account again before sending feedback.' : 'Feedback could not be sent. Your message is still here; please try again.');
                return;
            }
            form.reset();
            setNotice('Feedback sent privately. Use My feedback to check its status and officer replies.');
            await loadFeedback();
        } catch { setError('The connection was interrupted. Your message is still here. Check My feedback before retrying to avoid a duplicate.'); }
        finally { pending.current = false; setBusy(false); }
    }

    return <div className="mt-6 max-w-3xl space-y-8">
        {allowCreation ? <form onSubmit={submit} className="space-y-4">
            <fieldset disabled={busy} className="space-y-4 disabled:opacity-70"><legend className="sr-only">Send private report feedback</legend>
                <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm text-slate-200">Category<select name="category" className={field}><option value="QUESTION">Question</option><option value="CORRECTION">Correction</option><option value="MISSING_INFORMATION">Missing information</option><option value="OTHER">Other</option></select></label><label className="text-sm text-slate-200">Project (optional)<select name="projectId" className={field}><option value="">Whole report</option>{projects.map(project => <option key={project.id} value={project.id}>{project.title}</option>)}</select></label></div>
                <label className="block text-sm text-slate-200">Message<textarea name="message" required minLength={10} maxLength={4000} rows={5} className={field} /></label>
                <button type="submit" className="min-h-11 rounded-lg bg-sky-300 px-4 font-semibold text-slate-950">{busy ? 'Sending…' : 'Send private feedback'}</button>
            </fieldset>
            {notice ? <p role="status" className="text-emerald-300">{notice}</p> : null}{error ? <p role="alert" className="text-amber-300">{error}</p> : null}
        </form> : null}
        <section aria-labelledby="my-feedback-heading"><div className="flex flex-wrap items-center gap-4"><h3 id="my-feedback-heading" className="text-xl font-semibold text-white">My feedback</h3><button type="button" disabled={loading} onClick={loadFeedback} className="min-h-11 text-sky-300 underline underline-offset-4 disabled:opacity-60">{loading ? 'Loading…' : feedback ? 'Refresh feedback' : 'Load my feedback'}</button></div>
            {loadError ? <p role="alert" className="mt-3 text-amber-300">{loadError}</p> : null}
            {feedback?.length === 0 ? <p className="mt-3 text-slate-300">You have no feedback on this report.</p> : null}
            {feedback?.map(item => <article key={item.id} className="mt-4 space-y-3 border-t border-white/15 py-4"><p className="text-sm font-semibold text-sky-200">{item.status.replaceAll('_', ' ')} · {item.category.replaceAll('_', ' ')}</p><p className="whitespace-pre-wrap text-slate-200">{item.message}</p>{item.response ? <div className="border-l-2 border-sky-300 pl-4"><h4 className="font-semibold text-white">Officer reply</h4><p className="mt-2 whitespace-pre-wrap text-slate-300">{item.response}</p></div> : <p className="text-sm text-slate-400">No officer reply yet.</p>}</article>)}
        </section>
    </div>;
}
