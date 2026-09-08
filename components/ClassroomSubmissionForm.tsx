'use client';

import { useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import useSWR from 'swr';
import Link from 'next/link';
import { hasLeaderPrivilege } from '@/lib/portal-mode';
import { formatClassroomDueDateTime } from '@/lib/date-time';
import { ClassroomSubmissionSchema } from '@/schemas/classroom';

type Course = { id: string; name: string; section?: string };
type CourseWork = { id: string; title: string; associatedWithDeveloper?: boolean; dueDate?: { year?: number; month?: number; day?: number }; dueTime?: { hours?: number; minutes?: number } };
const fetcher = async (url: string) => {
    const response = await fetch(url, { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(typeof body.error === 'string' ? body.error : 'Classroom is temporarily unavailable.');
    return body;
};

export default function ClassroomSubmissionForm() {
    const { data: session, status } = useSession();
    const [courseId, setCourseId] = useState('');
    const [courseWorkId, setCourseWorkId] = useState('');
    const [periodKind, setPeriodKind] = useState('ANNUAL');
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
    const attempt = useRef<{ payload: string; key: string } | null>(null);
    const pending = useRef(false);
    const leader = status === 'authenticated' && hasLeaderPrivilege(session?.user?.role);
    const { data: coursesData, error: coursesError, isLoading: coursesLoading } = useSWR(leader ? '/api/classroom/courses' : null, fetcher, { revalidateOnFocus: false });
    const { data: workData, error: workError, isLoading: workLoading } = useSWR(leader && courseId ? `/api/classroom/courses/${encodeURIComponent(courseId)}/coursework` : null, fetcher, { revalidateOnFocus: false });
    const courses: Course[] = coursesData?.data || [];
    const coursework: CourseWork[] = workData?.data || [];
    const selectedWork = coursework.find(item => item.id === courseWorkId);

    async function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (pending.current) return;
        const form = event.currentTarget;
        const values = new FormData(form);
        const parsed = ClassroomSubmissionSchema.safeParse({
            courseId, courseWorkId, title: values.get('title'), linkUrl: values.get('linkUrl'),
            academicYearStart: Number(values.get('academicYearStart')), periodKind,
            periodNumber: periodKind === 'ANNUAL' ? null : Number(values.get('periodNumber')),
            periodStart: values.get('periodStart'), periodEnd: values.get('periodEnd'),
            turnIn: values.get('turnIn') === 'on',
        });
        if (!parsed.success) {
            setResult({ success: false, message: parsed.error.issues[0]?.message || 'Check the report details.' });
            return;
        }
        const payload = JSON.stringify(parsed.data);
        if (!attempt.current || attempt.current.payload !== payload) attempt.current = { payload, key: crypto.randomUUID() };
        pending.current = true;
        setSubmitting(true);
        setResult(null);
        try {
            const response = await fetch('/api/classroom/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': attempt.current.key }, body: payload });
            const body = await response.json();
            if (!response.ok) {
                setResult({ success: false, message: typeof body.error === 'string' ? body.error : 'Submission failed. Retry with the same details.' });
                return;
            }
            setResult({ success: true, message: `Private submission ${body.transparencySubmissionId} recorded. ${parsed.data.turnIn ? 'The source was attached and turned in to Classroom.' : 'The source was attached. Turn it in through Classroom when ready.'} Publication requires officer review.` });
            // Keep the successful reference so a repeated click cannot attach the same payload twice.
        } catch {
            setResult({ success: false, message: 'The response could not be confirmed. Keep these details and retry to check the same submission.' });
        } finally {
            pending.current = false;
            setSubmitting(false);
        }
    }

    if (status === 'loading') return <div className="h-48 animate-pulse rounded-xl bg-inset motion-reduce:animate-none" role="status" aria-label="Loading submission access" />;
    if (status !== 'authenticated') return <Link className="btn-primary" href={`/login?callbackUrl=${encodeURIComponent('/transparency/submit')}`}>Sign in with RTU</Link>;
    if (!leader) return <p>Student leader access is required to submit an SSC report.</p>;

    return <form onSubmit={submit} className="space-y-6">
        <p className="text-sm text-muted">Supreme Student Council. Submitted sources and your identity remain private to authorized officers.</p>
        <fieldset disabled={submitting} className="space-y-5">
            <legend className="sr-only">SSC report submission</legend>
            <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm font-medium">Classroom course
                    <select name="courseId" required value={courseId} onChange={event => { setCourseId(event.target.value); setCourseWorkId(''); }} className="field-input mt-2" disabled={coursesLoading}>
                        <option value="">{coursesLoading ? 'Loading courses…' : 'Select course'}</option>
                        {courses.map(course => <option key={course.id} value={course.id}>{course.name}{course.section ? ` — ${course.section}` : ''}</option>)}
                    </select>
                </label>
                <label className="block text-sm font-medium">Coursework
                    <select name="courseWorkId" required value={courseWorkId} onChange={event => setCourseWorkId(event.target.value)} className="field-input mt-2" disabled={!courseId || workLoading}>
                        <option value="">{workLoading ? 'Loading coursework…' : 'Select coursework'}</option>
                        {coursework.map(work => <option key={work.id} value={work.id} disabled={work.associatedWithDeveloper === false}>{work.title}{work.associatedWithDeveloper === false ? ' (submit in Classroom)' : ''}</option>)}
                    </select>
                </label>
            </div>
            {(coursesError || workError) && <p role="alert" className="text-sm text-danger">{coursesError?.message || workError?.message} Check Classroom permissions and your current access mode.</p>}
            {!coursesLoading && !coursesError && courses.length === 0 && <p>No active courses are available for this account.</p>}
            {courseId && !workLoading && !workError && coursework.length === 0 && <p>No coursework is available for this course.</p>}
            {selectedWork && <p className="text-sm text-muted">Due: {formatClassroomDueDateTime(selectedWork.dueDate, selectedWork.dueTime)}</p>}
            <label className="block text-sm font-medium">Report title<input name="title" required minLength={3} maxLength={200} className="field-input mt-2" /></label>
            <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-sm font-medium">Academic year begins<input name="academicYearStart" type="number" min={2000} max={2100} defaultValue={new Date().getFullYear()} required className="field-input mt-2" /><span className="text-xs text-muted">For 2026–2027, enter 2026.</span></label>
                <label className="block text-sm font-medium">Period type<select name="periodKind" value={periodKind} onChange={event => setPeriodKind(event.target.value)} className="field-input mt-2"><option value="ANNUAL">Annual</option><option value="SEMESTER">Semester</option><option value="QUARTER">Quarter</option><option value="MONTH">Month</option></select></label>
                {periodKind !== 'ANNUAL' && <label className="block text-sm font-medium">Period number<input key={periodKind} name="periodNumber" type="number" min={1} max={periodKind === 'SEMESTER' ? 2 : periodKind === 'QUARTER' ? 4 : 12} required className="field-input mt-2" /></label>}
                <label className="block text-sm font-medium">Period starts<input name="periodStart" type="date" required className="field-input mt-2" /></label>
                <label className="block text-sm font-medium">Period ends<input name="periodEnd" type="date" required className="field-input mt-2" /></label>
            </div>
            <label className="block text-sm font-medium">Private report source link<input name="linkUrl" type="url" required placeholder="https://docs.google.com/…" className="field-input mt-2" /><span className="text-xs text-muted">Use HTTPS and grant the reviewing officers access to the source.</span></label>
            <label className="flex items-center gap-3 text-sm"><input name="turnIn" type="checkbox" defaultChecked />Turn in to Classroom after attaching the source</label>
        </fieldset>
        {result && <p role={result.success ? 'status' : 'alert'} className={`rounded-lg border p-4 text-sm ${result.success ? 'border-success' : 'border-warning'}`}>{result.message}</p>}
        <button type="submit" disabled={submitting || !courseWorkId || selectedWork?.associatedWithDeveloper === false} className="btn-primary">{submitting ? 'Submitting…' : 'Submit SSC report'}</button>
    </form>;
}
