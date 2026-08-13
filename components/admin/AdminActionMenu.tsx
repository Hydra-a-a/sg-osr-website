'use client';

import Link from 'next/link';
import {
    useEffect,
    useId,
    useRef,
    useState,
    type KeyboardEvent,
    type ReactNode,
} from 'react';
import { ChevronDown, MoreHorizontal } from 'lucide-react';

export type AdminActionMenuItem = {
    id: string;
    label: string;
    icon?: ReactNode;
    description?: string;
    disabled?: boolean;
    tone?: 'default' | 'danger';
    href?: string;
    external?: boolean;
    onSelect?: () => void;
};

type AdminActionMenuProps = {
    items: AdminActionMenuItem[];
    label?: string;
    compact?: boolean;
    align?: 'left' | 'right';
    className?: string;
};

function focusMenuItem(menu: HTMLElement, index: number) {
    const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])'));
    if (items.length === 0) return;
    const normalizedIndex = ((index % items.length) + items.length) % items.length;
    items[normalizedIndex]?.focus();
}

export default function AdminActionMenu({
    items,
    label = 'Actions',
    compact = false,
    align = 'right',
    className = '',
}: AdminActionMenuProps) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const menuId = useId();

    useEffect(() => {
        if (!open) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
        };
        document.addEventListener('pointerdown', handlePointerDown);
        return () => document.removeEventListener('pointerdown', handlePointerDown);
    }, [open]);

    function openAndFocus(position: 'first' | 'last' = 'first') {
        setOpen(true);
        window.requestAnimationFrame(() => {
            const menu = menuRef.current;
            if (!menu) return;
            focusMenuItem(menu, position === 'first' ? 0 : -1);
        });
    }

    function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            openAndFocus('first');
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            openAndFocus('last');
        }
    }

    function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
        const menu = menuRef.current;
        if (!menu) return;

        const enabledItems = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"])'));
        const activeIndex = enabledItems.indexOf(document.activeElement as HTMLElement);

        if (event.key === 'Escape') {
            event.preventDefault();
            setOpen(false);
            triggerRef.current?.focus();
        } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            focusMenuItem(menu, activeIndex + 1);
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            focusMenuItem(menu, activeIndex - 1);
        } else if (event.key === 'Home') {
            event.preventDefault();
            focusMenuItem(menu, 0);
        } else if (event.key === 'End') {
            event.preventDefault();
            focusMenuItem(menu, -1);
        } else if (event.key === 'Tab') {
            setOpen(false);
        }
    }

    function itemClasses(item: AdminActionMenuItem) {
        return `flex w-full items-start gap-3 px-3 py-2.5 text-left text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-200 ${item.disabled
            ? 'cursor-not-allowed text-slate-600'
            : item.tone === 'danger'
                ? 'text-red-100 hover:bg-red-300/10'
                : 'text-slate-200 hover:bg-white/5'
        }`;
    }

    function selectItem(item: AdminActionMenuItem) {
        if (item.disabled) return;
        setOpen(false);
        item.onSelect?.();
    }

    return (
        <div ref={rootRef} className={`relative inline-flex ${className}`}>
            <button
                ref={triggerRef}
                type="button"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={menuId}
                onClick={() => setOpen((current) => !current)}
                onKeyDown={handleTriggerKeyDown}
                className="inline-flex min-h-10 items-center justify-center gap-2 border border-white/10 bg-white/5 px-3 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
            >
                {compact ? <MoreHorizontal size={17} aria-hidden="true" /> : <>{label}<ChevronDown size={14} aria-hidden="true" /></>}
                {compact ? <span className="sr-only">{label}</span> : null}
            </button>

            {open ? (
                <div
                    ref={menuRef}
                    id={menuId}
                    role="menu"
                    aria-label={label}
                    onKeyDown={handleMenuKeyDown}
                    className={`absolute top-[calc(100%+0.5rem)] z-50 min-w-56 border border-white/10 bg-[#101d30] p-1.5 shadow-2xl ${align === 'right' ? 'right-0' : 'left-0'}`}
                >
                    {items.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-slate-500">No actions available.</p>
                    ) : items.map((item) => {
                        const content = (
                            <>
                                {item.icon ? <span className="mt-0.5 shrink-0" aria-hidden="true">{item.icon}</span> : null}
                                <span className="min-w-0">
                                    <span className="block font-medium">{item.label}</span>
                                    {item.description ? <span className="mt-0.5 block text-xs leading-5 text-slate-500">{item.description}</span> : null}
                                </span>
                            </>
                        );

                        if (item.href && !item.disabled) {
                            if (item.external) {
                                return (
                                    <a key={item.id} role="menuitem" href={item.href} target="_blank" rel="noreferrer" onClick={() => selectItem(item)} className={itemClasses(item)}>
                                        {content}
                                    </a>
                                );
                            }
                            return (
                                <Link key={item.id} role="menuitem" href={item.href} onClick={() => selectItem(item)} className={itemClasses(item)}>
                                    {content}
                                </Link>
                            );
                        }

                        return (
                            <button
                                key={item.id}
                                type="button"
                                role="menuitem"
                                aria-disabled={item.disabled || undefined}
                                disabled={item.disabled}
                                onClick={() => selectItem(item)}
                                className={itemClasses(item)}
                            >
                                {content}
                            </button>
                        );
                    })}
                </div>
            ) : null}
        </div>
    );
}
