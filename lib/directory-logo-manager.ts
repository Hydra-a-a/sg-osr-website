import { ApiError } from '@/lib/api-errors';
import {
    getOrganizationLogosFolderId,
    trashDriveFileById,
    uploadOrganizationLogoToDrive,
} from '@/lib/google-drive';
import {
    listDirectoryEntriesForAdmin,
    toDirectoryLogoUrl,
} from '@/lib/directory-repository';

export const DIRECTORY_LOGO_MAX_BYTES = 5 * 1024 * 1024;

const MIME_SIGNATURES: Record<string, (bytes: Uint8Array) => boolean> = {
    'image/png': (bytes) => bytes.length >= 8
        && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
        && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a,
    'image/jpeg': (bytes) => bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
    'image/webp': (bytes) => bytes.length >= 12
        && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
        && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP',
};

function getPrisma() {
    return import('@/lib/prisma').then(({ prisma }) => prisma);
}

function normalizeDirectoryKey(value: unknown): string {
    const key = String(value || '').trim();
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,119}$/.test(key)) {
        throw new ApiError(400, 'INVALID_DIRECTORY_KEY', 'Invalid directory entry.');
    }
    return key;
}

function normalizeMimeType(value: string): string {
    if (value === 'image/jpg') return 'image/jpeg';
    return value;
}

export async function validateDirectoryLogoFile(file: File): Promise<{
    buffer: Buffer;
    mimeType: string;
    fileName: string;
    sizeBytes: number;
}> {
    if (typeof File === 'undefined' || !(file instanceof File) || file.size <= 0) {
        throw new ApiError(400, 'INVALID_LOGO_FILE', 'Choose a logo image to upload.');
    }
    if (file.size > DIRECTORY_LOGO_MAX_BYTES) {
        throw new ApiError(413, 'LOGO_TOO_LARGE', 'Logo files must be 5 MB or smaller.');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const reportedMimeType = normalizeMimeType(String(file.type || '').toLowerCase());
    const detectedMimeType = Object.entries(MIME_SIGNATURES)
        .find(([, matches]) => matches(buffer))?.[0];

    if (!detectedMimeType || (reportedMimeType && reportedMimeType !== detectedMimeType)) {
        throw new ApiError(415, 'UNSUPPORTED_LOGO_TYPE', 'Only PNG, JPEG, and WebP logos are accepted.');
    }

    return {
        buffer,
        mimeType: detectedMimeType,
        fileName: String(file.name || 'organization-logo'),
        sizeBytes: buffer.byteLength,
    };
}

async function markDirectoryExportPending(requestedBy: string): Promise<void> {
    const prisma = await getPrisma();
    await prisma.directoryExportState.upsert({
        where: { id: 'directory' },
        create: {
            id: 'directory',
            status: 'pending',
            requestedBy,
            updatedAt: new Date(),
        },
        update: {
            status: 'pending',
            lastError: '',
            requestedBy,
        },
    });
}

export async function getDirectoryAdminPayload() {
    const prisma = await getPrisma();
    const [entries, exportState] = await Promise.all([
        listDirectoryEntriesForAdmin(),
        prisma.directoryExportState.findUnique({ where: { id: 'directory' } }),
    ]);

    return {
        entries,
        exportState: exportState ? {
            status: exportState.status,
            lastAttemptAt: exportState.lastAttemptAt,
            lastSucceededAt: exportState.lastSucceededAt,
            lastError: exportState.lastError,
            requestedBy: exportState.requestedBy,
        } : {
            status: 'pending',
            lastAttemptAt: null,
            lastSucceededAt: null,
            lastError: '',
            requestedBy: '',
        },
    };
}

export async function replaceDirectoryLogo(input: {
    directoryKey: string;
    file: File;
    actorEmail: string;
}) {
    const directoryKey = normalizeDirectoryKey(input.directoryKey);
    const validated = await validateDirectoryLogoFile(input.file);
    const prisma = await getPrisma();
    const existing = await prisma.directoryEntry.findUnique({
        where: { directoryKey },
        select: {
            id: true,
            enabled: true,
            imageUrl: true,
            logo: {
                select: { driveFileId: true },
            },
        },
    });

    if (!existing || !existing.enabled) {
        throw new ApiError(404, 'DIRECTORY_ENTRY_NOT_FOUND', 'Directory entry not found.');
    }

    const uploaded = await uploadOrganizationLogoToDrive({
        directoryKey,
        fileName: validated.fileName,
        mimeType: validated.mimeType,
        buffer: validated.buffer,
    });
    const imageUrl = toDirectoryLogoUrl(uploaded.fileId, uploaded.resourceKey);

    try {
        await prisma.$transaction(async (transaction) => {
            await transaction.directoryLogo.upsert({
                where: { directoryEntryId: existing.id },
                create: {
                    directoryEntryId: existing.id,
                    driveFileId: uploaded.fileId,
                    resourceKey: uploaded.resourceKey,
                    fileName: validated.fileName,
                    mimeType: validated.mimeType,
                    sizeBytes: validated.sizeBytes,
                    uploadedBy: input.actorEmail,
                },
                update: {
                    driveFileId: uploaded.fileId,
                    resourceKey: uploaded.resourceKey,
                    fileName: validated.fileName,
                    mimeType: validated.mimeType,
                    sizeBytes: validated.sizeBytes,
                    uploadedBy: input.actorEmail,
                },
            });
            await transaction.directoryEntry.update({
                where: { id: existing.id },
                data: { imageUrl },
            });
        });
    } catch (error) {
        await trashDriveFileById(uploaded.fileId, getOrganizationLogosFolderId());
        throw error;
    }

    if (existing.logo?.driveFileId && existing.logo.driveFileId !== uploaded.fileId) {
        await trashDriveFileById(existing.logo.driveFileId, getOrganizationLogosFolderId());
    }
    await markDirectoryExportPending(input.actorEmail);

    return {
        directoryKey,
        imageUrl,
        fileName: validated.fileName,
        mimeType: validated.mimeType,
        sizeBytes: validated.sizeBytes,
        sheetsSync: 'pending' as const,
    };
}

export async function removeDirectoryLogo(input: { directoryKey: string; actorEmail: string }) {
    const directoryKey = normalizeDirectoryKey(input.directoryKey);
    const prisma = await getPrisma();
    const existing = await prisma.directoryEntry.findUnique({
        where: { directoryKey },
        select: {
            id: true,
            enabled: true,
            logo: { select: { driveFileId: true } },
        },
    });

    if (!existing || !existing.enabled) {
        throw new ApiError(404, 'DIRECTORY_ENTRY_NOT_FOUND', 'Directory entry not found.');
    }

    await prisma.$transaction(async (transaction) => {
        await transaction.directoryLogo.deleteMany({ where: { directoryEntryId: existing.id } });
        await transaction.directoryEntry.update({ where: { id: existing.id }, data: { imageUrl: '' } });
    });

    if (existing.logo?.driveFileId) {
        await trashDriveFileById(existing.logo.driveFileId, getOrganizationLogosFolderId());
    }
    await markDirectoryExportPending(input.actorEmail);

    return { directoryKey, imageUrl: '', sheetsSync: 'pending' as const };
}
