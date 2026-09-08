import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { getPublicTransparencyReport } from '@/lib/transparency';
import { DocumentActions, ProjectRegistry, ReportNotice, ReportTotals, date, period } from '@/components/transparency/ReportView';
import TransparencyFeedback from '@/components/transparency/TransparencyFeedback';

export default async function FinancialReportPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const [report, session] = await Promise.all([getPublicTransparencyReport(slug), auth()]);
    if (!report) notFound();
    const signedIn = Boolean(session?.user?.email?.toLowerCase().endsWith('@rtu.edu.ph') && !session.user.isDevSim);
    return <section className="portal-section-slate section min-h-screen"><div className="container-main space-y-8">
        <Link href="/transparency" className="inline-flex min-h-11 items-center text-sky-300 underline underline-offset-4">All financial reports</Link>
        <header><h1 className="text-3xl font-bold text-white md:text-4xl">{report.title}</h1><p className="mt-4 text-slate-300">{report.organizationName} · {report.academicYearStart}–{report.academicYearStart + 1} · {period(report)}</p><p className="mt-2 text-sm text-slate-300">{date(report.periodStart)}–{date(report.periodEnd)} · As of {date(report.asOfDate)} · Published {date(report.publishedAt)}</p></header>
        <ReportNotice report={report} />
        {report.status !== 'WITHDRAWN' ? <>
            <ReportTotals report={report} />
            <p className="max-w-3xl text-sm text-slate-300">These figures are a student-readable representation of the approved PDF, which remains the canonical financial record. Documents load only when you choose to open or download them.</p>
            <DocumentActions report={report} />
            <section className="space-y-4"><h2 className="text-2xl font-semibold text-white">Project breakdown</h2><ProjectRegistry lines={report.lines} /></section>
            {report.notes ? <section><h2 className="text-2xl font-semibold text-white">Report notes</h2><p className="mt-4 whitespace-pre-wrap text-slate-300">{report.notes}</p></section> : null}
        </> : null}
        {report.predecessor ? <section className="border-t border-white/15 pt-6"><h2 className="text-2xl font-semibold text-white">Correction history</h2><p className="mt-3 whitespace-pre-wrap text-slate-300">{date(report.publishedAt)} · {report.correctionReason}</p><Link href={`/transparency/financial-statements/${report.predecessor.slug}`} className="mt-3 inline-flex min-h-11 items-center text-sky-300 underline underline-offset-4">Previous report: {report.predecessor.title}</Link></section> : null}
        <section className="border-t border-white/15 pt-8"><h2 className="text-2xl font-semibold text-white">Private feedback</h2><p className="mt-3 max-w-2xl text-sm text-slate-300">Your message and officer replies are visible only to you and authorized officers. Do not include another student’s private information.</p>
            {signedIn ? <TransparencyFeedback reportId={report.id} projects={report.status === 'WITHDRAWN' ? [] : report.lines.map(line => ({ id: line.id, title: line.projectTitle }))} allowCreation={report.status !== 'WITHDRAWN'} /> : <Link href={`/login?callbackUrl=${encodeURIComponent(`/transparency/financial-statements/${report.slug}`)}`} className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-sky-300 px-4 font-semibold text-slate-950">Sign in with your RTU account</Link>}
        </section>
    </div></section>;
}
