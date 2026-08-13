'use client';

import { useMemo } from 'react';
import { classifyClientError, clientErrorMessage } from '@/lib/client-error';

export default function RouteErrorState({ error, reset, title = 'This page needs a retry.' }: { error: Error & { digest?: string }; reset: () => void; title?: string }) {
    const kind = useMemo(() => classifyClientError(error), [error]);
    return (
        <main className="container-main flex min-h-[50vh] flex-col justify-center py-16">
            <p className="portal-eyebrow">{kind === 'offline' ? 'Connection unavailable' : 'Temporary interruption'}</p>
            <h1 className="mt-3 max-w-2xl text-3xl font-semibold text-white">{title}</h1>
            <p className="mt-4 max-w-xl text-slate-300">{clientErrorMessage(kind)}</p>
            <button type="button" onClick={() => reset()} className="btn-primary mt-7 w-fit">Try again</button>
        </main>
    );
}
