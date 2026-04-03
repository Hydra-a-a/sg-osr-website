import { Readable } from 'stream';
import path from 'path';
import { google } from 'googleapis';
import { getGoogleServiceAccountCredentials } from '@/lib/google-credentials';
import { redactErrorForLog } from '@/lib/security';

const DEFAULT_GRIEVANCE_ATTACHMENTS_FOLDER_ID = '1doPHXkNvG8pzi0nuxCYI-TgFaQcfUePX';

function getDriveClient() {
    const auth = new google.auth.GoogleAuth({
        credentials: getGoogleServiceAccountCredentials(),
        // Service-account uploads need broader Drive scope to resolve folder metadata
        // and write into explicitly shared locations.
        scopes: ['https://www.googleapis.com/auth/drive'],
    });

    return google.drive({ version: 'v3', auth });
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
