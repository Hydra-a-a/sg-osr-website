import NextAuth from 'next-auth';
import { after } from 'next/server';
import type { JWT } from 'next-auth/jwt';
import { authConfig } from '@/lib/auth.config';
import { getSheetData, updateSheetCell } from '@/lib/sheets';
import { logAuditAction } from '@/lib/audit';
import { redactErrorForLog } from '@/lib/security';

interface LeaderRecord {
    email: string;
    name: string;
    council: string;
    /** 1-based sheet row number (row 1 = header, data starts at row 2) */
    rowIndex: number;
}

/**
 * Fetch authorized Student Leader rows from the SL Access tab.
 * Returns a Map keyed by lowercase email, cached for 5 minutes.
 */
let cachedLeaders: Map<string, LeaderRecord> | null = null;
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

function getAuthSheetConfig(): { spreadsheetId: string; range: string } | null {
    const spreadsheetId = process.env.GOOGLE_SHEETS_AUTH_ID;
    const range = process.env.GOOGLE_SHEETS_AUTH_TAB ?? 'SL Access!A2:E';

    if (!spreadsheetId) {
        console.error('[Auth] Missing GOOGLE_SHEETS_AUTH_ID; leader mapping disabled.');
        return null;
    }

    return { spreadsheetId, range };
}

async function getAuthorizedLeaders(): Promise<Map<string, LeaderRecord>> {
    const now = Date.now();
    if (cachedLeaders && now - cacheTimestamp < CACHE_TTL) {
        return cachedLeaders;
    }

    try {
        const config = getAuthSheetConfig();
        if (!config) {
            return new Map();
        }

        const rows = await getSheetData(config.spreadsheetId, config.range);
        const leaders = new Map<string, LeaderRecord>();

        if (rows && rows.length > 0) {
            rows.forEach((row, i) => {
                const email = (row[0] || '').toString().trim().toLowerCase();
                if (!email) return;
                leaders.set(email, {
                    email,
                    name: (row[1] || '').toString().trim(),
                    council: (row[2] || '').toString().trim(),
                    rowIndex: i + 2, // +2: row 1 is the header
                });
            });
        }

        cachedLeaders = leaders;
        cacheTimestamp = now;
        return leaders;
    } catch (error) {
        console.error('[Auth] Failed to fetch authorized leaders:', redactErrorForLog(error));
        // Fail closed: never grant leader role when auth source is unavailable.
        cachedLeaders = null;
        cacheTimestamp = 0;
        return new Map();
    }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    callbacks: {
        ...authConfig.callbacks,
        /**
         * jwt callback — attach role to the token.
         * Re-validates leader role on each JWT callback to avoid stale privilege.
         */
        async jwt({ token, user, account }) {
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

            if (account?.provider === 'dev-sim' && user?.email) {
                token.email = user.email.toLowerCase().trim();
                token.role = (user as { role?: string }).role === 'leader' ? 'leader' : 'student';
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

            const leaders = await getAuthorizedLeaders();
            const leaderData = leaders.get(email);

            token.email = email;

            if (leaderData) {
                token.role = 'leader';

                // Only write access date during active sign-in flow.
                if (user?.email) {
                    const config = getAuthSheetConfig();
                    after(async () => {
                        if (!config) return;
                        try {
                            await updateSheetCell(
                                config.spreadsheetId,
                                `SL Access!D${leaderData.rowIndex}`,
                                [[new Date().toLocaleString()]]
                            );
                        } catch (err) {
                            console.error('[Auth] Failed to update LAST ACCESS DATE:', redactErrorForLog(err));
                        }
                    });
                }
            } else {
                token.role = 'student';
                if (user?.email) {
                    logAuditAction('AUTH_UNAUTHORIZED_LEADER', {
                        reason: 'RTU email not found in SL Access sheet',
                    });
                }
            }

            return token;
        },
    },
});

