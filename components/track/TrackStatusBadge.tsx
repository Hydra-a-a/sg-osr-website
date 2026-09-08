'use client';

export function TrackStatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        Open: 'border-amber-300/25 bg-amber-300/10 text-amber-200',
        'In Progress': 'border-sky-300/25 bg-sky-300/10 text-sky-200',
        Resolved: 'border-emerald-300/25 bg-emerald-300/10 text-emerald-200',
        Closed: 'border-white/10 bg-white/[0.05] text-slate-300',
        Appealed: 'border-amber-300/25 bg-amber-300/10 text-amber-200',
    };
    const dot: Record<string, string> = {
        Open: 'bg-amber-200',
        'In Progress': 'bg-sky-200',
        Resolved: 'bg-emerald-200',
        Closed: 'bg-slate-400',
        Appealed: 'bg-amber-200',
    };
    const cls = map[status] ?? 'border-white/10 bg-white/[0.05] text-slate-300';
    const dotCls = dot[status] ?? 'bg-slate-400';

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />
            {status}
        </span>
    );
}
