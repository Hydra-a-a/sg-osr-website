import NextAuth from 'next-auth';
import { after } from 'next/server';
import type { JWT } from 'next-auth/jwt';
import { authConfig } from '@/lib/auth.config';
import { getSheetData, updateSheetCell } from '@/lib/sheets';
import { logAuditAction } from '@/lib/audit';
import { redactErrorForLog } from '@/lib/security';

import type { PortalRole } from '@/lib/portal-mode';

interface AuthorizedUserRecord {
    email: string;
    name: string;
    council: string;
    /** Granular role parsed from the Google Sheet. */
    role: PortalRole;
    /** 1-based sheet row number. */
    rowIndex: number;
    /** Column letter to update for access timestamp (e.g. D). */
    lastAccessColumnLetter: string;
}

/**
 * Fetch authorized user rows from the SL Access tab.
 * Returns a Map keyed by lowercase email, cached for 5 minutes.
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

function getAuthSheetConfig(): { spreadsheetId: string; range: string } | null {
    const spreadsheetId = process.env.GOOGLE_SHEETS_AUTH_ID;
    const range = process.env.GOOGLE_SHEETS_AUTH_TAB ?? 'SL Access!A1:Z';

    if (!spreadsheetId) {
        console.error('[Auth] Missing GOOGLE_SHEETS_AUTH_ID; leader mapping disabled.');
        return null;
    }

    return { spreadsheetId, range };
}

function normalizeHeader(value: unknown): string {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

function parseRangeStartRow(range: string): number {
    const match = range.match(/![A-Za-z]+(\d+)/);
    const startRow = Number(match?.[1] || '1');
    return Number.isFinite(startRow) && startRow > 0 ? startRow : 1;
}

function columnIndexToLetter(index: number): string {
    let n = index + 1;
    let letters = '';

    while (n > 0) {
        const mod = (n - 1) % 26;
        letters = String.fromCharCode(65 + mod) + letters;
        n = Math.floor((n - mod) / 26);
    }

    return letters || 'D';
}

function parseEnabledValue(value: unknown): boolean {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) return true;
    if (['true', '1', 'yes', 'y', 'active', 'enabled'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'inactive', 'disabled', 'revoked', 'blocked'].includes(normalized)) return false;
    return true;
}

function parseOfficerAccessFlag(value: unknown): boolean {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) return false;

    return [
        '1',
        'true',
        'yes',
        'y',
        'enabled',
        'allow',
        'allowed',
        'officer',
        'admin',
    ].includes(normalized);
}

function inferUserRoleFromRow(row: string[]): PortalRole {
    const normalized = row.join(' ').trim().toLowerCase();

    if (!normalized) {
        return 'leader';
    }

    if (normalized.includes('officer') || normalized.includes('admin')) {
        return 'officer';
    }

    if (normalized.includes('leader')) {
        return 'leader';
    }

    return 'leader';
}

/**
 * Parses the role column value from Google Sheets into a PortalRole.
 * - 'officer' / 'admin' / 'grievance_officer' → 'officer'
 * - 'leader' / 'student_leader' / 'sl' → 'leader'
 * - anything else → 'student' (effectively denied elevated access)
 */
function parseUserRole(value: unknown): PortalRole {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) return 'leader'; // Backwards compat: no role column = leader
    if (
        normalized.includes('officer')
        || normalized.includes('admin')
        || normalized.includes('grievance officer')
        || normalized.includes('grievance_officer')
    ) {
        return 'officer';
    }
    if (
        normalized.includes('leader')
        || normalized.includes('student_leader')
        || normalized.includes('student leader')
        || normalized.includes('student leader access')
        || normalized.includes('leader access')
        || normalized === 'sl'
    ) {
        return 'leader';
    }
    return 'student';
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

function detectHeaderMap(rows: string[][]): Map<string, number> | null {
    if (!rows.length) return null;
    const firstRow = rows[0] || [];
    const map = new Map<string, number>();

    firstRow.forEach((cell, index) => {
        const key = normalizeHeader(cell);
        if (key) {
            map.set(key, index);
        }
    });

    const hasEmailHeader = [
        'email',
        'email_address',
        'rtu_email',
        'rtu_email_address',
        'school_email',
        'school_email_address',
        'account_email',
        'institutional_email',
        'institutional_email_address',
    ].some((key) => map.has(key));
    return hasEmailHeader ? map : null;
}

function firstExistingIndex(headerMap: Map<string, number>, keys: string[], fallback: number): number {
    for (const key of keys) {
        const index = headerMap.get(key);
        if (typeof index === 'number') {
            return index;
        }
    }
    return fallback;
}

export async function getAuthorizedUsers(): Promise<Map<string, AuthorizedUserRecord>> {
    const now = Date.now();
    if (cachedUsers && now - cacheTimestamp < CACHE_TTL) {
        return cachedUsers;
    }

    try {
        const config = getAuthSheetConfig();
        if (!config) {
            return new Map();
        }

        const rawRows = await getSheetData(config.spreadsheetId, config.range);
        const rows = rawRows.map((row) => row.map((cell) => String(cell ?? '').trim()));
        const users = new Map<string, AuthorizedUserRecord>();
        const startRow = parseRangeStartRow(config.range);

        const headerMap = detectHeaderMap(rows);
        
        // Exact column map based on the screenshot: A=0 (Email), B=1 (Name), C=2 (Council), D=3 (LastLogin), E=4 (AccessEnabled), F=5 (Role), G=6 (ApprovedBy)
        const emailIndex = headerMap ? firstExistingIndex(headerMap, ['email', 'email_address', 'rtu_email'], 0) : 0;
        const nameIndex = headerMap ? firstExistingIndex(headerMap, ['name', 'full_name', 'user_name'], 1) : 1;
        const councilIndex = headerMap ? firstExistingIndex(headerMap, ['council', 'unit', 'department', 'council_name'], 2) : 2;
        const lastAccessIndex = headerMap ? firstExistingIndex(headerMap, ['last_login', 'last_access'], 3) : 3;
        const enabledIndex = headerMap ? firstExistingIndex(headerMap, ['access_enabled', 'enabled'], 4) : 4; // Failsafe to col E
        const roleIndex = headerMap ? firstExistingIndex(headerMap, ['role', 'access_level', 'position'], 5) : 5; // Failsafe to col F
        const officerAccessIndex = headerMap ? firstExistingIndex(headerMap, ['officer_access', 'is_officer'], -1) : -1;
        
        const firstDataIndex = headerMap ? 1 : 1; // Always assume row 1 is header
        const lastAccessColumnLetter = columnIndexToLetter(lastAccessIndex >= 0 ? lastAccessIndex : 3);

        if (rows && rows.length > 0) {
            rows.forEach((row, i) => {
                if (i < firstDataIndex) return;

                const email = (row[emailIndex] || '').toString().trim().toLowerCase();
                if (!email) return;

                if (enabledIndex >= 0 && !parseEnabledValue(row[enabledIndex])) {
                    return;
                }

                const hasExplicitOfficerAccess = officerAccessIndex >= 0 && parseOfficerAccessFlag(row[officerAccessIndex]);

                // Parse the granular role — students in the sheet are filtered out.
                // Fall back to row-level inference if the sheet uses a broader access label.
                const rawRole = roleIndex >= 0 ? row[roleIndex] : null;
                let parsedRole = rawRole ? parseUserRole(rawRole) : inferUserRoleFromRow(row);
                
                if (hasExplicitOfficerAccess) {
                    parsedRole = 'officer';
                }

                // ADDED DEBUG LOG:
                if (email === '2023-100433@rtu.edu.ph') {
                    console.log(`[AUTH DEBUG] Email: ${email} -> rawRole: '${rawRole}', officerAccessFlag: ${hasExplicitOfficerAccess}, parsedRole: '${parsedRole}'`);
                }

                const role = parsedRole;
                if (role === 'student') {
                    return; // Skip rows explicitly marked as student
                }

                const existingUser = users.get(email);
                if (existingUser) {
                    const currentPriority = existingUser.role === 'officer' ? 2 : 1;
                    const newPriority = role === 'officer' ? 2 : 1;
                    if (newPriority <= currentPriority) {
                        return; // Retain the higher-privileged role
                    }
                }

                users.set(email, {
                    email,
                    name: (row[nameIndex] || '').toString().trim(),
                    council: (row[councilIndex] || '').toString().trim(),
                    role,
                    rowIndex: startRow + i,
                    lastAccessColumnLetter,
                });
            });
        }

        cachedUsers = users;
        cacheTimestamp = now;
        return users;
    } catch (error) {
        console.error('[Auth] Failed to fetch authorized users:', redactErrorForLog(error));
        // Fail closed: never grant elevated role when auth source is unavailable.
        cachedUsers = null;
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
            const isLocalSimEnabled = process.env.NODE_ENV !== 'production'
                && process.env.ENABLE_LOCAL_LOGIN_SIMULATION === 'true';
            const isDevSimProvider = account?.provider === 'dev-sim'
                || (isLocalSimEnabled && account?.provider === 'credentials');

            // ── Google provider: store OAuth tokens ─────────────────────────────────
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

            // ── Dev-sim: persist role directly, skip Sheets lookup ───────────────────
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
                // Subsequent requests for simulated sessions — preserve role as-is
                token.role = normalizeSimulatedRole(token.role);
                return token;
            }

            // ── Google: refresh access token if near expiry ──────────────────────────
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
                token.role = userData.role; // 'leader' or 'officer'

                // Only write access date during active sign-in flow.
                if (user?.email) {
                    const config = getAuthSheetConfig();
                    after(async () => {
                        if (!config) return;
                        try {
                            await updateSheetCell(
                                config.spreadsheetId,
                                `SL Access!${userData.lastAccessColumnLetter}${userData.rowIndex}`,
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

