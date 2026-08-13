import { ApiError } from '@/lib/api-errors';

const MAX_KEY_LENGTH = 256;

export function normalizeIdempotencyKey(raw: string | null | undefined): string | null {
    const value = String(raw || '').trim();
    if (!value) return null;
    if (value.length > MAX_KEY_LENGTH) {
        throw new ApiError(400, 'INVALID_IDEMPOTENCY_KEY', 'The idempotency key is too long.');
    }
    return value;
}

export function submissionResponseHeaders(replayed: boolean): HeadersInit {
    return { 'Idempotency-Replayed': String(replayed) };
}
