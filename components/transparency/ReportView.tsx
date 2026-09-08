import Link from 'next/link';
import type { PublicTransparencyReport } from '@/schemas/transparency';

export function money(value: string) {
    const [whole, fraction = '00'] = value.split('.');
    const formatted = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).formatToParts(BigInt(whole))
        .map(part => part.type === 'fraction' ? fraction.padEnd(2, '0') : part.value).join('');
    return value.startsWith('-') && BigInt(whole) === BigInt(0) ? `-${formatted}` : formatted;
}
export const date = (value: string | null) => value ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value)) : 'Not available';
export const period = (report: PublicTransparencyReport) => `${report.periodKind[0]}${report.periodKind.slice(1).toLowerCase()}${report.periodNumber ? ` ${report.periodNumber}` : ''}`;
export const fieldClass = 'mt-2 min-h-11 w-full rounded-lg border border-slate-500 bg-slate-950 px-3 py-2 text-white focus:outline-2 focus:outline-offset-2 focus:outline-sky-400';

export function ReportTotals({ report }: { report: PublicTransparencyReport }) {
    return <dl className="grid grid-cols-1 gap-6 border-y border-white/15 py-6 sm:grid-cols-2 lg:grid-cols-4">
        {[
            ['Total allocated', money(report.totals.allocated)],
            ['Total spent', money(report.totals.spent)],
            ['Remaining balance', money(report.totals.balance)],
            ['Utilization', report.totals.utilization === null ? 'Unavailable' : `${report.totals.utilization}%`],
        ].map(([label, value]) => <div key={label}><dt className="text-sm text-slate-300">{label}</dt><dd className="mt-2 break-words text-2xl font-semibold tabular-nums text-white">{value}</dd></div>)}
    </dl>;
}

export function DocumentActions({ report }: { report: PublicTransparencyReport }) {
    if (!report.pdf || report.status === 'WITHDRAWN') return null;
    const path = `/api/transparency/documents/${encodeURIComponent(report.pdf.fileId)}`;
    return <div className="flex flex-wrap gap-4">
        <a href={path} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-lg bg-sky-300 px-4 font-semibold text-slate-950">View document<span className="sr-only"> (PDF, opens in a new tab)</span></a>
        <a href={`${path}?download=1`} download className="inline-flex min-h-11 items-center px-2 text-sky-300 underline underline-offset-4">Download PDF</a>
    </div>;
}

export function ReportNotice({ report }: { report: PublicTransparencyReport }) {
    if (report.status === 'WITHDRAWN') return <aside className="rounded-lg border border-amber-400/60 bg-amber-950/40 p-5 text-amber-100"><h2 className="font-semibold">Report withdrawn · {date(report.withdrawnAt)}</h2><p className="mt-2 whitespace-pre-wrap">{report.withdrawalReason}</p><p className="mt-2">The document is unavailable. This notice preserves the publication history.</p></aside>;
    if (report.status === 'SUPERSEDED') return <aside className="rounded-lg border border-amber-400/60 bg-amber-950/40 p-5 text-amber-100"><h2 className="font-semibold">Superseded report</h2>{report.successor ? <><p className="mt-2">Corrected on {date(report.successor.publishedAt)}: {report.successor.correctionReason}</p><Link href={`/transparency/financial-statements/${report.successor.slug}`} className="mt-3 inline-block underline underline-offset-4">Read {report.successor.title}</Link></> : <p className="mt-2">A correction has replaced this report.</p>}</aside>;
    return null;
}

export function ProjectRegistry({ lines }: { lines: PublicTransparencyReport['lines'] }) {
    if (!lines.length) return <p className="py-6 text-slate-300">No projects match these filters.</p>;
    return <div className="overflow-x-auto rounded-lg border border-white/15" role="region" aria-label="Project budget registry" tabIndex={0}>
        <table className="w-full min-w-[760px] text-left text-sm">
            <caption className="sr-only">Project allocations and spending in Philippine pesos</caption>
            <thead className="bg-slate-950/60 text-slate-300"><tr>{['Project', 'Category', 'Allocated', 'Spent', 'Remaining', 'Utilization'].map(label => <th key={label} scope="col" className="p-4">{label}</th>)}</tr></thead>
            <tbody>{lines.map(line => <tr key={line.id} className="border-t border-white/10 align-top text-slate-200">
                <th scope="row" className="max-w-sm p-4 font-normal"><span className="font-semibold text-white">{line.projectTitle}</span>{line.projectCode ? <span className="mt-1 block text-xs text-slate-400">{line.projectCode}</span> : null}{Number(line.spent) > Number(line.allocated) ? <span className="mt-2 block font-semibold text-amber-300">Above allocation</span> : null}{line.publicNote ? <p className="mt-2 whitespace-pre-wrap text-slate-300">{line.publicNote}</p> : null}</th>
                <td className="p-4">{line.category}</td><td className="whitespace-nowrap p-4 tabular-nums">{money(line.allocated)}</td><td className="whitespace-nowrap p-4 tabular-nums">{money(line.spent)}</td><td className="whitespace-nowrap p-4 tabular-nums">{money(line.balance)}</td><td className="p-4 tabular-nums">{line.utilization === null ? 'Unavailable' : `${line.utilization}%`}</td>
            </tr>)}</tbody>
        </table>
    </div>;
}
