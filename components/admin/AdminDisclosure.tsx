'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

type AdminDisclosureProps = {
    title: string;
    description?: string;
    children: ReactNode;
    badge?: ReactNode;
    defaultOpen?: boolean;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    className?: string;
};

export default function AdminDisclosure({
    title,
    description,
    children,
    badge,
    defaultOpen = false,
    open,
    onOpenChange,
    className = '',
}: AdminDisclosureProps) {
    const [internalOpen, setInternalOpen] = useState(defaultOpen);
    const resolvedOpen = open ?? internalOpen;

    return (
        <details
            className={`group border border-white/10 bg-white/[0.025] ${className}`}
            open={resolvedOpen}
            onToggle={(event) => {
                const nextOpen = event.currentTarget.open;
                if (open === undefined) setInternalOpen(nextOpen);
                onOpenChange?.(nextOpen);
            }}
        >
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 outline-none transition hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-200 [&::-webkit-details-marker]:hidden">
                <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                        {title}
                        {badge}
                    </span>
                    {description ? <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span> : null}
                </span>
                <ChevronDown size={16} className="shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true" />
            </summary>
            <div className="border-t border-white/10 px-4 py-4">{children}</div>
        </details>
    );
}
