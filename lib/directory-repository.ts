import 'server-only';

import { createHash } from 'node:crypto';

export type DirectoryLeader = {
    id: string;
    name: string;
    position: string;
    branch: string;
    category?: string;
    email?: string;
    facebookUrl?: string;
    linkedinUrl?: string;
    logoUrl?: string;
};

export type DirectoryOffice = {
    id: string;
    officeName: string;
    location: string;
    headDirector: string;
    email?: string;
    branch: string;
    logoUrl?: string;
    priority?: number;
};

export type DirectoryPayload = {
    data: Array<Record<string, unknown>>;
    leaders: DirectoryLeader[];
    offices: DirectoryOffice[];
    meta: {
        total: number;
        valid: number;
        invalid: number;
        officeSheetUnavailable?: boolean;
        source?: string;
    };
};

export type DirectoryEntryInput = {
    entryType: 'organization' | 'office';
    sourceLabel: string;
    name: string;
    email?: string;
    category?: string;
};

function normalizeKeyPart(value: unknown): string {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 100);
}

export function buildDirectoryKey(input: DirectoryEntryInput): string {
    const identity = [
        input.entryType,
        input.sourceLabel,
        input.name,
        input.email || '',
        input.category || '',
    ].map(normalizeKeyPart).join('|');
    const digest = createHash('sha256').update(identity).digest('hex').slice(0, 16);
    const prefix = normalizeKeyPart(input.entryType) || 'entry';
    return `${prefix}-${digest}`;
}

function proxyLogoUrl(fileId: string, resourceKey: string): string {
    const params = new URLSearchParams();
    if (resourceKey) {
        params.set('resourcekey', resourceKey);
    }

    const query = params.toString();
    return `/api/directory/logos/${encodeURIComponent(fileId)}${query ? `?${query}` : ''}`;
}

function readPublicData(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }

    return value as Record<string, unknown>;
}

function readString(value: unknown): string {
    return typeof value === 'string' ? value : '';
}

function logoUrlForRow(row: {
    imageUrl: string;
    logo?: { driveFileId: string; resourceKey: string } | null;
}): string | undefined {
    if (row.logo?.driveFileId) {
        return proxyLogoUrl(row.logo.driveFileId, row.logo.resourceKey);
    }

    const imageUrl = row.imageUrl.trim();
    if (/^\/api\/directory\/logos\/[a-zA-Z0-9_-]+(?:\?resourcekey=[^\s&]+)?$/i.test(imageUrl)) {
        return imageUrl;
    }

    // Legacy static assets remain valid fallbacks; raw Drive links must never
    // become public directory URLs after the DB cutover.
    if (imageUrl.startsWith('/') && !/^\/\/|^\/api\//.test(imageUrl)) {
        return imageUrl;
    }

    return undefined;
}

function mapDatabaseRows(rows: Array<{
    directoryKey: string;
    entryType: string;
    name: string;
    roleOrOffice: string;
    councilOrUnit: string;
    email: string;
    imageUrl: string;
    profileUrl: string;
    publicDataJson: unknown;
    sortOrder: number;
    logo?: { driveFileId: string; resourceKey: string } | null;
}>): DirectoryPayload {
    const leaders: DirectoryLeader[] = [];
    const offices: DirectoryOffice[] = [];

    for (const row of rows) {
        const publicData = readPublicData(row.publicDataJson);
        const logoUrl = logoUrlForRow(row);
        const email = row.email || readString(publicData.email) || undefined;
        const category = readString(publicData.category) || row.councilOrUnit || undefined;
        const facebookUrl = readString(publicData.facebookUrl) || undefined;
        const linkedinUrl = readString(publicData.linkedinUrl) || undefined;

        if (row.entryType === 'office') {
            offices.push({
                id: row.directoryKey,
                officeName: row.name,
                location: readString(publicData.location),
                headDirector: row.roleOrOffice,
                email,
                branch: row.councilOrUnit,
                logoUrl,
                priority: row.sortOrder,
            });
            continue;
        }

        leaders.push({
            id: row.directoryKey,
            name: row.name,
            position: row.roleOrOffice || 'Organization',
            branch: row.councilOrUnit,
            category,
            email,
            facebookUrl,
            linkedinUrl,
            logoUrl,
        });
    }

    const data = [
        ...leaders,
        ...offices.map((office) => ({
            id: office.id,
            name: office.officeName,
            position: office.headDirector ? `Head/Director: ${office.headDirector}` : 'Office Contact',
            branch: office.branch,
            priority: office.priority,
            email: office.email,
            location: office.location,
            logoUrl: office.logoUrl,
            entryType: 'office' as const,
        })),
    ];

    return {
        data,
        leaders,
        offices,
        meta: {
            total: rows.length,
            valid: rows.length,
            invalid: 0,
            source: 'db',
        },
    };
}

export async function fetchDirectoryDataFromDatabase(): Promise<DirectoryPayload> {
    const { prisma } = await import('@/lib/prisma');
    const rows = await prisma.directoryEntry.findMany({
        where: { enabled: true },
        orderBy: [
            { entryType: 'asc' },
            { sortOrder: 'asc' },
            { name: 'asc' },
        ],
        select: {
            directoryKey: true,
            entryType: true,
            name: true,
            roleOrOffice: true,
            councilOrUnit: true,
            email: true,
            imageUrl: true,
            profileUrl: true,
            publicDataJson: true,
            sortOrder: true,
            logo: {
                select: {
                    driveFileId: true,
                    resourceKey: true,
                },
            },
        },
    });

    return mapDatabaseRows(rows);
}

export function resolveDirectorySource(): 'sheet' | 'db-with-sheets-fallback' | 'db' {
    const value = (process.env.DIRECTORY_SOURCE || 'sheet').trim().toLowerCase();
    if (value === 'db' || value === 'db-with-sheets-fallback') {
        return value;
    }

    return 'sheet';
}

export async function resolveDirectoryData(
    fetchFromSheets: () => Promise<DirectoryPayload>,
): Promise<DirectoryPayload> {
    const source = resolveDirectorySource();
    if (source === 'sheet') {
        return fetchFromSheets();
    }

    try {
        const databasePayload = await fetchDirectoryDataFromDatabase();
        if (source === 'db-with-sheets-fallback' && databasePayload.meta.valid === 0) {
            const sheetPayload = await fetchFromSheets();
            return {
                ...sheetPayload,
                meta: { ...sheetPayload.meta, source: 'sheet-fallback' },
            };
        }

        return databasePayload;
    } catch (error) {
        if (source !== 'db-with-sheets-fallback') {
            throw error;
        }

        const sheetPayload = await fetchFromSheets();
        return {
            ...sheetPayload,
            meta: { ...sheetPayload.meta, source: 'sheet-fallback' },
        };
    }
}

export async function listDirectoryEntriesForAdmin() {
    const { prisma } = await import('@/lib/prisma');
    const rows = await prisma.directoryEntry.findMany({
        where: { enabled: true },
        orderBy: [{ entryType: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
        select: {
            directoryKey: true,
            entryType: true,
            name: true,
            roleOrOffice: true,
            councilOrUnit: true,
            imageUrl: true,
            logo: {
                select: {
                    fileName: true,
                    mimeType: true,
                    sizeBytes: true,
                    uploadedBy: true,
                    updatedAt: true,
                    driveFileId: true,
                    resourceKey: true,
                },
            },
        },
    });

    return rows.map((row) => ({
        directoryKey: row.directoryKey,
        entryType: row.entryType,
        name: row.name,
        roleOrOffice: row.roleOrOffice,
        councilOrUnit: row.councilOrUnit,
        logoUrl: logoUrlForRow(row),
        logo: row.logo
            ? {
                fileName: row.logo.fileName,
                mimeType: row.logo.mimeType,
                sizeBytes: row.logo.sizeBytes,
                uploadedBy: row.logo.uploadedBy,
                updatedAt: row.logo.updatedAt,
            }
            : null,
    }));
}

export function toDirectoryLogoUrl(fileId: string, resourceKey = ''): string {
    return proxyLogoUrl(fileId, resourceKey);
}
