import 'server-only';

import { getSheetData, updateSheetCell } from '@/lib/sheets';
import { redactErrorForLog } from '@/lib/security';
import type { PortalRole } from '@/lib/portal-mode';

const INSTITUTIONAL_EMAIL_DOMAIN = 'rtu.edu.ph';
const ENABLED_TRUE_VALUES = new Set(['true', '1', 'yes', 'y', 'active', 'enabled']);
const ENABLED_FALSE_VALUES = new Set(['false', '0', 'no', 'n', 'inactive', 'disabled', 'revoked', 'blocked']);

export type AuthAccessSource = 'sheets' | 'db' | 'db-with-sheets-fallback';

export interface AuthorizedUserRecord {
    email: string;
    name: string;
    council: string;
    role: PortalRole;
    source: 'sheets' | 'db';
    rowIndex?: number;
    lastAccessColumnLetter?: string;
    dbId?: string;
    sessionVersion?: number;
    revokedAfter?: Date | null;
}

interface ParsedAuthorizedUserRow {
    email: string;
    name: string;
    council: string;
    role: PortalRole;
    accessEnabled: boolean;
    approvedBy: string;
    rowIndex: number;
    lastAccessColumnLetter: string;
}

interface AuthSheetConfig {
    spreadsheetId: string;
    tabName: string;
    range: string;
}

export function resolveAuthAccessSource(): AuthAccessSource {
    const normalized = String(process.env.AUTH_ACCESS_SOURCE || '').trim().toLowerCase();
    if (normalized === 'db' || normalized === 'database') return 'db';
    if (
        normalized === 'db-with-sheets-fallback'
        || normalized === 'database-with-sheets-fallback'
        || normalized === 'db_fallback'
    ) {
        return 'db-with-sheets-fallback';
    }
    return 'sheets';
}

export function getAuthSheetConfig(): AuthSheetConfig | null {
    const spreadsheetId = process.env.GOOGLE_SHEETS_AUTH_ID;
    const envTab = process.env.GOOGLE_SHEETS_AUTH_TAB || 'SL Access';
    const tabName = envTab.split('!')[0] || 'SL Access';
    const range = `${tabName}!A1:Z`;

    if (!spreadsheetId) {
        console.error('[Auth] Missing GOOGLE_SHEETS_AUTH_ID; leader mapping disabled.');
        return null;
    }

    return { spreadsheetId, tabName, range };
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
    if (ENABLED_TRUE_VALUES.has(normalized)) return true;
    if (ENABLED_FALSE_VALUES.has(normalized)) return false;
    return false;
}

function parseOfficerAccessFlag(value: unknown): boolean {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) return false;
    return ['1', 'true', 'yes', 'y', 'enabled', 'allow', 'allowed', 'officer', 'admin'].includes(normalized);
}

function inferUserRoleFromRow(row: string[]): PortalRole {
    const normalized = row.join(' ').trim().toLowerCase();
    if (!normalized) return 'leader';
    if (normalized.includes('officer') || normalized.includes('admin')) return 'officer';
    if (normalized.includes('leader')) return 'leader';
    return 'leader';
}

export function parseUserRole(value: unknown): PortalRole {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) return 'leader';
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

function detectHeaderMap(rows: string[][]): Map<string, number> | null {
    if (!rows.length) return null;
    const firstRow = rows[0] || [];
    const map = new Map<string, number>();

    firstRow.forEach((cell, index) => {
        const key = normalizeHeader(cell);
        if (key) map.set(key, index);
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
        if (typeof index === 'number') return index;
    }
    return fallback;
}

function isInstitutionalEmail(value: unknown): boolean {
    const normalized = String(value ?? '').trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) && normalized.endsWith(`@${INSTITUTIONAL_EMAIL_DOMAIN}`);
}

export function parseAuthorizedUsersFromSheetRows(rawRows: unknown[][], range: string): ParsedAuthorizedUserRow[] {
    const rows = rawRows.map((row) => row.map((cell) => String(cell ?? '').trim()));
    const startRow = parseRangeStartRow(range);
    const headerMap = detectHeaderMap(rows);
    const emailIndex = headerMap ? firstExistingIndex(headerMap, ['email', 'email_address', 'rtu_email'], 0) : 0;
    const nameIndex = headerMap ? firstExistingIndex(headerMap, ['name', 'full_name', 'user_name'], 1) : 1;
    const councilIndex = headerMap ? firstExistingIndex(headerMap, ['council', 'unit', 'department', 'council_name'], 2) : 2;
    const lastAccessIndex = headerMap ? firstExistingIndex(headerMap, ['last_login', 'last_access'], 3) : 3;
    const enabledIndex = headerMap ? firstExistingIndex(headerMap, ['access_enabled', 'enabled'], 4) : 4;
    const roleIndex = headerMap ? firstExistingIndex(headerMap, ['role', 'access_level', 'position'], 5) : 5;
    const approvedByIndex = headerMap ? firstExistingIndex(headerMap, ['approved_by', 'approvedby'], 6) : 6;
    const officerAccessIndex = headerMap ? firstExistingIndex(headerMap, ['officer_access', 'is_officer'], -1) : -1;
    const lastAccessColumnLetter = columnIndexToLetter(lastAccessIndex >= 0 ? lastAccessIndex : 3);

    return rows.flatMap((row, i) => {
        if (i < 1) return [];
        const email = (row[emailIndex] || '').toString().trim().toLowerCase();
        if (!email) return [];
        if (!isInstitutionalEmail(email)) return [];

        const accessEnabled = enabledIndex < 0 || parseEnabledValue(row[enabledIndex]);
        const hasExplicitOfficerAccess = officerAccessIndex >= 0 && parseOfficerAccessFlag(row[officerAccessIndex]);
        const rawRole = roleIndex >= 0 ? row[roleIndex] : null;
        let role = rawRole ? parseUserRole(rawRole) : inferUserRoleFromRow(row);
        if (hasExplicitOfficerAccess) role = 'officer';

        return [{
            email,
            name: (row[nameIndex] || '').toString().trim(),
            council: (row[councilIndex] || '').toString().trim(),
            role,
            accessEnabled,
            approvedBy: approvedByIndex >= 0 ? String(row[approvedByIndex] || '').trim() : '',
            rowIndex: startRow + i,
            lastAccessColumnLetter,
        }];
    });
}

export function buildAuthorizedUserMapFromRows(rows: ParsedAuthorizedUserRow[]): Map<string, AuthorizedUserRecord> {
    const users = new Map<string, AuthorizedUserRecord>();
    const groupedRows = new Map<string, ParsedAuthorizedUserRow[]>();
    const conflictingDuplicateEmails = new Set<string>();

    rows.forEach((row) => {
        const existingRows = groupedRows.get(row.email) || [];
        if (existingRows.some((existing) => existing.accessEnabled !== row.accessEnabled || existing.role !== row.role)) {
            conflictingDuplicateEmails.add(row.email);
        }
        existingRows.push(row);
        groupedRows.set(row.email, existingRows);
    });

    rows.forEach((row) => {
        if (conflictingDuplicateEmails.has(row.email)) return;
        if (!row.accessEnabled || row.role === 'student') return;

        const existingUser = users.get(row.email);
        if (existingUser) {
            const currentPriority = existingUser.role === 'officer' ? 2 : 1;
            const newPriority = row.role === 'officer' ? 2 : 1;
            if (newPriority <= currentPriority) return;
        }

        users.set(row.email, {
            email: row.email,
            name: row.name,
            council: row.council,
            role: row.role,
            source: 'sheets',
            rowIndex: row.rowIndex,
            lastAccessColumnLetter: row.lastAccessColumnLetter,
        });
    });

    return users;
}

export async function loadAuthorizedUsersFromSheets(): Promise<Map<string, AuthorizedUserRecord>> {
    const config = getAuthSheetConfig();
    if (!config) return new Map();
    const rawRows = await getSheetData(config.spreadsheetId, config.range);
    return buildAuthorizedUserMapFromRows(parseAuthorizedUsersFromSheetRows(rawRows, config.range));
}

async function loadAuthorizedUsersFromDbWithKnownEmails(): Promise<{
    users: Map<string, AuthorizedUserRecord>;
    knownEmails: Set<string>;
}> {
    const { prisma } = await import('@/lib/prisma');
    const rows = await prisma.authorizedUser.findMany({
        orderBy: [{ email: 'asc' }],
    });
    const now = Date.now();
    const users = new Map<string, AuthorizedUserRecord>();
    const knownEmails = new Set<string>();

    rows.forEach((row) => {
        const email = row.email.toLowerCase().trim();
        knownEmails.add(email);
        if (!row.accessEnabled || row.role === 'student') return;
        if (row.revokedAfter && row.revokedAfter.getTime() <= now) return;

        users.set(email, {
            email,
            name: row.name,
            council: row.council,
            role: row.role as PortalRole,
            source: 'db',
            dbId: row.id,
            sessionVersion: row.sessionVersion,
            revokedAfter: row.revokedAfter,
        });
    });

    return { users, knownEmails };
}

export async function loadAuthorizedUsersFromDb(): Promise<Map<string, AuthorizedUserRecord>> {
    return (await loadAuthorizedUsersFromDbWithKnownEmails()).users;
}

export async function loadAuthorizedUsers(): Promise<Map<string, AuthorizedUserRecord>> {
    const source = resolveAuthAccessSource();

    if (source === 'sheets') return loadAuthorizedUsersFromSheets();
    if (source === 'db') return loadAuthorizedUsersFromDb();

    let dbResult: Awaited<ReturnType<typeof loadAuthorizedUsersFromDbWithKnownEmails>>;
    try {
        dbResult = await loadAuthorizedUsersFromDbWithKnownEmails();
    } catch (error) {
        console.warn('[Auth] DB access source unavailable; falling back to Sheets:', redactErrorForLog(error));
        return loadAuthorizedUsersFromSheets();
    }

    let sheetUsers: Map<string, AuthorizedUserRecord>;
    try {
        sheetUsers = await loadAuthorizedUsersFromSheets();
    } catch (error) {
        console.warn('[Auth] Sheet fallback source unavailable; using DB auth access only:', redactErrorForLog(error));
        return dbResult.users;
    }

    const mergedUsers = new Map<string, AuthorizedUserRecord>();

    sheetUsers.forEach((sheetUser, email) => {
        if (!dbResult.knownEmails.has(email)) {
            mergedUsers.set(email, sheetUser);
        }
    });

    dbResult.users.forEach((dbUser, email) => {
        mergedUsers.set(email, dbUser);
    });

    return mergedUsers;
}

export async function recordAuthorizedUserAccess(userData: AuthorizedUserRecord, accessedAt: Date): Promise<void> {
    if (userData.source === 'db' && userData.dbId) {
        const { prisma } = await import('@/lib/prisma');
        await prisma.authorizedUser.update({
            where: { id: userData.dbId },
            data: { lastAccessAt: accessedAt },
        });
        return;
    }

    const config = getAuthSheetConfig();
    if (!config || !userData.rowIndex || !userData.lastAccessColumnLetter) return;

    await updateSheetCell(
        config.spreadsheetId,
        `${config.tabName}!${userData.lastAccessColumnLetter}${userData.rowIndex}`,
        [[accessedAt.toLocaleString()]],
    );
}
