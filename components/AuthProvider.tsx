'use client';

import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';

/**
 * Client-side session provider wrapper.
 * Wraps the application so useSession() works in client components.
 */
export default function AuthProvider({ children, session }: { children: React.ReactNode; session?: Session | null }) {
    return (
        <SessionProvider
            session={session}
            basePath="/api/auth"
            refetchOnWindowFocus={false}
            refetchWhenOffline={false}
        >
            {children}
        </SessionProvider>
    );
}
