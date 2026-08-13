'use client';

import {
    useEffect,
    useEffectEvent,
    useId,
    useRef,
    type MouseEvent,
    type ReactNode,
    type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const FOCUSABLE_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

let bodyLockCount = 0;
let previousBodyOverflow = '';
const overlayStack: string[] = [];

function lockBodyScroll() {
    if (bodyLockCount === 0) {
        previousBodyOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
    }
    bodyLockCount += 1;
}

function unlockBodyScroll() {
    bodyLockCount = Math.max(0, bodyLockCount - 1);
    if (bodyLockCount === 0) {
        document.body.style.overflow = previousBodyOverflow;
    }
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
        .filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');
}

function useDialogBehavior({
    open,
    onClose,
    panelRef,
    initialFocusRef,
    closeOnEscape,
    overlayId,
}: {
    open: boolean;
    onClose: () => void;
    panelRef: RefObject<HTMLElement | null>;
    initialFocusRef?: RefObject<HTMLElement | null>;
    closeOnEscape: boolean;
    overlayId: string;
}) {
    const closeDialog = useEffectEvent(onClose);

    useEffect(() => {
        if (!open) return;

        const previouslyFocused = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        const panel = panelRef.current;
        lockBodyScroll();
        overlayStack.push(overlayId);

        const focusFrame = window.requestAnimationFrame(() => {
            const preferredTarget = initialFocusRef?.current;
            const focusTarget = preferredTarget || (panel ? getFocusableElements(panel)[0] : null) || panel;
            focusTarget?.focus();
        });

        const handleKeyDown = (event: KeyboardEvent) => {
            if (overlayStack[overlayStack.length - 1] !== overlayId) return;

            if (event.key === 'Escape' && closeOnEscape) {
                event.preventDefault();
                closeDialog();
                return;
            }

            if (event.key !== 'Tab' || !panel) return;

            const focusable = getFocusableElements(panel);
            if (focusable.length === 0) {
                event.preventDefault();
                panel.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;

            if (event.shiftKey && (active === first || active === panel)) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && active === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', handleKeyDown, true);
        return () => {
            window.cancelAnimationFrame(focusFrame);
            document.removeEventListener('keydown', handleKeyDown, true);
            const stackIndex = overlayStack.lastIndexOf(overlayId);
            if (stackIndex >= 0) overlayStack.splice(stackIndex, 1);
            unlockBodyScroll();
            previouslyFocused?.focus();
        };
    }, [closeOnEscape, initialFocusRef, open, overlayId, panelRef]);
}

type AdminOverlayBaseProps = {
    open: boolean;
    onClose: () => void;
    title: string;
    eyebrow?: string;
    description?: string;
    children: ReactNode;
    footer?: ReactNode;
    closeLabel?: string;
    closeOnBackdrop?: boolean;
    closeOnEscape?: boolean;
    initialFocusRef?: RefObject<HTMLElement | null>;
    className?: string;
};

function OverlayHeader({
    title,
    eyebrow,
    description,
    titleId,
    descriptionId,
    onClose,
    closeLabel,
}: {
    title: string;
    eyebrow?: string;
    description?: string;
    titleId: string;
    descriptionId: string;
    onClose: () => void;
    closeLabel: string;
}) {
    return (
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 px-5 py-4 sm:px-6">
            <div className="min-w-0">
                {eyebrow ? <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-amber-200">{eyebrow}</p> : null}
                <h2 id={titleId} className="text-lg font-semibold text-white">{title}</h2>
                {description ? <p id={descriptionId} className="mt-1 text-sm leading-6 text-slate-400">{description}</p> : null}
            </div>
            <button
                type="button"
                onClick={onClose}
                className="grid size-10 shrink-0 place-items-center border border-white/10 text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
                aria-label={closeLabel}
            >
                <X size={17} aria-hidden="true" />
            </button>
        </div>
    );
}

const drawerWidths = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-4xl',
} as const;

export type AdminDrawerProps = AdminOverlayBaseProps & {
    side?: 'left' | 'right';
    size?: keyof typeof drawerWidths;
};

export function AdminDrawer({
    open,
    onClose,
    title,
    eyebrow,
    description,
    children,
    footer,
    closeLabel = 'Close drawer',
    closeOnBackdrop = true,
    closeOnEscape = true,
    initialFocusRef,
    className = '',
    side = 'right',
    size = 'lg',
}: AdminDrawerProps) {
    const panelRef = useRef<HTMLElement>(null);
    const overlayId = useId();
    const titleId = useId();
    const descriptionId = useId();

    useDialogBehavior({ open, onClose, panelRef, initialFocusRef, closeOnEscape, overlayId });

    if (!open || typeof document === 'undefined') return null;

    const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose();
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[90] flex bg-slate-950/75 backdrop-blur-sm"
            onMouseDown={handleBackdropMouseDown}
            data-admin-overlay="drawer"
        >
            <section
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={description ? descriptionId : undefined}
                tabIndex={-1}
                className={`flex h-full w-full flex-col border-white/10 bg-[#0d192b] shadow-2xl outline-none ${drawerWidths[size]} ${side === 'right' ? 'ml-auto border-l' : 'mr-auto border-r'} ${className}`}
            >
                <OverlayHeader title={title} eyebrow={eyebrow} description={description} titleId={titleId} descriptionId={descriptionId} onClose={onClose} closeLabel={closeLabel} />
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
                {footer ? <div className="shrink-0 border-t border-white/10 bg-black/10 px-5 py-4 sm:px-6">{footer}</div> : null}
            </section>
        </div>,
        document.body,
    );
}

const modalWidths = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
} as const;

export type AdminModalProps = AdminOverlayBaseProps & {
    size?: keyof typeof modalWidths;
};

export function AdminModal({
    open,
    onClose,
    title,
    eyebrow,
    description,
    children,
    footer,
    closeLabel = 'Close dialog',
    closeOnBackdrop = true,
    closeOnEscape = true,
    initialFocusRef,
    className = '',
    size = 'md',
}: AdminModalProps) {
    const panelRef = useRef<HTMLElement>(null);
    const overlayId = useId();
    const titleId = useId();
    const descriptionId = useId();

    useDialogBehavior({ open, onClose, panelRef, initialFocusRef, closeOnEscape, overlayId });

    if (!open || typeof document === 'undefined') return null;

    const handleBackdropMouseDown = (event: MouseEvent<HTMLDivElement>) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onClose();
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/75 p-0 backdrop-blur-sm sm:items-center sm:p-6"
            onMouseDown={handleBackdropMouseDown}
            data-admin-overlay="modal"
        >
            <section
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={description ? descriptionId : undefined}
                tabIndex={-1}
                className={`flex max-h-[92dvh] w-full flex-col border border-white/10 bg-[#0d192b] shadow-2xl outline-none ${modalWidths[size]} ${className}`}
            >
                <OverlayHeader title={title} eyebrow={eyebrow} description={description} titleId={titleId} descriptionId={descriptionId} onClose={onClose} closeLabel={closeLabel} />
                <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
                {footer ? <div className="shrink-0 border-t border-white/10 bg-black/10 px-5 py-4 sm:px-6">{footer}</div> : null}
            </section>
        </div>,
        document.body,
    );
}
