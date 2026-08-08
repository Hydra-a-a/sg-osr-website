import 'server-only';

import { ApiError } from '@/lib/api-errors';
import { clearSheetData, ensureSpreadsheetTab, updateSheetCell } from '@/lib/sheets';
import { redactErrorForLog } from '@/lib/security';

export const DIRECTORY_EXPORT_HEADERS = [
    'Directory Key',
    'Entry Type',
    'Name',
    'Role / Office',
    'Category / Unit',
    'Logo URL',
    'Profile URL',
    'Sort Order',
] as const;

type DirectoryExportRow = {
    directoryKey: string;
    entryType: string;
    name: string;
    roleOrOffice: string;
    councilOrUnit: string;
    imageUrl: string;
    profileUrl: string;
    sortOrder: number;
};

function getPrisma() {
    return import('@/lib/prisma').then(({ prisma }) => prisma);
}

function quoteSheetTitle(title: string): string {
    return `'${title.replace(/'/g, "''")}'`;
}

function getExportTabTitle(): string {
    return String(process.env.DIRECTORY_EXPORT_SHEET_TAB || 'Directory Export').trim() || 'Directory Export';
}

function getSpreadsheetId(): string {
    return String(process.env.GOOGLE_SHEETS_DIRECTORY_ID || process.env.GOOGLE_SHEETS_INFO_ID || '').trim();
}

function getPublicAppUrl(): string {
    return String(process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || process.env.NEXTAUTH_URL || 'https://osr.rtu.edu.ph')
        .trim()
        .replace(/\/$/, '');
}

function sanitizeProxyLogoUrl(value: unknown): string {
    const relativeUrl = String(value || '').trim();
    if (!/^\/api\/directory\/logos\/[a-zA-Z0-9_-]+(?:\?resourcekey=[^\s&]+)?$/i.test(relativeUrl)) {
        return '';
    }

    return `${getPublicAppUrl()}${relativeUrl}`;
}

function sanitizePublicUrl(value: unknown): string {
    const candidate = String(value || '').trim();
    if (!candidate) return '';

    try {
        const parsed = new URL(candidate, getPublicAppUrl());
        if (!['http:', 'https:'].includes(parsed.protocol)) return '';
        return parsed.toString();
    } catch {
        return '';
    }
}

export async function getDirectoryExportRows(): Promise<DirectoryExportRow[]> {
    const prisma = await getPrisma();
    const rows = await prisma.$queryRaw<Array<DirectoryExportRow>>`
        SELECT
            "directoryKey",
            "entryType",
            "name",
            "roleOrOffice",
            "councilOrUnit",
            "imageUrl",
            "profileUrl",
            "sortOrder"
        FROM public_sheet_directory_entries
        ORDER BY "sortOrder" ASC, "entryType" ASC, lower("name") ASC, "directoryKey" ASC
    `;

    return rows.map((row) => ({
        directoryKey: String(row.directoryKey || ''),
        entryType: String(row.entryType || ''),
        name: String(row.name || ''),
        roleOrOffice: String(row.roleOrOffice || ''),
        councilOrUnit: String(row.councilOrUnit || ''),
        imageUrl: sanitizeProxyLogoUrl(row.imageUrl),
        profileUrl: sanitizePublicUrl(row.profileUrl),
        sortOrder: Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : 0,
    }));
}

function toSheetRows(rows: DirectoryExportRow[]): string[][] {
    return rows.map((row) => [
        row.directoryKey,
        row.entryType,
        row.name,
        row.roleOrOffice,
        row.councilOrUnit,
        row.imageUrl,
        row.profileUrl,
        String(row.sortOrder),
    ]);
}

async function updateExportState(data: {
    status: string;
    requestedBy: string;
    lastAttemptAt?: Date | null;
    lastSucceededAt?: Date | null;
    lastError?: string;
}) {
    const prisma = await getPrisma();
    await prisma.directoryExportState.upsert({
        where: { id: 'directory' },
        create: {
            id: 'directory',
            status: data.status,
            requestedBy: data.requestedBy,
            lastAttemptAt: data.lastAttemptAt ?? null,
            lastSucceededAt: data.lastSucceededAt ?? null,
            lastError: data.lastError || '',
            updatedAt: new Date(),
        },
        update: {
            status: data.status,
            requestedBy: data.requestedBy,
            ...(data.lastAttemptAt !== undefined ? { lastAttemptAt: data.lastAttemptAt } : {}),
            ...(data.lastSucceededAt !== undefined ? { lastSucceededAt: data.lastSucceededAt } : {}),
            ...(data.lastError !== undefined ? { lastError: data.lastError } : {}),
        },
    });
}

export async function exportDirectoryToSheets(requestedBy = 'directory-export') {
    if (process.env.SHEETS_EXPORT_ENABLED !== 'true') {
        throw new ApiError(503, 'SHEETS_EXPORT_DISABLED', 'Sheets export is not enabled.', undefined, false);
    }

    const spreadsheetId = getSpreadsheetId();
    if (!spreadsheetId) {
        throw new ApiError(503, 'SHEETS_EXPORT_MISCONFIGURED', 'Sheets export is not configured.', undefined, false);
    }

    const startedAt = new Date();
    await updateExportState({ status: 'running', requestedBy, lastAttemptAt: startedAt, lastError: '' });

    try {
        const tabTitle = getExportTabTitle();
        const quotedTab = quoteSheetTitle(tabTitle);
        const rows = await getDirectoryExportRows();

        await ensureSpreadsheetTab(spreadsheetId, tabTitle);
        await clearSheetData(spreadsheetId, `${quotedTab}!A:Z`);
        await updateSheetCell(spreadsheetId, `${quotedTab}!A1`, [
            [...DIRECTORY_EXPORT_HEADERS],
            ...toSheetRows(rows),
        ]);

        const succeededAt = new Date();
        await updateExportState({
            status: 'succeeded',
            requestedBy,
            lastSucceededAt: succeededAt,
            lastError: '',
        });

        return {
            tabTitle,
            rowCount: rows.length,
            exportedAt: succeededAt.toISOString(),
        };
    } catch (error) {
        console.error('[Directory Export] Failed:', redactErrorForLog(error));
        try {
            await updateExportState({
                status: 'failed',
                requestedBy,
                lastError: 'Export failed; retry required.',
            });
        } catch (stateError) {
            console.error('[Directory Export] Failed to record export state:', redactErrorForLog(stateError));
        }
        throw new ApiError(502, 'SHEETS_EXPORT_FAILED', 'Directory export failed.', undefined, false);
    }
}
