import 'server-only';

import { z } from 'zod';
import { isSafeNavigationHref, isTrustedUrl } from '@/lib/security';
import { ApiError } from '@/lib/api-errors';
import { getOrganizationLogosFolderId, trashDriveFileById } from '@/lib/google-drive';

export const ADMIN_CONTENT_TYPES = ['directory', 'news', 'hub-guide', 'quick-link'] as const;
export type AdminContentType = typeof ADMIN_CONTENT_TYPES[number];

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
    return rows.map((row: any) => ({
        id: row.id,
        version: row.version || 1,
        updatedAt: row.updatedAt.toISOString(),
        payload: entityPayload(type, row),
        draft: draftByEntity.get(row.id) || null,
    }));
}

export async function getAdminContent(type: AdminContentType, id: string) {
    const prisma = await getPrisma();
    const row = await findModelRow(prisma, type, id);
    const draft = await prisma.adminContentDraft.findUnique({ where: { contentType_entityId: { contentType: type, entityId: id } } });
    return { id: row.id, version: row.version || 1, payload: entityPayload(type, row), draft: draft ? toDraft(draft) : null };
}

export async function saveAdminContentDraft(type: AdminContentType, id: string, input: unknown, editor: { id: string; label: string }) {
    const payloadResult = adminContentPayloadSchemas[type].safeParse(input);
    if (!payloadResult.success) throw new ApiError(422, 'CONTENT_VALIDATION_FAILED', 'Invalid content fields.', payloadResult.error.flatten());
    const prisma = await getPrisma();
    const row = await findModelRow(prisma, type, id);
    const draft = await prisma.adminContentDraft.upsert({
        where: { contentType_entityId: { contentType: type, entityId: id } },
        create: { contentType: type, entityId: id, baseVersion: row.version || 1, payloadJson: payloadResult.data, editorId: editor.id, editorLabel: editor.label },
        update: { payloadJson: payloadResult.data, editorId: editor.id, editorLabel: editor.label },
    });
    return toDraft(draft);
}

export async function discardAdminContentDraft(type: AdminContentType, id: string) {
    const prisma = await getPrisma();
    const draft = await prisma.adminContentDraft.findUnique({ where: { contentType_entityId: { contentType: type, entityId: id } } });
    await prisma.adminContentDraft.deleteMany({ where: { contentType: type, entityId: id } });
    if (type === 'directory' && draft?.stagedAssets && typeof draft.stagedAssets === 'object' && 'driveFileId' in draft.stagedAssets) {
        await trashDriveFileById(String((draft.stagedAssets as Record<string, unknown>).driveFileId), getOrganizationLogosFolderId());
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
        const current = await delegate.findUnique({ where: { id } });
        if (!current) throw new ApiError(404, 'CONTENT_NOT_FOUND', 'Content record not found.');
        const currentVersion = current.version || 1;
        if (currentVersion !== draft.baseVersion) throw new ApiError(409, 'CONTENT_VERSION_CONFLICT', 'This record changed after the draft was started. Refresh before publishing.');
        const nextVersion = currentVersion + 1;
        const validatedPayload = payloadResult.data as Record<string, any>;
        const stagedAssets = draft.stagedAssets && typeof draft.stagedAssets === 'object' ? draft.stagedAssets as Record<string, unknown> : null;
        const data = {
            ...validatedPayload,
            version: nextVersion,
            ...(type === 'news' ? { publishedAt: new Date(validatedPayload.publishedAt as string) } : {}),
            ...(type === 'directory' && stagedAssets?.imageUrl ? { imageUrl: String(stagedAssets.imageUrl) } : {}),
        };
        const updated = await delegate.update({ where: { id }, data });
        let previousLogoId = '';
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
        const revision = await transaction.adminContentRevision.create({ data: { contentType: type, entityId: id, version: nextVersion, payloadJson: payloadResult.data, publisherId: publisher.id, publisherLabel: publisher.label } });
        await transaction.adminContentDraft.delete({ where: { id: draft.id } });
        return { updated, revision, previousLogoId };
    });

    if (published.previousLogoId && published.previousLogoId !== String((draft.stagedAssets as any)?.driveFileId || '')) {
        await trashDriveFileById(published.previousLogoId, getOrganizationLogosFolderId());
    }

    return { version: published.updated.version, revision: toRevision(published.revision) };
}

export async function listAdminContentHistory(type: AdminContentType, id: string) {
    const prisma = await getPrisma();
    await findModelRow(prisma, type, id);
    const rows = await prisma.adminContentRevision.findMany({ where: { contentType: type, entityId: id }, orderBy: { version: 'desc' }, take: 50 });
    return rows.map(toRevision);
}
