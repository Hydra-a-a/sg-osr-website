'use client';

import {
    useId,
    useState,
    type KeyboardEvent,
    type ReactNode,
} from 'react';

export type AdminTabItem = {
    id: string;
    label: string;
    panel: ReactNode;
    count?: number;
    disabled?: boolean;
};

type AdminTabsProps = {
    items: AdminTabItem[];
    value?: string;
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    label?: string;
    className?: string;
};

export function AdminTabs({
    items,
    value,
    defaultValue,
    onValueChange,
    label = 'Record sections',
    className = '',
}: AdminTabsProps) {
    const baseId = useId();
    const [internalValue, setInternalValue] = useState(() => defaultValue || items.find((item) => !item.disabled)?.id || '');
    const candidateValue = value ?? internalValue;
    const activeValue = items.some((item) => item.id === candidateValue && !item.disabled)
        ? candidateValue
        : items.find((item) => !item.disabled)?.id || '';

    function selectTab(nextValue: string) {
        if (value === undefined) setInternalValue(nextValue);
        onValueChange?.(nextValue);
    }

    function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) {
        const enabledItems = items.filter((item) => !item.disabled);
        if (enabledItems.length === 0) return;

        const currentId = items[currentIndex]?.id;
        const enabledIndex = enabledItems.findIndex((item) => item.id === currentId);
        let nextIndex: number | null = null;

        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
            nextIndex = (enabledIndex + 1) % enabledItems.length;
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
            nextIndex = (enabledIndex - 1 + enabledItems.length) % enabledItems.length;
        } else if (event.key === 'Home') {
            nextIndex = 0;
        } else if (event.key === 'End') {
            nextIndex = enabledItems.length - 1;
        }

        if (nextIndex === null) return;
        event.preventDefault();
        const nextItem = enabledItems[nextIndex];
        selectTab(nextItem.id);
        document.getElementById(`${baseId}-tab-${nextItem.id}`)?.focus();
    }

    if (items.length === 0) return null;

    return (
        <div className={className}>
            <div role="tablist" aria-label={label} className="flex overflow-x-auto border-b border-white/10">
                {items.map((item, index) => {
                    const active = item.id === activeValue;
                    return (
                        <button
                            key={item.id}
                            id={`${baseId}-tab-${item.id}`}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            aria-controls={`${baseId}-panel-${item.id}`}
                            tabIndex={active ? 0 : -1}
                            disabled={item.disabled}
                            onClick={() => selectTab(item.id)}
                            onKeyDown={(event) => handleKeyDown(event, index)}
                            className={`relative inline-flex min-h-11 shrink-0 items-center gap-2 px-4 text-sm font-semibold outline-none transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-200 ${active
                                ? 'text-amber-100 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-amber-200'
                                : 'text-slate-400 hover:bg-white/[0.03] hover:text-slate-200 disabled:cursor-not-allowed disabled:text-slate-700'
                            }`}
                        >
                            {item.label}
                            {typeof item.count === 'number' ? <span className="min-w-5 border border-white/10 bg-white/5 px-1.5 py-0.5 text-[0.65rem] text-slate-400">{item.count}</span> : null}
                        </button>
                    );
                })}
            </div>

            {items.map((item) => (
                <div
                    key={item.id}
                    id={`${baseId}-panel-${item.id}`}
                    role="tabpanel"
                    aria-labelledby={`${baseId}-tab-${item.id}`}
                    tabIndex={0}
                    hidden={item.id !== activeValue}
                    className="outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-200"
                >
                    {item.panel}
                </div>
            ))}
        </div>
    );
}
