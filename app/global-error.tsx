'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        void import('@sentry/nextjs').then((Sentry) => Sentry.captureException(error));
    }, [error]);

    return (
        <html lang="en">
            <body>
                <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-5 px-6 py-16 text-slate-900">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">RTU Student Government Portal</p>
                    <h1 className="text-3xl font-semibold tracking-tight">The portal needs a quick restart.</h1>
                    <p className="text-slate-600">Your information was not submitted. Try loading this page again.</p>
                    <button type="button" onClick={() => reset()} className="btn-primary w-fit">Try again</button>
                </main>
            </body>
        </html>
    );
}
