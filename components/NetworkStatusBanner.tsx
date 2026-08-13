'use client';

import { useEffect, useState } from 'react';

export default function NetworkStatusBanner() {
    const [online, setOnline] = useState(true);

    useEffect(() => {
        const sync = () => setOnline(navigator.onLine);
        sync();
        window.addEventListener('online', sync);
        window.addEventListener('offline', sync);
        return () => {
            window.removeEventListener('online', sync);
            window.removeEventListener('offline', sync);
        };
    }, []);

    if (online) return null;
    return (
        <div role="status" className="fixed inset-x-0 top-0 z-[100] border-b border-amber-300/30 bg-slate-950/95 px-4 py-2 text-center text-sm text-amber-100">
            You are offline. Reading cached content may still work; submissions wait until you reconnect.
        </div>
    );
}
