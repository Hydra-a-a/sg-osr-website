import 'server-only';

import path from 'path';
import { randomUUID } from 'crypto';
import {
    LostFoundAttachmentKind,
    LostFoundCommentRole,
    LostFoundReportType,
    LostFoundSource,
    LostFoundStatus,
} from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/api-errors';
import { trashLostFoundAttachmentById, uploadLostFoundAttachmentToDrive } from '@/lib/google-drive';
import { redactErrorForLog } from '@/lib/security';
import { recordStagedDriveReference } from '@/lib/idempotency';

const MAX_ATTACHMENTS = 3;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = MAX_ATTACHMENTS * MAX_IMAGE_BYTES;
export const LOST_FOUND_VIDEO_UPLOADS_ENABLED = false;
const ALLOWED_IMAGES = new Map([
    ['.jpg', 'image/jpeg'],
    ['.jpeg', 'image/jpeg'],
    ['.png', 'image/png'],
    ['.webp', 'image/webp'],
]);
const IMAGE_SIGNATURES: Record<string, (buffer: Buffer) => boolean> = {
    'image/jpeg': (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
    'image/png': (buffer) => buffer.length >= 8 && Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).equals(buffer.subarray(0, 8)),
    'image/webp': (buffer) => buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP',
};

export type LostFoundInput = {
    reportType: LostFoundReportType;
    title: string;
    description: string;
    location: string;
    eventDate: Date | null;
    submitterEmail: string;
    submitterName: string;
    source: LostFoundSource;
    csoReference?: string;
    status?: LostFoundStatus;
    reviewedBy?: string;
    reviewNotes?: string;
};

function newPublicId(prefix: string): string {
    return `${prefix}-${randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase()}`;
}

function normalizeFileName(fileName: string): string {
    const parsed = path.parse(fileName || 'attachment');
    const safeBase = parsed.name
        .replace(/[^a-zA-Z0-9._-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 80);
    const extension = parsed.ext.toLowerCase();
    return `${safeBase || 'attachment'}${extension}`;
}

export type PreparedLostFoundAttachment = {
    attachmentId: string;
    fileName: string;
    mimeType: string;
    kind: LostFoundAttachmentKind;
    sizeBytes: number;
    buffer: Buffer;
};

export async function validateLostFoundAttachments(files: File[]): Promise<PreparedLostFoundAttachment[]> {
    const attachments = files.filter((file) => file instanceof File && file.size > 0);
    if (attachments.length > MAX_ATTACHMENTS) {
        throw new ApiError(400, 'TOO_MANY_ATTACHMENTS', 'You can attach up to three files.');
    }

    let totalBytes = 0;
    const prepared: PreparedLostFoundAttachment[] = [];
    for (const file of attachments) {
        const extension = path.extname(file.name || '').toLowerCase();
        const expectedImageMime = ALLOWED_IMAGES.get(extension);
        const expectedMime = expectedImageMime;

        if (!expectedMime || file.type !== expectedMime) {
            throw new ApiError(415, 'ATTACHMENT_TYPE_NOT_ALLOWED', 'Only JPG, PNG, and WebP image files are allowed.');
        }

        if (file.size > MAX_IMAGE_BYTES) {
            throw new ApiError(413, 'ATTACHMENT_TOO_LARGE', 'Image attachments must be 5MB or smaller.');
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        if (buffer.length !== file.size) {
            throw new ApiError(400, 'ATTACHMENT_SIZE_MISMATCH', 'The attachment could not be validated.');
        }

        const matchesSignature = IMAGE_SIGNATURES[expectedMime]?.(buffer) || false;
        if (!matchesSignature) {
            throw new ApiError(415, 'ATTACHMENT_SIGNATURE_INVALID', 'The attachment contents do not match its image type.');
        }

        totalBytes += buffer.length;
        if (totalBytes > MAX_TOTAL_BYTES) {
            throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'The combined image upload must be 15MB or smaller.');
        }

        prepared.push({
            attachmentId: newPublicId('LFA'),
            fileName: normalizeFileName(file.name),
            mimeType: expectedMime,
            kind: LostFoundAttachmentKind.IMAGE,
            sizeBytes: buffer.length,
            buffer,
        });
    }

    return prepared;
}

async function attachFiles(itemId: string, files: PreparedLostFoundAttachment[], submissionAttemptId?: string): Promise<void> {
    const uploadedFileIds: string[] = [];

    try {
        for (const file of files) {
            const uploaded = await uploadLostFoundAttachmentToDrive({
                itemId,
                attachmentId: file.attachmentId,
                fileName: file.fileName,
                mimeType: file.mimeType,
                buffer: file.buffer,
                submissionAttemptId,
            });
            uploadedFileIds.push(uploaded.fileId);

            if (submissionAttemptId) {
                await recordStagedDriveReference({
                    attemptId: submissionAttemptId,
                    fileId: uploaded.fileId,
                    resourceKey: uploaded.resourceKey,
                });
            }

            await prisma.lostFoundAttachment.create({
                data: {
                    attachmentId: file.attachmentId,
                    itemId,
                    driveFileId: uploaded.fileId,
                    resourceKey: uploaded.resourceKey,
                    fileName: file.fileName,
                    mimeType: file.mimeType,
                    kind: file.kind,
                    sizeBytes: file.sizeBytes,
                },
            });
        }
    } catch (error) {
        await Promise.all(uploadedFileIds.map((fileId) => trashLostFoundAttachmentById(fileId)));
        throw error;
    }
}

const publicItemSelect = {
    itemId: true,
    source: true,
    reportType: true,
    title: true,
    description: true,
    location: true,
    eventDate: true,
    reportedAt: true,
    status: true,
    attachments: {
        orderBy: { createdAt: 'asc' as const },
        select: {
            attachmentId: true,
            fileName: true,
            mimeType: true,
            kind: true,
        },
    },
};

function toPublicItem(item: {
    itemId: string;
    source: LostFoundSource;
    reportType: LostFoundReportType;
    title: string;
    description: string;
    location: string;
    eventDate: Date | null;
    reportedAt: Date;
    status: LostFoundStatus;
    attachments: Array<{ attachmentId: string; fileName: string; mimeType: string; kind: LostFoundAttachmentKind }>;
}) {
    return {
        itemId: item.itemId,
        source: item.source,
        reportType: item.reportType,
        title: item.title,
        description: item.description,
        location: item.location,
        eventDate: item.eventDate?.toISOString() || null,
        reportedAt: item.reportedAt.toISOString(),
        status: item.status,
        attachments: item.attachments.map((attachment) => ({
            attachmentId: attachment.attachmentId,
            fileName: attachment.fileName,
            mimeType: attachment.mimeType,
            kind: attachment.kind,
            url: `/api/hub/lost-found/media/${encodeURIComponent(attachment.attachmentId)}`,
        })),
    };
}

export async function listPublicLostFoundItems(filters: {
    source?: LostFoundSource;
    reportType?: LostFoundReportType;
    query?: string;
}) {
    const query = filters.query?.trim();
    const items = await prisma.lostFoundItem.findMany({
        where: {
            status: { in: [LostFoundStatus.PUBLISHED, LostFoundStatus.RESOLVED] },
            ...(filters.source ? { source: filters.source } : {}),
            ...(filters.reportType ? { reportType: filters.reportType } : {}),
            ...(query ? {
                OR: [
                    { title: { contains: query, mode: 'insensitive' } },
                    { description: { contains: query, mode: 'insensitive' } },
                    { location: { contains: query, mode: 'insensitive' } },
                ],
            } : {}),
        },
        orderBy: [{ reportedAt: 'desc' }],
        take: 100,
        select: publicItemSelect,
    });

    return items.map(toPublicItem);
}

export async function getPublicLostFoundItem(itemId: string) {
    const item = await prisma.lostFoundItem.findFirst({
        where: {
            itemId,
            status: { in: [LostFoundStatus.PUBLISHED, LostFoundStatus.RESOLVED] },
        },
        select: publicItemSelect,
    });

    return item ? toPublicItem(item) : null;
}

export async function createLostFoundItem(input: LostFoundInput, files: PreparedLostFoundAttachment[], submissionAttemptId?: string) {
    if (input.source === LostFoundSource.CSO && input.csoReference?.trim()) {
        const existing = await prisma.lostFoundItem.findFirst({
            where: { source: LostFoundSource.CSO, csoReference: input.csoReference.trim() },
            select: { itemId: true },
        });
        if (existing) {
            throw new ApiError(409, 'DUPLICATE_CSO_REFERENCE', 'A CSO bulletin with this reference already exists.');
        }
    }

    const itemId = newPublicId('LNF');
    let itemCreated = false;
    try {
        const item = await prisma.lostFoundItem.create({
            data: {
                itemId,
                source: input.source,
                reportType: input.reportType,
                title: input.title,
                description: input.description,
                location: input.location,
                eventDate: input.eventDate,
                submitterEmail: input.submitterEmail,
                submitterName: input.submitterName,
                csoReference: input.csoReference || '',
                status: input.status || LostFoundStatus.PENDING_REVIEW,
                reviewedBy: input.reviewedBy || '',
                reviewedAt: input.reviewedBy ? new Date() : null,
                reviewNotes: input.reviewNotes || '',
            },
        });
        itemCreated = true;

        if (files.length > 0) {
            await attachFiles(item.itemId, files, submissionAttemptId);
        }

        return item.itemId;
    } catch (error) {
        if (itemCreated) {
            await prisma.lostFoundItem.delete({ where: { itemId } }).catch((cleanupError) => {
                console.error('[Lost Found] Failed to compensate item creation:', redactErrorForLog(cleanupError));
            });
        }
        throw error;
    }
}

export async function listLostFoundItemsForAdmin() {
    const items = await prisma.lostFoundItem.findMany({
        orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
        take: 250,
        include: {
            attachments: {
                orderBy: { createdAt: 'asc' },
                select: { attachmentId: true, fileName: true, mimeType: true, kind: true },
            },
            _count: { select: { comments: true } },
        },
    });

    return items.map((item) => ({
        itemId: item.itemId,
        source: item.source,
        reportType: item.reportType,
        title: item.title,
        description: item.description,
        location: item.location,
        eventDate: item.eventDate?.toISOString() || null,
        reportedAt: item.reportedAt.toISOString(),
        submitterEmail: item.submitterEmail,
        submitterName: item.submitterName,
        csoReference: item.csoReference,
        status: item.status,
        reviewedBy: item.reviewedBy,
        reviewedAt: item.reviewedAt?.toISOString() || null,
        reviewNotes: item.reviewNotes,
        resolvedAt: item.resolvedAt?.toISOString() || null,
        commentCount: item._count.comments,
        attachments: item.attachments.map((attachment) => ({
            attachmentId: attachment.attachmentId,
            fileName: attachment.fileName,
            mimeType: attachment.mimeType,
            kind: attachment.kind,
            url: `/api/admin/lost-found/media/${encodeURIComponent(attachment.attachmentId)}`,
        })),
    }));
}

export async function updateLostFoundItem(params: {
    itemId: string;
    status: LostFoundStatus;
    reviewNotes: string;
    actorEmail: string;
}) {
    const item = await prisma.lostFoundItem.update({
        where: { itemId: params.itemId },
        data: {
            status: params.status,
            reviewNotes: params.reviewNotes,
            reviewedBy: params.actorEmail,
            reviewedAt: new Date(),
            resolvedAt: params.status === LostFoundStatus.RESOLVED ? new Date() : null,
        },
        select: { itemId: true, status: true },
    });

    return item;
}

export async function listPublicLostFoundComments(itemId: string) {
    const item = await getPublicLostFoundItem(itemId);
    if (!item) return null;

    const comments = await prisma.lostFoundComment.findMany({
        where: { itemId, isHidden: false },
        orderBy: { timestamp: 'asc' },
        select: { commentId: true, timestamp: true, authorRole: true, message: true },
    });

    return comments.map((comment) => ({
        commentId: comment.commentId,
        timestamp: comment.timestamp.toISOString(),
        authorLabel: comment.authorRole === LostFoundCommentRole.OFFICER ? 'OSR Officer' : 'RTU Student',
        message: comment.message,
    }));
}

export async function createLostFoundComment(params: {
    itemId: string;
    authorEmail: string;
    authorRole: LostFoundCommentRole;
    message: string;
}) {
    const item = await getPublicLostFoundItem(params.itemId);
    if (!item) return null;

    const comment = await prisma.lostFoundComment.create({
        data: {
            commentId: newPublicId('LFC'),
            itemId: params.itemId,
            authorEmail: params.authorEmail,
            authorRole: params.authorRole,
            message: params.message,
        },
        select: { commentId: true, timestamp: true, authorRole: true, message: true },
    });

    return {
        commentId: comment.commentId,
        timestamp: comment.timestamp.toISOString(),
        authorLabel: comment.authorRole === LostFoundCommentRole.OFFICER ? 'OSR Officer' : 'RTU Student',
        message: comment.message,
    };
}

export async function listLostFoundCommentsForAdmin(itemId: string) {
    const comments = await prisma.lostFoundComment.findMany({
        where: { itemId },
        orderBy: { timestamp: 'asc' },
        select: {
            commentId: true,
            timestamp: true,
            authorEmail: true,
            authorRole: true,
            message: true,
            isHidden: true,
            moderatedBy: true,
            moderatedAt: true,
        },
    });

    return comments.map((comment) => ({
        commentId: comment.commentId,
        timestamp: comment.timestamp.toISOString(),
        authorEmail: comment.authorEmail,
        authorRole: comment.authorRole,
        message: comment.message,
        isHidden: comment.isHidden,
        moderatedBy: comment.moderatedBy,
        moderatedAt: comment.moderatedAt?.toISOString() || null,
    }));
}

export async function moderateLostFoundComment(params: {
    commentId: string;
    isHidden: boolean;
    actorEmail: string;
}) {
    return prisma.lostFoundComment.update({
        where: { commentId: params.commentId },
        data: {
            isHidden: params.isHidden,
            moderatedBy: params.actorEmail,
            moderatedAt: new Date(),
        },
        select: { commentId: true, isHidden: true },
    });
}

export async function getLostFoundAttachment(attachmentId: string) {
    return prisma.lostFoundAttachment.findFirst({
        where: {
            attachmentId,
            item: { status: { in: [LostFoundStatus.PUBLISHED, LostFoundStatus.RESOLVED] } },
        },
        select: {
            attachmentId: true,
            driveFileId: true,
            resourceKey: true,
            fileName: true,
            mimeType: true,
            kind: true,
            sizeBytes: true,
        },
    });
}

export async function getLostFoundAttachmentForAdmin(attachmentId: string) {
    return prisma.lostFoundAttachment.findFirst({
        where: { attachmentId },
        select: {
            attachmentId: true,
            driveFileId: true,
            resourceKey: true,
            fileName: true,
            mimeType: true,
            kind: true,
            sizeBytes: true,
        },
    });
}

export function isRtuEmail(email: string): boolean {
    return email.trim().toLowerCase().endsWith('@rtu.edu.ph');
}

export const lostFoundLimits = {
    maxAttachments: MAX_ATTACHMENTS,
    maxImageBytes: MAX_IMAGE_BYTES,
    maxTotalBytes: MAX_TOTAL_BYTES,
    videoUploadsEnabled: LOST_FOUND_VIDEO_UPLOADS_ENABLED,
};
