import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { isSafeNavigationHref, isTrustedUrl } from '@/lib/security';
import { ApiError } from '@/lib/api-errors';
import { getHubGuidesFolderId, getOrganizationLogosFolderId, trashDriveFileById, uploadHubGuidePdfToDrive } from '@/lib/google-drive';
import { buildDirectoryKey } from '@/lib/directory-repository';

export const ADMIN_CONTENT_TYPES = ['directory', 'news', 'hub-guide', 'quick-link'] as const;
export type AdminContentType = typeof ADMIN_CONTENT_TYPES[number];
export const HUB_GUIDE_PDF_MAX_BYTES = 20 * 1024 * 1024;

const optionalUrl = z.string().trim().max(2048).refine(isTrustedUrl, 'URL must use a trusted public host').or(z.literal(''));
const safeHref = z.string().trim().max(2048).refine(isSafeNavigationHref, 'Link must be a safe relative path or HTTPS URL');

export const adminContentPayloadSchemas: Record<AdminContentType, z.ZodTypeAny> = {
    directory: z.object({
        directoryKey: z.string().trim().min(1).max(160),
        entryType: z.string().trim().min(1).max(80),
        name: z.string().trim().min(1).max(240),
        roleOrOffice: z.string().trim().max(240),
        councilOrUnit: z.string().trim().max(240),
        email: z.string().trim().max(320),
        imageUrl: optionalUrl,
        profileUrl: safeHref.or(z.literal('')),
        publicDataJson: z.record(z.string(), z.unknown()),
        enabled: z.boolean(),
        sortOrder: z.number().int().min(0).max(100000),
    }).strict(),
    news: z.object({
        sourcePageId: z.string().trim().max(120),
        sourcePageName: z.string().trim().max(160),
        sourcePageSlug: z.string().trim().max(160),
        message: z.string().max(10000),
        imageUrl: optionalUrl,
        publishedAt: z.string().datetime({ offset: true }),
        fbLink: z.string().trim().max(2048).refine((value) => !value || /https:\/\/(?:www\.)?(?:facebook\.com|fb\.watch)\//i.test(value), 'Only official Facebook links are allowed').or(z.literal('')),
        targetPagesJson: z.array(z.string().trim().startsWith('/').max(240)).max(30),
        enabled: z.boolean(),
        featured: z.boolean(),
        manualTitle: z.string().max(220),
        manualBody: z.string().max(20000),
        articleTitle: z.string().max(220),
        articleBody: z.string().max(20000),
        imageAlt: z.string().max(300),
        section: z.string().trim().max(80),
        sortOrder: z.number().int().min(0).max(100000).nullable(),
    }).strict(),
    'hub-guide': z.object({
        title: z.string().trim().min(1).max(240),
        description: z.string().max(4000),
        fileUrl: z.string().trim().url().refine((value) => value.startsWith('https://'), 'Guide links must use HTTPS').refine((value) => /(?:\.pdf(?:$|[?#])|drive\.google\.com|docs\.google\.com)/i.test(value), 'Guide must reference a PDF or Google Drive document'),
        driveFileId: z.string().trim().max(200),
        resourceKey: z.string().trim().max(200),
        category: z.string().trim().max(120),
        publicDataJson: z.record(z.string(), z.unknown()),
        enabled: z.boolean(),
        sortOrder: z.number().int().min(0).max(100000),
    }).strict(),
    'quick-link': z.object({
        label: z.string().trim().min(1).max(160),
        href: safeHref,
        category: z.string().trim().max(120),
        description: z.string().trim().max(1000),
        icon: z.string().trim().max(80),
        enabled: z.boolean(),
        sortOrder: z.number().int().min(0).max(100000),
    }).strict(),
};

export type AdminContentDraft = {
    id: string;
    contentType: AdminContentType;
    entityId: string;
    baseVersion: number;
    payload: Record<string, unknown>;
    stagedAssets: Record<string, unknown> | null;
    editorId: string;
    editorLabel: string;
    createdAt: string;
    updatedAt: string;
};

export type AdminContentRevision = {
    id: string;
    contentType: AdminContentType;
    entityId: string;
    version: number;
    payload: Record<string, unknown>;
    publisherId: string;
    publisherLabel: string;
    publishedAt: string;
};

export function parseAdminContentType(value: string): AdminContentType {
    if ((ADMIN_CONTENT_TYPES as readonly string[]).includes(value)) return value as AdminContentType;
    throw new ApiError(404, 'CONTENT_TYPE_NOT_FOUND', 'Content module not found.');
}

function toJsonObject(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function hubGuideTitleFromFileName(fileName: string): string {
    return String(fileName || 'Guide')
        .replace(/\.pdf$/i, '')
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || 'Guide';
}

export async function validateHubGuidePdfFile(file: File): Promise<{ buffer: Buffer; fileName: string; sizeBytes: number }> {
    if (typeof File === 'undefined' || !(file instanceof File) || file.size <= 0) {
        throw new ApiError(400, 'INVALID_HUB_GUIDE_FILE', 'Choose a PDF to upload.');
    }
    if (file.size > HUB_GUIDE_PDF_MAX_BYTES) {
        throw new ApiError(413, 'HUB_GUIDE_FILE_TOO_LARGE', 'PDF files must be 20 MB or smaller.');
    }
    if (String(file.type || '').toLowerCase() !== 'application/pdf') {
        throw new ApiError(415, 'UNSUPPORTED_HUB_GUIDE_TYPE', 'Only PDF files are accepted.');
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
        throw new ApiError(415, 'INVALID_HUB_GUIDE_PDF', 'The selected file is not a valid PDF.');
    }
    return { buffer, fileName: String(file.name || 'guide.pdf'), sizeBytes: buffer.byteLength };
}

function uploadedHubGuidePayload(input: unknown, uploaded: { fileId: string; resourceKey: string }, fileName: string): Record<string, unknown> {
    const payload = toJsonObject(input);
    return {
        title: String(payload.title || '').trim() || hubGuideTitleFromFileName(fileName),
        description: String(payload.description || ''),
        fileUrl: `https://drive.google.com/file/d/${uploaded.fileId}/view`,
        driveFileId: uploaded.fileId,
        resourceKey: uploaded.resourceKey,
        category: String(payload.category || ''),
        publicDataJson: { canEmbed: true },
        enabled: payload.enabled === undefined ? true : payload.enabled,
        sortOrder: payload.sortOrder === undefined ? 0 : payload.sortOrder,
    };
}

async function trashManagedHubGuidePdf(fileId: string): Promise<void> {
    const folderId = (process.env.GOOGLE_DRIVE_HUB_GUIDES_FOLDER_ID || '').trim();
    if (folderId) await trashDriveFileById(fileId, folderId, 'Hub Guides folder');
}

function entityPayload(type: AdminContentType, row: any): Record<string, unknown> {
    if (type === 'directory') return {
        directoryKey: row.directoryKey,
        entryType: row.entryType,
        name: row.name,
        roleOrOffice: row.roleOrOffice,
        councilOrUnit: row.councilOrUnit,
        email: row.email,
        imageUrl: row.imageUrl || '',
        profileUrl: row.profileUrl || '',
        publicDataJson: toJsonObject(row.publicDataJson),
        enabled: row.enabled,
        sortOrder: row.sortOrder,
    };
    if (type === 'news') return {
        sourcePageId: row.sourcePageId,
        sourcePageName: row.sourcePageName,
        sourcePageSlug: row.sourcePageSlug,
        message: row.message,
        imageUrl: row.imageUrl || '',
        publishedAt: new Date(row.publishedAt).toISOString(),
        fbLink: row.fbLink || '',
        targetPagesJson: Array.isArray(row.targetPagesJson) ? row.targetPagesJson : [],
        enabled: row.enabled,
        featured: row.featured,
        manualTitle: row.manualTitle || '',
        manualBody: row.manualBody || '',
        articleTitle: row.articleTitle || '',
        articleBody: row.articleBody || '',
        imageAlt: row.imageAlt || '',
        section: row.section || '',
        sortOrder: row.sortOrder ?? null,
    };
    if (type === 'hub-guide') return {
        title: row.title,
        description: row.description || '',
        fileUrl: row.fileUrl,
        driveFileId: row.driveFileId || '',
        resourceKey: row.resourceKey || '',
        category: row.category || '',
        publicDataJson: toJsonObject(row.publicDataJson),
        enabled: row.enabled,
        sortOrder: row.sortOrder,
    };
    return {
        label: row.label,
        href: row.href,
        category: row.category || '',
        description: row.description || '',
        icon: row.icon || 'ExternalLink',
        enabled: row.enabled,
        sortOrder: row.sortOrder,
    };
}

function toDraft(row: any): AdminContentDraft {
    return {
        id: row.id,
        contentType: row.contentType,
        entityId: row.entityId,
        baseVersion: row.baseVersion,
        payload: toJsonObject(row.payloadJson),
        stagedAssets: row.stagedAssets ? toJsonObject(row.stagedAssets) : null,
        editorId: row.editorId,
        editorLabel: row.editorLabel,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
    };
}

function toRevision(row: any): AdminContentRevision {
    return {
        id: row.id,
        contentType: row.contentType,
        entityId: row.entityId,
        version: row.version,
        payload: toJsonObject(row.payloadJson),
        publisherId: row.publisherId,
        publisherLabel: row.publisherLabel,
        publishedAt: row.publishedAt.toISOString(),
    };
}

function toRecordFromDraft(draft: any) {
    return {
        id: draft.entityId,
        version: 0,
        updatedAt: draft.updatedAt.toISOString(),
        payload: toJsonObject(draft.payloadJson),
        draft: toDraft(draft),
    };
}

function payloadForCreate(type: AdminContentType, input: unknown): Record<string, unknown> {
    const payload = toJsonObject(input);
    if (type !== 'directory') return payload;

    const entryType = String(payload.entryType || '').trim().toLowerCase() === 'office' ? 'office' : 'organization';
    return {
        ...payload,
        entryType,
        directoryKey: buildDirectoryKey({
            entryType,
            sourceLabel: 'website-control',
            name: String(payload.name || ''),
            email: String(payload.email || ''),
            category: String(payload.councilOrUnit || ''),
        }),
    };
}

async function getPrisma() {
    const { prisma } = await import('@/lib/prisma');
    return prisma as any;
}

async function findModelRow(prisma: any, type: AdminContentType, id: string) {
    const delegate = type === 'directory' ? prisma.directoryEntry : type === 'news' ? prisma.newsPost : type === 'hub-guide' ? prisma.hubGuide : prisma.quickLink;
    const row = await delegate.findUnique({ where: { id }, ...(type === 'directory' ? { include: { logo: true } } : {}) });
    if (!row) throw new ApiError(404, 'CONTENT_NOT_FOUND', 'Content record not found.');
    return row;
}

export async function listAdminContent(type: AdminContentType) {
    const prisma = await getPrisma();
    const delegate = type === 'directory' ? prisma.directoryEntry : type === 'news' ? prisma.newsPost : type === 'hub-guide' ? prisma.hubGuide : prisma.quickLink;
    const rows = await delegate.findMany({ orderBy: [{ sortOrder: 'asc' }, { updatedAt: 'desc' }] });
    const drafts = await prisma.adminContentDraft.findMany({ where: { contentType: type } });
    const draftByEntity = new Map(drafts.map((draft: any) => [draft.entityId, toDraft(draft)]));
    const records = rows.map((row: any) => ({
        id: row.id,
        version: row.version || 1,
        updatedAt: row.updatedAt.toISOString(),
        payload: entityPayload(type, row),
        draft: draftByEntity.get(row.id) || null,
    }));
    const newRecords = drafts.filter((draft: any) => draft.baseVersion === 0).map(toRecordFromDraft);
    return [...records, ...newRecords].sort((left: any, right: any) => {
        const leftOrder = Number(left.draft?.payload?.sortOrder ?? left.payload?.sortOrder ?? 0);
        const rightOrder = Number(right.draft?.payload?.sortOrder ?? right.payload?.sortOrder ?? 0);
        return leftOrder - rightOrder || String(right.updatedAt).localeCompare(String(left.updatedAt));
    });
}

export async function getAdminContent(type: AdminContentType, id: string) {
    const prisma = await getPrisma();
    const draft = await prisma.adminContentDraft.findUnique({ where: { contentType_entityId: { contentType: type, entityId: id } } });
    if (draft?.baseVersion === 0) return toRecordFromDraft(draft);
    const row = await findModelRow(prisma, type, id);
    return { id: row.id, version: row.version || 1, payload: entityPayload(type, row), draft: draft ? toDraft(draft) : null };
}

export async function saveAdminContentDraft(type: AdminContentType, id: string, input: unknown, editor: { id: string; label: string }) {
    const payloadResult = adminContentPayloadSchemas[type].safeParse(input);
    if (!payloadResult.success) throw new ApiError(422, 'CONTENT_VALIDATION_FAILED', 'Invalid content fields.', payloadResult.error.flatten());
    const prisma = await getPrisma();
    const pendingCreation = await prisma.adminContentDraft.findUnique({ where: { contentType_entityId: { contentType: type, entityId: id } } });
    if (pendingCreation?.baseVersion === 0) {
        const draft = await prisma.adminContentDraft.update({
            where: { id: pendingCreation.id },
            data: { payloadJson: payloadResult.data, editorId: editor.id, editorLabel: editor.label },
        });
        return toDraft(draft);
    }
    const row = await findModelRow(prisma, type, id);
    const draft = await prisma.adminContentDraft.upsert({
        where: { contentType_entityId: { contentType: type, entityId: id } },
        create: { contentType: type, entityId: id, baseVersion: row.version || 1, payloadJson: payloadResult.data, editorId: editor.id, editorLabel: editor.label },
        update: { payloadJson: payloadResult.data, editorId: editor.id, editorLabel: editor.label },
    });
    return toDraft(draft);
}

export async function createAdminContentDraft(type: AdminContentType, input: unknown, editor: { id: string; label: string }, stagedAssets?: Record<string, unknown>) {
    const payloadResult = adminContentPayloadSchemas[type].safeParse(payloadForCreate(type, input));
    if (!payloadResult.success) throw new ApiError(422, 'CONTENT_VALIDATION_FAILED', 'Invalid content fields.', payloadResult.error.flatten());
    const payload = payloadResult.data as Record<string, unknown>;
    const prisma = await getPrisma();
    if (type === 'directory') {
        const existing = await prisma.directoryEntry.findUnique({ where: { directoryKey: String(payload.directoryKey) } });
        if (existing) throw new ApiError(409, 'DIRECTORY_ENTRY_EXISTS', 'A directory entry with this identity already exists.');
    }
    const entityId = randomUUID();
    const draft = await prisma.adminContentDraft.create({
        data: {
            contentType: type,
            entityId,
            baseVersion: 0,
            payloadJson: payload,
            ...(stagedAssets ? { stagedAssets } : {}),
            editorId: editor.id,
            editorLabel: editor.label,
        },
    });
    return toRecordFromDraft(draft);
}

export async function stageHubGuideFileDraft(input: {
    id?: string;
    payload: unknown;
    file: File;
    editor: { id: string; label: string };
}) {
    const validatedFile = await validateHubGuidePdfFile(input.file);
    const uploaded = await uploadHubGuidePdfToDrive({ fileName: validatedFile.fileName, mimeType: 'application/pdf', buffer: validatedFile.buffer });
    const payload = uploadedHubGuidePayload(input.payload, uploaded, validatedFile.fileName);
    const payloadResult = adminContentPayloadSchemas['hub-guide'].safeParse(payload);
    const stagedAssets = {
        driveFileId: uploaded.fileId,
        resourceKey: uploaded.resourceKey,
        fileName: validatedFile.fileName,
        mimeType: 'application/pdf',
        sizeBytes: validatedFile.sizeBytes,
    };

    if (!payloadResult.success) {
        await trashManagedHubGuidePdf(uploaded.fileId);
        throw new ApiError(422, 'CONTENT_VALIDATION_FAILED', 'Invalid content fields.', payloadResult.error.flatten());
    }

    let previousStagedFileId = '';
    try {
        if (!input.id) {
            return await createAdminContentDraft('hub-guide', payloadResult.data, input.editor, stagedAssets);
        }

        const prisma = await getPrisma();
        const currentDraft = await prisma.adminContentDraft.findUnique({ where: { contentType_entityId: { contentType: 'hub-guide', entityId: input.id } } });
        const baseVersion = currentDraft?.baseVersion ?? ((await findModelRow(prisma, 'hub-guide', input.id)).version || 1);
        previousStagedFileId = currentDraft?.stagedAssets && typeof currentDraft.stagedAssets === 'object'
            ? String((currentDraft.stagedAssets as Record<string, unknown>).driveFileId || '')
            : '';
        const draft = await prisma.adminContentDraft.upsert({
            where: { contentType_entityId: { contentType: 'hub-guide', entityId: input.id } },
            create: { contentType: 'hub-guide', entityId: input.id, baseVersion, payloadJson: payloadResult.data, stagedAssets, editorId: input.editor.id, editorLabel: input.editor.label },
            update: { payloadJson: payloadResult.data, stagedAssets, editorId: input.editor.id, editorLabel: input.editor.label },
        });
        if (previousStagedFileId && previousStagedFileId !== uploaded.fileId) await trashManagedHubGuidePdf(previousStagedFileId);
        return toRecordFromDraft(draft);
    } catch (error) {
        await trashManagedHubGuidePdf(uploaded.fileId);
        throw error;
    }
}

export async function discardAdminContentDraft(type: AdminContentType, id: string) {
    const prisma = await getPrisma();
    const draft = await prisma.adminContentDraft.findUnique({ where: { contentType_entityId: { contentType: type, entityId: id } } });
    await prisma.adminContentDraft.deleteMany({ where: { contentType: type, entityId: id } });
    if (type === 'directory' && draft?.stagedAssets && typeof draft.stagedAssets === 'object' && 'driveFileId' in draft.stagedAssets) {
        await trashDriveFileById(String((draft.stagedAssets as Record<string, unknown>).driveFileId), getOrganizationLogosFolderId());
    }
    if (type === 'hub-guide' && draft?.stagedAssets && typeof draft.stagedAssets === 'object' && 'driveFileId' in draft.stagedAssets) {
        await trashManagedHubGuidePdf(String((draft.stagedAssets as Record<string, unknown>).driveFileId));
    }
}

export async function publishAdminContent(type: AdminContentType, id: string, publisher: { id: string; label: string }) {
    const prisma = await getPrisma();
    const draft = await prisma.adminContentDraft.findUnique({ where: { contentType_entityId: { contentType: type, entityId: id } } });
    if (!draft) throw new ApiError(404, 'CONTENT_DRAFT_NOT_FOUND', 'Save a draft before publishing.');
    const payloadResult = adminContentPayloadSchemas[type].safeParse(draft.payloadJson);
    if (!payloadResult.success) throw new ApiError(422, 'CONTENT_VALIDATION_FAILED', 'Draft is no longer valid.', payloadResult.error.flatten());

    const published = await prisma.$transaction(async (transaction: any) => {
        const delegate = type === 'directory' ? transaction.directoryEntry : type === 'news' ? transaction.newsPost : type === 'hub-guide' ? transaction.hubGuide : transaction.quickLink;
        const validatedPayload = payloadResult.data as Record<string, any>;
        if (draft.baseVersion === 0) {
            const created = await delegate.create({
                data: {
                    ...validatedPayload,
                    id,
                    version: 1,
                    ...(type === 'news' ? { publishedAt: new Date(validatedPayload.publishedAt as string) } : {}),
                },
            });
            const revision = await transaction.adminContentRevision.create({ data: { contentType: type, entityId: id, version: 1, payloadJson: validatedPayload, publisherId: publisher.id, publisherLabel: publisher.label } });
            await transaction.adminContentDraft.delete({ where: { id: draft.id } });
            return { updated: created, revision, previousLogoId: '', previousHubGuideFileId: '' };
        }
        const current = await delegate.findUnique({ where: { id } });
        if (!current) throw new ApiError(404, 'CONTENT_NOT_FOUND', 'Content record not found.');
        const currentVersion = current.version || 1;
        if (currentVersion !== draft.baseVersion) throw new ApiError(409, 'CONTENT_VERSION_CONFLICT', 'This record changed after the draft was started. Refresh before publishing.');
        const nextVersion = currentVersion + 1;
        const stagedAssets = draft.stagedAssets && typeof draft.stagedAssets === 'object' ? draft.stagedAssets as Record<string, unknown> : null;
        const data = {
            ...validatedPayload,
            version: nextVersion,
            ...(type === 'news' ? { publishedAt: new Date(validatedPayload.publishedAt as string) } : {}),
            ...(type === 'directory' && stagedAssets?.imageUrl ? { imageUrl: String(stagedAssets.imageUrl) } : {}),
        };
        const updated = await delegate.update({ where: { id }, data });
        let previousLogoId = '';
        let previousHubGuideFileId = '';
        if (type === 'directory' && stagedAssets?.driveFileId) {
            previousLogoId = String(current.logo?.driveFileId || '');
            await transaction.directoryLogo.upsert({
                where: { directoryEntryId: id },
                create: {
                    directoryEntryId: id,
                    driveFileId: String(stagedAssets.driveFileId),
                    resourceKey: String(stagedAssets.resourceKey || ''),
                    fileName: String(stagedAssets.fileName || 'organization-logo'),
                    mimeType: String(stagedAssets.mimeType || 'image/png'),
                    sizeBytes: Number(stagedAssets.sizeBytes || 0),
                    uploadedBy: draft.editorId,
                },
                update: {
                    driveFileId: String(stagedAssets.driveFileId),
                    resourceKey: String(stagedAssets.resourceKey || ''),
                    fileName: String(stagedAssets.fileName || 'organization-logo'),
                    mimeType: String(stagedAssets.mimeType || 'image/png'),
                    sizeBytes: Number(stagedAssets.sizeBytes || 0),
                    uploadedBy: draft.editorId,
                },
            });
            await transaction.directoryExportState.upsert({ where: { id: 'directory' }, create: { id: 'directory', status: 'pending', requestedBy: publisher.id }, update: { status: 'pending', requestedBy: publisher.id, lastError: '' } });
        }
        if (type === 'hub-guide' && stagedAssets?.driveFileId) {
            previousHubGuideFileId = String(current.driveFileId || '');
        }
        const revision = await transaction.adminContentRevision.create({ data: { contentType: type, entityId: id, version: nextVersion, payloadJson: payloadResult.data, publisherId: publisher.id, publisherLabel: publisher.label } });
        await transaction.adminContentDraft.delete({ where: { id: draft.id } });
        return { updated, revision, previousLogoId, previousHubGuideFileId };
    });

    if (published.previousLogoId && published.previousLogoId !== String((draft.stagedAssets as any)?.driveFileId || '')) {
        await trashDriveFileById(published.previousLogoId, getOrganizationLogosFolderId());
    }
    if (published.previousHubGuideFileId && published.previousHubGuideFileId !== String((draft.stagedAssets as any)?.driveFileId || '')) {
        await trashManagedHubGuidePdf(published.previousHubGuideFileId);
    }

    return { version: published.updated.version, revision: toRevision(published.revision) };
}

export async function listAdminContentHistory(type: AdminContentType, id: string) {
    const prisma = await getPrisma();
    const draft = await prisma.adminContentDraft.findUnique({ where: { contentType_entityId: { contentType: type, entityId: id } } });
    if (draft?.baseVersion === 0) return [];
    await findModelRow(prisma, type, id);
    const rows = await prisma.adminContentRevision.findMany({ where: { contentType: type, entityId: id }, orderBy: { version: 'desc' }, take: 50 });
    return rows.map(toRevision);
}
