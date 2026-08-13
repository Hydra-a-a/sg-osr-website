export type ClientErrorKind = 'offline' | 'timeout' | 'rate-limit' | 'service' | 'not-found' | 'validation' | 'unknown';

export function classifyClientError(error: unknown): ClientErrorKind {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
    const value = error instanceof Error ? error.message.toLowerCase() : String(error || '').toLowerCase();
    if (value.includes('abort') || value.includes('timeout')) return 'timeout';
    if (value.includes('429') || value.includes('rate')) return 'rate-limit';
    if (value.includes('404') || value.includes('not found')) return 'not-found';
    if (value.includes('400') || value.includes('invalid') || value.includes('validation')) return 'validation';
    if (value.includes('fetch') || value.includes('network') || value.includes('502') || value.includes('503') || value.includes('504') || value.includes('500')) return 'service';
    return 'unknown';
}

export function clientErrorMessage(kind: ClientErrorKind): string {
    switch (kind) {
        case 'offline': return 'You appear to be offline. Reconnect and try again; your current form remains here.';
        case 'timeout': return 'The service took too long to respond. Try again when your connection is steadier.';
        case 'rate-limit': return 'Too many attempts were made. Wait briefly, then try again.';
        case 'service': return 'The service is temporarily unavailable. Your current information was not submitted.';
        case 'not-found': return 'That record could not be found.';
        case 'validation': return 'Check the highlighted information and try again.';
        default: return 'Something went wrong. Your current information was not submitted.';
    }
}
