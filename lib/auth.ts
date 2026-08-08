import NextAuth from 'next-auth';
import type { Session } from 'next-auth';
import { after } from 'next/server';
import type { JWT } from 'next-auth/jwt';
import { applySessionFields, authConfig } from '@/lib/auth.config';
import { logAuditAction } from '@/lib/audit';
import { redactErrorForLog } from '@/lib/security';
import {
    loadAuthorizedUsers,
    recordAuthorizedUserAccess,
    type AuthorizedUserRecord,
} from '@/lib/auth-access';
import type { PortalRole } from '@/lib/portal-mode';

/**
 * Fetch authorized users from the configured access source.
 * Defaults to Google Sheets and keeps the existing 5-minute cache behavior.
 */
let cachedUsers: Map<string, AuthorizedUserRecord> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function refreshGoogleAccessToken(token: JWT): Promise<JWT> {
    if (!token.refreshToken) {
        return token;
    }

    try {
        const body = new URLSearchParams({
            client_id: process.env.AUTH_GOOGLE_ID || '',
            client_secret: process.env.AUTH_GOOGLE_SECRET || '',
            grant_type: 'refresh_token',
            refresh_token: token.refreshToken,
        });

        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body,
            cache: 'no-store',
        });

        if (!response.ok) {
            return token;
        }

        const refreshed = await response.json() as {
            access_token?: string;
            expires_in?: number;
            refresh_token?: string;
        };

        if (!refreshed.access_token) {
            return token;
        }

        return {
            ...token,
            accessToken: refreshed.access_token,
            accessTokenExpires: Date.now() + (Number(refreshed.expires_in || 3600) * 1000),
            refreshToken: refreshed.refresh_token || token.refreshToken,
        };
    } catch {
        return token;
    }
}

function normalizeSimulatedRole(value: unknown): PortalRole {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'officer') return 'officer';
    if (normalized === 'leader') return 'leader';
    return 'student';
}

function inferSimulatedRoleFromDisplayName(value: unknown): PortalRole {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized.includes('officer')) return 'officer';
    if (normalized.includes('leader')) return 'leader';
    return 'student';
}

export async function getAuthorizedUsers(): Promise<Map<string, AuthorizedUserRecord>> {
    const now = Date.now();
    if (cachedUsers && now - cacheTimestamp < CACHE_TTL) {
        return cachedUsers;
    }

    try {
        const users = await loadAuthorizedUsers();
        cachedUsers = users;
        cacheTimestamp = now;
        return users;
    } catch (error) {
        console.error('[Auth] Failed to load authorized users:', redactErrorForLog(error));
        throw error;
    }
}

export function invalidateAuthorizedUsersCache(): void {
    cachedUsers = null;
    cacheTimestamp = 0;
}

const authCallbacks = {
    ...authConfig.callbacks,
    /**
     * jwt callback - attach role to the token.
     * Re-validates leader role on each JWT callback to avoid stale privilege.
     */
    async jwt({ token, user, account }) {
            const isLocalSimEnabled = process.env.NODE_ENV !== 'production'
                && process.env.ENABLE_LOCAL_LOGIN_SIMULATION === 'true';
            const isDevSimProvider = account?.provider === 'dev-sim'
                || (isLocalSimEnabled && account?.provider === 'credentials');

            if (account?.provider === 'google') {
                if (account.access_token) {
                    token.accessToken = account.access_token;
                }
                if (account.expires_at) {
                    token.accessTokenExpires = account.expires_at * 1000;
                }
                if (account.refresh_token) {
                    token.refreshToken = account.refresh_token;
                }
            }

            if (isDevSimProvider && user?.email) {
                token.email = user.email.toLowerCase().trim();
                const roleFromUser = normalizeSimulatedRole((user as { role?: unknown }).role);
                const roleFromName = inferSimulatedRoleFromDisplayName(user.name);
                const roleFromToken = normalizeSimulatedRole(token.role);
                token.role = roleFromUser !== 'student'
                    ? roleFromUser
                    : roleFromName !== 'student'
                        ? roleFromName
                        : roleFromToken;
                token.isDevSim = true;
                return token;
            }

            if (token.isDevSim) {
                token.role = normalizeSimulatedRole(token.role);
                return token;
            }

            if (token.accessToken && token.accessTokenExpires && Date.now() > token.accessTokenExpires - 60_000) {
                token = await refreshGoogleAccessToken(token);
            }

            const email = (user?.email ?? token.email)?.toLowerCase().trim();
            if (!email) {
                token.role = 'student';
                return token;
            }

            const authorizedUsers = await getAuthorizedUsers();
            const userData = authorizedUsers.get(email);
            token.email = email;

            if (userData) {
                if (userData.source === 'db' && typeof userData.sessionVersion === 'number') {
                    const previousSessionVersion = typeof token.authAccessSessionVersion === 'number'
                        ? token.authAccessSessionVersion
                        : userData.sessionVersion;

                    if (!user?.email && previousSessionVersion !== userData.sessionVersion) {
                        token.role = 'student';
                        delete token.authAccessSessionVersion;
                        return token;
                    }

                    token.authAccessSessionVersion = userData.sessionVersion;
                } else {
                    delete token.authAccessSessionVersion;
                }

                token.role = userData.role;

                if (user?.email) {
                    after(async () => {
                        try {
                            await recordAuthorizedUserAccess(userData, new Date());
                        } catch (err) {
                            console.error('[Auth] Failed to update LAST ACCESS DATE:', redactErrorForLog(err));
                        }
                    });
                }
            } else {
                token.role = 'student';
                if (user?.email) {
                    logAuditAction('AUTH_UNAUTHORIZED_LEADER', {
                        reason: 'RTU email not found in authorized access source',
                    });
                }
            }

        return token;
    },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    callbacks: authCallbacks,
});

export type ServerAuthSession = Session & { accessToken?: string };

const { auth: serverAuth } = NextAuth({
    ...authConfig,
    callbacks: {
        ...authCallbacks,
        async session({ session, token }) {
            return Object.assign(applySessionFields(session, token), {
                accessToken: token.accessToken as string | undefined,
            }) as ServerAuthSession;
        },
    },
});

/**
 * Server-only session projection for Google API route handlers.
 * The public Auth.js handlers use the token-free session callback above.
 */
export async function authWithGoogleToken(): Promise<ServerAuthSession | null> {
    return serverAuth() as Promise<ServerAuthSession | null>;
}
