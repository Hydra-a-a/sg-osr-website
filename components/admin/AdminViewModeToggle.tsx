'use client';

type AdminViewModeToggleProps = {
    value: 'list' | 'category';
    onChange: (value: 'list' | 'category') => void;
    allLabel: string;
    categoryLabel?: string;
    compact?: boolean;
    showLabel?: boolean;
};

export default function AdminViewModeToggle({ value, onChange, allLabel, categoryLabel = 'By category', compact = false, showLabel = true }: AdminViewModeToggleProps) {
    const buttonClass = (active: boolean) => `${compact ? 'min-h-9 px-2.5 text-[0.7rem]' : 'min-h-10 px-3 text-xs'} font-semibold transition focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 ${active ? 'bg-amber-300/15 text-amber-100' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`;

    return (
        <div className="inline-flex min-h-10 items-center border border-white/10 bg-black/10" role="group" aria-label="Record view">
            {showLabel ? <span className="px-2 text-xs text-slate-500">View</span> : null}
            <button type="button" aria-pressed={value === 'list'} onClick={() => onChange('list')} className={buttonClass(value === 'list')}>{allLabel}</button>
            <button type="button" aria-pressed={value === 'category'} onClick={() => onChange('category')} className={buttonClass(value === 'category')}>{categoryLabel}</button>
        </div>
    );
}
