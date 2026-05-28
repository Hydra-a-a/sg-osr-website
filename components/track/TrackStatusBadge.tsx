'use client';

export function TrackStatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
        Open: 'border-[rgba(203,165,77,0.24)] bg-[rgba(203,165,77,0.12)] text-[color:var(--accent-gold)]',
        'In Progress': 'border-[rgba(35,72,116,0.18)] bg-[rgba(35,72,116,0.1)] text-[color:var(--accent-primary)]',
        Resolved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        Closed: 'border-soft bg-surface-soft text-subtle',
        Appealed: 'border-[rgba(203,165,77,0.2)] bg-[rgba(232,207,146,0.24)] text-[color:var(--rtu-gold-dark)]',
    };
    const dot: Record<string, string> = {
        Open: 'bg-[color:var(--accent-gold)]',
        'In Progress': 'bg-[color:var(--accent-primary)]',
        Resolved: 'bg-green-500',
        Closed: 'bg-[color:var(--text-subtle)]',
        Appealed: 'bg-[color:var(--rtu-gold-dark)]',
    };
    const cls = map[status] ?? 'border-soft bg-surface-soft text-subtle';
    const dotCls = dot[status] ?? 'bg-[color:var(--text-subtle)]';

    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${cls}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${dotCls}`} />
            {status}
        </span>
    );
}
