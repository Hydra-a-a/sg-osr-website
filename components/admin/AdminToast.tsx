'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

export type AdminToastTone = 'success' | 'danger' | 'warning' | 'info';

export type AdminToastMessage = {
    id: string;
    title: string;
    description?: string;
    tone?: AdminToastTone;
    action?: ReactNode;
    durationMs?: number;
};

type AdminToastRegionProps = {
    toasts: AdminToastMessage[];
    onDismiss: (id: string) => void;
    label?: string;
    className?: string;
};

const toneStyles: Record<AdminToastTone, { border: string; icon: string }> = {
    success: { border: 'border-emerald-300/30', icon: 'text-emerald-200' },
    danger: { border: 'border-red-300/30', icon: 'text-red-200' },
    warning: { border: 'border-amber-300/30', icon: 'text-amber-200' },
    info: { border: 'border-sky-300/30', icon: 'text-sky-200' },
};

const toneIcons = {
    success: CheckCircle2,
    danger: XCircle,
    warning: AlertTriangle,
    info: Info,
} as const;

function AdminToastItem({ toast, onDismiss }: { toast: AdminToastMessage; onDismiss: (id: string) => void }) {
    const tone = toast.tone || 'info';
    const Icon = toneIcons[tone];

    useEffect(() => {
        if (toast.durationMs === 0) return;
        const timeout = window.setTimeout(() => onDismiss(toast.id), toast.durationMs ?? 5000);
        return () => window.clearTimeout(timeout);
    }, [onDismiss, toast.durationMs, toast.id]);

    return (
        <div
            role={tone === 'danger' ? 'alert' : 'status'}
            className={`pointer-events-auto border bg-[#111f34] p-4 shadow-2xl ${toneStyles[tone].border}`}
        >
            <div className="flex items-start gap-3">
                <Icon size={18} className={`mt-0.5 shrink-0 ${toneStyles[tone].icon}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">{toast.title}</p>
                    {toast.description ? <p className="mt-1 text-sm leading-5 text-slate-400">{toast.description}</p> : null}
                    {toast.action ? <div className="mt-3">{toast.action}</div> : null}
                </div>
                <button
                    type="button"
                    onClick={() => onDismiss(toast.id)}
                    className="grid size-9 shrink-0 place-items-center text-slate-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
                    aria-label={`Dismiss ${toast.title}`}
                >
                    <X size={15} aria-hidden="true" />
                </button>
            </div>
        </div>
    );
}

export default function AdminToastRegion({
    toasts,
    onDismiss,
    label = 'Notifications',
    className = '',
}: AdminToastRegionProps) {
    if (toasts.length === 0) return null;

    return (
        <section
            aria-label={label}
            aria-live="polite"
            aria-relevant="additions removals"
            className={`pointer-events-none fixed inset-x-4 top-4 z-[110] ml-auto grid max-w-sm gap-3 sm:inset-x-auto sm:right-5 sm:top-5 sm:w-[24rem] ${className}`}
        >
            {toasts.map((toast) => <AdminToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />)}
        </section>
    );
}

let toastSequence = 0;

export function useAdminToasts() {
    const [toasts, setToasts] = useState<AdminToastMessage[]>([]);

    const dismissToast = useCallback((id: string) => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
    }, []);

    const pushToast = useCallback((toast: Omit<AdminToastMessage, 'id'> & { id?: string }) => {
        toastSequence += 1;
        const id = toast.id || `admin-toast-${Date.now()}-${toastSequence}`;
        setToasts((current) => [...current, { ...toast, id }]);
        return id;
    }, []);

    const clearToasts = useCallback(() => setToasts([]), []);

    return { toasts, pushToast, dismissToast, clearToasts };
}
