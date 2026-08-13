function isValidDsn(value: string): boolean {
    try {
        const url = new URL(value);
        return url.protocol === 'https:' && Boolean(url.username) && url.hostname.length > 0 && url.pathname.length > 1;
    } catch {
        return false;
    }
}

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN?.trim() || '';
let sentryPromise: Promise<typeof import('@sentry/nextjs')> | null = null;
let sentryInitialized = false;

function loadSentry(): Promise<typeof import('@sentry/nextjs')> {
    sentryPromise ??= import('@sentry/nextjs').then((Sentry) => {
        if (!sentryInitialized && process.env.NODE_ENV === 'production' && isValidDsn(dsn)) {
            Sentry.init({
                dsn,
                tracesSampleRate: 0,
                replaysSessionSampleRate: 0,
                replaysOnErrorSampleRate: 0,
                enabled: true,
            });
            sentryInitialized = true;
        }
        return Sentry;
    });
    return sentryPromise;
}

if (process.env.NODE_ENV === 'production' && isValidDsn(dsn) && typeof window !== 'undefined') {
    const schedule = 'requestIdleCallback' in window
        ? (callback: () => void) => window.requestIdleCallback(callback, { timeout: 10000 })
        : (callback: () => void) => window.setTimeout(callback, 10000);
    schedule(() => { void loadSentry(); });
}

export function onRouterTransitionStart(url: string, navigationType: string): void {
    if (process.env.NODE_ENV !== 'production' || !isValidDsn(dsn)) return;
    void loadSentry().then((Sentry) => Sentry.captureRouterTransitionStart(url, navigationType));
}
