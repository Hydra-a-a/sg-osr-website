'use client';

import RouteErrorState from '@/components/RouteErrorState';

export default function GrievanceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    return <RouteErrorState error={error} reset={reset} title="The grievance form needs a retry." />;
}
