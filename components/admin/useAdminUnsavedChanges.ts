'use client';

import { useCallback, useEffect } from 'react';

type AdminUnsavedChangesOptions = {
    isDirty: boolean;
    message?: string;
    onDiscard?: () => void;
};

type GuardedAction = () => void | Promise<void>;

const DEFAULT_MESSAGE = 'You have unsaved changes. Discard them and continue?';

/**
 * Protects reload/tab-close and provides a guard for client-side close or
 * navigation actions. Call `runGuarded` from drawer close buttons, menu items,
 * and Next.js navigation handlers because client-side routing does not emit
 * `beforeunload`.
 */
export default function useAdminUnsavedChanges({
    isDirty,
    message = DEFAULT_MESSAGE,
    onDiscard,
}: AdminUnsavedChangesOptions) {
    useEffect(() => {
        const handleBeforeUnload = (event: BeforeUnloadEvent) => {
            if (!isDirty) return;
            event.preventDefault();
            event.returnValue = '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    const confirmDiscard = useCallback(() => {
        if (!isDirty) return true;
        const confirmed = window.confirm(message);
        if (confirmed) onDiscard?.();
        return confirmed;
    }, [isDirty, message, onDiscard]);

    const runGuarded = useCallback((action: GuardedAction) => {
        if (!confirmDiscard()) return false;
        void action();
        return true;
    }, [confirmDiscard]);

    return { confirmDiscard, runGuarded };
}
