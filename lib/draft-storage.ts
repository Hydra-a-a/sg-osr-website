'use client';

const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;

type DraftEnvelope<T> = {
    version: number;
    expiresAt: number;
    payload: T;
};

function storage(): Storage | null {
    if (typeof window === 'undefined') return null;
    try {
        return window.sessionStorage;
    } catch {
        return null;
    }
}

export function readDraft<T>(key: string, version: number): T | null {
    const target = storage();
    if (!target) return null;

    try {
        const raw = target.getItem(key);
        if (!raw) return null;
        const envelope = JSON.parse(raw) as Partial<DraftEnvelope<T>>;
        if (envelope.version !== version || typeof envelope.expiresAt !== 'number' || envelope.expiresAt <= Date.now()) {
            target.removeItem(key);
            return null;
        }
        return envelope.payload ?? null;
    } catch {
        return null;
    }
}

export function writeDraft<T>(key: string, version: number, payload: T, ttlMs = DEFAULT_TTL_MS): void {
    const target = storage();
    if (!target) return;

    try {
        const envelope: DraftEnvelope<T> = { version, expiresAt: Date.now() + ttlMs, payload };
        target.setItem(key, JSON.stringify(envelope));
    } catch {
        // Draft persistence is best effort and must never block a submission.
    }
}

export function clearDraft(key: string): void {
    const target = storage();
    if (!target) return;
    try {
        target.removeItem(key);
    } catch {
    }
}

export function getOrCreateIdempotencyKey(key: string): string {
    const target = storage();
    if (target) {
        try {
            const existing = target.getItem(key);
            if (existing) return existing;
        } catch {
        }
    }

    const generated = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    if (target) {
        try {
            target.setItem(key, generated);
        } catch {
        }
    }
    return generated;
}

export function resetIdempotencyKey(key: string): string {
    clearDraft(key);
    const target = storage();
    if (target) {
        try {
            target.removeItem(key);
        } catch {
        }
    }
    return getOrCreateIdempotencyKey(key);
}
