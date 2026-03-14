'use client';

import { SessionProvider } from 'next-auth/react';

/**
 * Client-side session provider wrapper.
 * Wraps the application so useSession() works in client components.
 */
export default function AuthProvider({ children }: { children: React.ReactNode }) {
    return <SessionProvider>{children}</SessionProvider>;
}
