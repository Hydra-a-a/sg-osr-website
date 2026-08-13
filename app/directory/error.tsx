'use client';

import RouteErrorState from '@/components/RouteErrorState';

export default function DirectoryError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <RouteErrorState error={error} reset={reset} title="The directory could not load." />;
}
