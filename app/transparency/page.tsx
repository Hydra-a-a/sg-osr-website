import Link from 'next/link';
import { listPublicTransparencyReports } from '@/lib/transparency';
import { DocumentActions, ProjectRegistry, ReportTotals, date, period, fieldClass } from '@/components/transparency/ReportView';

export const metadata = { title: 'SSC Financial Transparency | RTU OSR' };

type Search = Record<string, string | string[] | undefined>;
const value = (params: Search, key: string) => typeof params[key] === 'string' ? params[key] as string : '';

export default async function TransparencyPage({ searchParams }: { searchParams: Promise<Search> }) {
    const [reports, params] = await Promise.all([listPublicTransparencyReports(), searchParams]);
    const year = value(params, 'year');
    const selectedPeriod = value(params, 'period');
    const category = value(params, 'category');
    const query = value(params, 'q').trim();
    const matching = reports.filter(report => (!year || String(report.academicYearStart) === year) && (!selectedPeriod || `${report.periodKind}:${report.periodNumber ?? ''}` === selectedPeriod));
    const latest = matching.find(report => report.status === 'PUBLISHED');
    const lines = latest?.lines.filter(line => (!category || line.category === category) && (!query || line.projectTitle.toLocaleLowerCase().includes(query.toLocaleLowerCase()))) ?? [];
    const archive = matching.filter(report => (!category && !query) || report.lines.some(line => (!category || line.category === category) && (!query || line.projectTitle.toLocaleLowerCase().includes(query.toLocaleLowerCase()))));
    const years = [...new Set(reports.map(report => report.academicYearStart))].sort((a, b) => b - a);
    const periods = [...new Map(reports.map(report => [`${report.periodKind}:${report.periodNumber ?? ''}`, period(report)])).entries()];
    const categories = [...new Set(reports.flatMap(report => report.lines.map(line => line.category)))].sort();
    return <section className="portal-section-slate section min-h-screen">
        <div className="container-main space-y-8">
            <header className="flex flex-wrap items-start justify-between gap-6">
                <div><h1 className="text-3xl font-bold text-white md:text-5xl">SSC financial transparency</h1><p className="mt-4 max-w-2xl text-slate-300">Published budgets, spending, and approved financial reports of the Supreme Student Council.</p></div>
                <Link href="/transparency/submit" className="inline-flex min-h-11 items-center text-sky-300 underline underline-offset-4">Submit a report</Link>
            </header>
            {reports.length ? <>
                <form action="/transparency" method="get" className="grid items-end gap-4 border-y border-white/15 py-6 sm:grid-cols-2 lg:grid-cols-5">
                    <label className="text-sm text-slate-200">Academic year<select name="year" defaultValue={year} className={fieldClass}><option value="">All years</option>{years.map(item => <option key={item} value={item}>{item}–{item + 1}</option>)}</select></label>
                    <label className="text-sm text-slate-200">Reporting period<select name="period" defaultValue={selectedPeriod} className={fieldClass}><option value="">All periods</option>{periods.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
                    <label className="text-sm text-slate-200">Project category<select name="category" defaultValue={category} className={fieldClass}><option value="">All categories</option>{categories.map(item => <option key={item}>{item}</option>)}</select></label>
                    <label className="text-sm text-slate-200">Project name<input type="search" name="q" maxLength={200} defaultValue={query} className={fieldClass} /></label>
                    <div className="flex items-center gap-4"><button className="min-h-11 rounded-lg bg-sky-300 px-4 font-semibold text-slate-950">Apply filters</button><Link href="/transparency" className="text-sm text-sky-300 underline">Reset</Link></div>
                </form>
                {latest ? <section className="space-y-6" aria-labelledby="latest-report-title">
                    <header><p className="text-sm text-slate-300">Academic year {latest.academicYearStart}–{latest.academicYearStart + 1} · {period(latest)}</p><h2 id="latest-report-title" className="mt-2 text-2xl font-semibold text-white">{latest.title}</h2><p className="mt-2 text-sm text-slate-300">Published {date(latest.publishedAt)} · As of {date(latest.asOfDate)}</p></header>
                    <ReportTotals report={latest} />
                    <p className="text-sm text-slate-300">Figures represent the complete report; project filters affect the registry below. The approved PDF is the canonical financial record.</p>
                    <ProjectRegistry lines={lines} />
                    <Link href={`/transparency/financial-statements/${latest.slug}`} className="inline-flex min-h-11 items-center text-sky-300 underline underline-offset-4">Complete report and private feedback</Link>
                </section> : <p className="rounded-lg border border-white/15 p-6 text-slate-300">No current published report matches this reporting period. Historical records, when available, appear below.</p>}
                <section aria-labelledby="archive-title"><h2 id="archive-title" className="text-2xl font-semibold text-white">Financial report archive</h2>
                    {archive.length ? <ul className="mt-4 divide-y divide-white/15">{archive.map(report => <li key={report.id} className="flex flex-wrap items-center justify-between gap-5 py-6"><div><Link href={`/transparency/financial-statements/${report.slug}`} className="text-lg font-semibold text-sky-300 underline underline-offset-4">{report.title}</Link><p className="mt-2 text-sm text-slate-300">{report.academicYearStart}–{report.academicYearStart + 1} · {period(report)} · Published {date(report.publishedAt)}</p>{report.status !== 'PUBLISHED' ? <p className="mt-2 font-semibold text-amber-300">{report.status === 'WITHDRAWN' ? 'Withdrawn — document unavailable' : 'Superseded — correction available'}</p> : null}</div><DocumentActions report={report} /></li>)}</ul> : <p className="mt-4 text-slate-300">No reports match these filters.</p>}
                </section>
            </> : <section className="border-y border-white/15 py-10"><h2 className="text-2xl font-semibold text-white">No financial reports published yet</h2><p className="mt-3 max-w-2xl text-slate-300">Approved SSC reports and their project figures will appear here after officer review. No financial totals are available yet.</p></section>}
            <aside className="flex flex-wrap gap-x-12 gap-y-4 border-t border-white/15 pt-6 text-slate-300"><p>Board Resolutions <span className="ml-2 text-sm">Planned</span></p><p>Minutes of Meetings <span className="ml-2 text-sm">Planned</span></p></aside>
        </div>
    </section>;
}
