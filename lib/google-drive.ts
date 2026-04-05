import { Readable } from 'stream';
import path from 'path';
import { google } from 'googleapis';
import { getGoogleServiceAccountCredentials } from '@/lib/google-credentials';
import { redactErrorForLog } from '@/lib/security';

const DEFAULT_GRIEVANCE_ATTACHMENTS_FOLDER_ID = '1MUiWHPcAgCHtU8sfIBDp-lGX43wluJTi';

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

export async function getDriveFileMetadataById(fileId: string): Promise<{
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
        });

        return response.data || null;
    } catch (error) {
        console.error('[Drive Metadata] Failed to resolve file metadata:', redactErrorForLog(error));
        return null;
    }
}

function getAttachmentsFolderId(): string {
    return process.env.GOOGLE_DRIVE_GRIEVANCE_FOLDER_ID || DEFAULT_GRIEVANCE_ATTACHMENTS_FOLDER_ID;
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
