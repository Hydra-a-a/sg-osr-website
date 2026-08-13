import { Readable } from 'stream';
import path from 'path';
import { google } from 'googleapis';
import { getGoogleServiceAccountCredentials } from '@/lib/google-credentials';
import { redactErrorForLog } from '@/lib/security';

function getDriveClient() {
    const auth = new google.auth.GoogleAuth({
        credentials: getGoogleServiceAccountCredentials(),
        // Service-account uploads need broader Drive scope to resolve folder metadata
        // and write into explicitly shared locations.
        scopes: ['https://www.googleapis.com/auth/drive'],
    });

    return google.drive({ version: 'v3', auth });
}

export async function getDrivePdfStreamById(fileId: string, resourceKey?: string): Promise<{
    stream: Readable;
    fileName?: string | null;
} | null> {
    const normalizedFileId = (fileId || '').trim();
    if (!normalizedFileId) {
        return null;
    }

    const drive = getDriveClient();

    try {
        const metadataResponse = await drive.files.get({
            fileId: normalizedFileId,
            fields: 'id,name,mimeType',
            supportsAllDrives: true,
            resourceKey,
        } as any);

        if (!metadataResponse.data || metadataResponse.data.mimeType !== 'application/pdf') {
            return null;
        }

        const mediaResponse = await drive.files.get(
            {
                fileId: normalizedFileId,
                alt: 'media',
                supportsAllDrives: true,
                resourceKey,
            } as any,
            {
                responseType: 'stream',
            }
        );

        if (!mediaResponse.data) {
            return null;
        }

        return {
            stream: mediaResponse.data as Readable,
            fileName: metadataResponse.data.name || null,
        };
    } catch (error) {
        console.error('[Drive Preview] Failed to stream PDF:', redactErrorForLog(error));
        return null;
    }
}

export async function getDriveImageStreamById(fileId: string, resourceKey?: string): Promise<{
    stream: Readable;
    fileName?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
    parents?: string[];
} | null> {
    const normalizedFileId = (fileId || '').trim();
    if (!normalizedFileId) {
        return null;
    }

    const drive = getDriveClient();

    try {
        const metadataResponse = await drive.files.get({
            fileId: normalizedFileId,
            fields: 'id,name,mimeType,size,parents',
            supportsAllDrives: true,
            resourceKey,
        } as any);

        const mimeType = metadataResponse.data?.mimeType || '';
        if (!metadataResponse.data || !mimeType.startsWith('image/')) {
            return null;
        }

        const mediaResponse = await drive.files.get(
            {
                fileId: normalizedFileId,
                alt: 'media',
                supportsAllDrives: true,
                resourceKey,
            } as any,
            {
                responseType: 'stream',
            }
        );

        if (!mediaResponse.data) {
            return null;
        }

        return {
            stream: mediaResponse.data as Readable,
            fileName: metadataResponse.data.name || null,
            mimeType,
            sizeBytes: metadataResponse.data.size ? Number(metadataResponse.data.size) : null,
            parents: metadataResponse.data.parents || [],
        };
    } catch (error) {
        console.error('[Drive Image] Failed to stream image:', redactErrorForLog(error));
        return null;
    }
}

export function extractGoogleDriveFileId(url: string): string | null {
    if (!url) {
        return null;
    }

    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();
        const isGoogleDriveHost = hostname === 'drive.google.com' || hostname === 'www.drive.google.com';
        const isGoogleDocsHost = hostname === 'docs.google.com' || hostname === 'www.docs.google.com';

        if (!isGoogleDriveHost && !isGoogleDocsHost) {
            return null;
        }

        const filePathMatch = parsed.pathname.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
        if (filePathMatch?.[1]) {
            return filePathMatch[1];
        }

        const idParam = parsed.searchParams.get('id');
        if (idParam && /^[a-zA-Z0-9_-]{10,}$/.test(idParam)) {
            return idParam;
        }

        return null;
    } catch {
        return null;
    }
}

export function extractGoogleDriveResourceKey(url: string): string | undefined {
    if (!url) {
        return undefined;
    }

    try {
        const parsed = new URL(url);
        const key = (parsed.searchParams.get('resourcekey') || parsed.searchParams.get('resourceKey') || '').trim();
        if (!key) {
            return undefined;
        }

        return /^[a-zA-Z0-9_-]{4,200}$/.test(key) ? key : undefined;
    } catch {
        return undefined;
    }
}

export function getOrganizationLogosFolderId(): string {
    const folderId = (process.env.GOOGLE_DRIVE_ORGANIZATION_LOGOS_FOLDER_ID || '').trim();
    return folderId;
}

export async function getDriveMediaStreamById(fileId: string, resourceKey?: string): Promise<{
    stream: Readable;
    fileName?: string | null;
    mimeType?: string | null;
    parents?: string[];
    sizeBytes?: number | null;
} | null> {
    const normalizedFileId = (fileId || '').trim();
    if (!normalizedFileId) {
        return null;
    }

    const drive = getDriveClient();

    try {
        const metadataResponse = await drive.files.get({
            fileId: normalizedFileId,
            fields: 'id,name,mimeType,size,parents',
            supportsAllDrives: true,
            resourceKey,
        } as any);

        const mimeType = metadataResponse.data?.mimeType || '';
        const isAllowedMedia = mimeType.startsWith('image/') || mimeType === 'video/mp4' || mimeType === 'video/webm';
        if (!metadataResponse.data || !isAllowedMedia) {
            return null;
        }

        const mediaResponse = await drive.files.get(
            {
                fileId: normalizedFileId,
                alt: 'media',
                supportsAllDrives: true,
                resourceKey,
            } as any,
            { responseType: 'stream' },
        );

        if (!mediaResponse.data) {
            return null;
        }

        return {
            stream: mediaResponse.data as Readable,
            fileName: metadataResponse.data.name || null,
            mimeType,
            parents: metadataResponse.data.parents || [],
            sizeBytes: Number.isFinite(Number(metadataResponse.data.size)) ? Number(metadataResponse.data.size) : null,
        };
    } catch (error) {
        console.error('[Drive Media] Failed to stream media:', redactErrorForLog(error));
        return null;
    }
}

export async function getDriveFileMetadataById(fileId: string, resourceKey?: string): Promise<{
    id?: string | null;
    name?: string | null;
    mimeType?: string | null;
    webViewLink?: string | null;
    webContentLink?: string | null;
} | null> {
    const normalizedFileId = (fileId || '').trim();
    if (!normalizedFileId) {
        return null;
    }

    const drive = getDriveClient();

    try {
        const response = await drive.files.get({
            fileId: normalizedFileId,
            fields: 'id,name,mimeType,webViewLink,webContentLink',
            supportsAllDrives: true,
            resourceKey,
        } as any);

        return response.data || null;
    } catch (error) {
        console.error('[Drive Metadata] Failed to resolve file metadata:', redactErrorForLog(error));
        return null;
    }
}

function getAttachmentsFolderId(): string {
    const folderId = (process.env.GOOGLE_DRIVE_GRIEVANCE_FOLDER_ID || '').trim();
    if (!folderId) {
        throw new Error('GOOGLE_DRIVE_GRIEVANCE_FOLDER_ID is not configured in the environment.');
    }
    return folderId;
}

function sanitizeFileBaseName(name: string): string {
    const parsed = path.parse(name || 'attachment');
    const safeBase = parsed.name
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 80);

    const ext = parsed.ext ? parsed.ext.replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10) : '';
    return `${safeBase || 'attachment'}${ext}`;
}

export async function uploadTicketAttachmentToDrive(params: {
    ticketId: string;
    fileName: string;
    mimeType: string;
    buffer: Buffer;
}): Promise<string> {
    const drive = getDriveClient();
    const folderId = getAttachmentsFolderId();
    const safeOriginalName = sanitizeFileBaseName(params.fileName);
    const normalizedTicketId = params.ticketId.trim().toUpperCase();
    const driveFileName = `${normalizedTicketId}_${safeOriginalName}`;

    try {
        const response = await drive.files.create({
            requestBody: {
                name: driveFileName,
                parents: [folderId],
            },
            media: {
                mimeType: params.mimeType,
                body: Readable.from(params.buffer),
            },
            fields: 'id,webViewLink',
            supportsAllDrives: true,
        });

        const fileId = response.data.id;
        if (!fileId) {
            throw new Error('Google Drive did not return a file ID for uploaded attachment.');
        }

        return response.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
    } catch (error) {
        console.error('[Drive Upload] Failed to upload attachment:', redactErrorForLog(error));
        throw new Error('Failed to upload ticket attachment to Google Drive.');
    }
}

function getProposalsFolderId(): string {
    const id = process.env.GOOGLE_DRIVE_PROPOSALS_FOLDER_ID;
    if (!id) {
        throw new Error('GOOGLE_DRIVE_PROPOSALS_FOLDER_ID is not configured in the environment.');
    }
    return id;
}

export function getLostFoundFolderId(): string {
    const id = (process.env.GOOGLE_DRIVE_LOST_FOUND_FOLDER_ID || '').trim();
    if (!id) {
        throw new Error('GOOGLE_DRIVE_LOST_FOUND_FOLDER_ID is not configured in the environment.');
    }
    return id;
}

export async function uploadLostFoundAttachmentToDrive(params: {
  itemId: string;
  attachmentId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  submissionAttemptId?: string;
}): Promise<{ fileId: string; resourceKey: string }> {
    const drive = getDriveClient();
    const folderId = getLostFoundFolderId();
    const driveFileName = `[LOST_FOUND] ${params.itemId} - ${params.attachmentId}`;

    try {
        const response = await drive.files.create({
            requestBody: {
                name: driveFileName,
                parents: [folderId],
                ...(params.submissionAttemptId ? { appProperties: { submissionAttemptId: params.submissionAttemptId } } : {}),
            },
            media: {
                mimeType: params.mimeType,
                body: Readable.from(params.buffer),
            },
            fields: 'id,resourceKey,mimeType,size,parents',
            supportsAllDrives: true,
        });

        const fileId = response.data.id;
        if (!fileId) {
            throw new Error('Google Drive did not return a file ID for lost-and-found attachment.');
        }

        const remoteSize = Number(response.data.size);
        const metadataMatches = response.data.mimeType === params.mimeType
            && Number.isFinite(remoteSize)
            && remoteSize === params.buffer.length
            && (response.data.parents || []).includes(folderId);
        if (!metadataMatches) {
            await trashDriveFileById(fileId, folderId, 'lost-and-found folder');
            throw new Error('Google Drive returned unexpected metadata for lost-and-found attachment.');
        }

        return {
            fileId,
            resourceKey: response.data.resourceKey || '',
        };
    } catch (error) {
        console.error('[Drive Upload] Failed to upload lost-and-found attachment:', redactErrorForLog(error));
        throw new Error('Failed to upload lost-and-found attachment to Google Drive.');
    }
}

export async function trashLostFoundAttachmentById(fileId: string): Promise<void> {
    await trashDriveFileById(fileId, getLostFoundFolderId(), 'lost-and-found folder');
}

export async function uploadOrganizationLogoToDrive(params: {
    directoryKey: string;
    fileName: string;
    mimeType: string;
    buffer: Buffer;
}): Promise<{ fileId: string; resourceKey: string; fileName: string }> {
    const drive = getDriveClient();
    const folderId = getOrganizationLogosFolderId().trim();
    if (!folderId) {
        throw new Error('GOOGLE_DRIVE_ORGANIZATION_LOGOS_FOLDER_ID is not configured in the environment.');
    }

    const safeName = sanitizeFileBaseName(params.fileName);
    const driveFileName = `[DIRECTORY] ${params.directoryKey} - ${safeName}`;

    try {
        const response = await drive.files.create({
            requestBody: {
                name: driveFileName,
                parents: [folderId],
            },
            media: {
                mimeType: params.mimeType,
                body: Readable.from(params.buffer),
            },
            fields: 'id,name,resourceKey',
            supportsAllDrives: true,
        });

        const fileId = response.data.id;
        if (!fileId) {
            throw new Error('Google Drive did not return a file ID for the organization logo.');
        }

        return {
            fileId,
            resourceKey: response.data.resourceKey || '',
            fileName: response.data.name || driveFileName,
        };
    } catch (error) {
        console.error('[Drive Upload] Failed to upload organization logo:', redactErrorForLog(error));
        throw new Error('Failed to upload organization logo to Google Drive.');
    }
}

export async function trashDriveFileById(fileId: string, expectedParentId?: string, folderLabel = 'expected folder'): Promise<void> {
    const normalizedFileId = (fileId || '').trim();
    if (!normalizedFileId) return;

    try {
        const drive = getDriveClient();
        if (expectedParentId) {
            const metadata = await drive.files.get({
                fileId: normalizedFileId,
                fields: 'id,parents',
                supportsAllDrives: true,
            });
            if (!(metadata.data.parents || []).includes(expectedParentId)) {
                console.warn(`[Drive Cleanup] Skipped file outside the ${folderLabel}.`);
                return;
            }
        }
        await drive.files.update({
            fileId: normalizedFileId,
            requestBody: { trashed: true },
            supportsAllDrives: true,
            fields: 'id,trashed',
        } as any);
    } catch (error) {
        console.warn(`[Drive Cleanup] Failed to trash file in the ${folderLabel}:`, redactErrorForLog(error));
    }
}

export async function uploadProposalAttachmentToDrive(params: {
    title: string;
    submitterEmail: string;
    fileName: string;
    mimeType: string;
    buffer: Buffer;
}): Promise<string> {
    const drive = getDriveClient();
    const folderId = getProposalsFolderId();
    const safeTitle = params.title.replace(/[^a-zA-Z0-9_\- ]/g, '').trim().slice(0, 30);
    const safeSubmitter = params.submitterEmail.split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '');
    const driveFileName = `[PROPOSAL] ${safeTitle} - ${safeSubmitter} - ${params.fileName}`;

    try {
        const response = await drive.files.create({
            requestBody: {
                name: driveFileName,
                parents: [folderId],
            },
            media: {
                mimeType: params.mimeType,
                body: Readable.from(params.buffer),
            },
            fields: 'id,webViewLink',
            supportsAllDrives: true,
        });

        const fileId = response.data.id;
        if (!fileId) {
            throw new Error('Google Drive did not return a file ID for uploaded proposal attachment.');
        }

        return response.data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
    } catch (error) {
        console.error('[Drive Upload] Failed to upload proposal attachment:', redactErrorForLog(error));
        throw new Error('Failed to upload proposal attachment to Google Drive.');
    }
}
