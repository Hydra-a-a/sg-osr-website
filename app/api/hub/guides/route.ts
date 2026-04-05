import { NextResponse } from 'next/server';
import { getSheetDataWithHyperlinks, getSpreadsheetSheetTitles } from '@/lib/sheets';
import { checkRateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog, sanitizeText } from '@/lib/security';
import { ApiError, toApiResponse } from '@/lib/api-errors';
import { extractGoogleDriveFileId, getDriveFileMetadataById } from '@/lib/google-drive';
import { TransparencyGuideSchema, type TransparencyGuide } from '@/schemas/transparency-hub';

const DEFAULT_INFO_SPREADSHEET_ID = '1LSkRWGzqWAuTodMDIVlzYTMWr8AhFMywcUd3PoziXaw';
const BASE_CANDIDATE_RANGES = [
    process.env.STUDENT_HUB_GUIDES_RANGE?.trim(),
    'Student Hub Control!A2:F',
    'Transparency Hub!A2:F',
].filter((value): value is string => Boolean(value));
const CANDIDATE_SPREADSHEET_IDS = Array.from(new Set([
    process.env.STUDENT_HUB_GUIDES_SPREADSHEET_ID?.trim(),
    process.env.GOOGLE_SHEETS_INFO_ID?.trim(),
    process.env.GOOGLE_SHEETS_DIRECTORY_ID?.trim(),
    DEFAULT_INFO_SPREADSHEET_ID,
].filter((value): value is string => Boolean(value))));

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ResolvedPdfLink = {
    source: 'drive' | 'direct';
    embedUrl: string;
    viewUrl: string;
    downloadUrl: string;
    canEmbed: boolean;
    fileName?: string;
};

function extractDriveResourceKey(viewUrl?: string | null): string {
    if (!viewUrl) {
        return '';
    }

    try {
        const parsed = new URL(viewUrl);
        return sanitizeText(parsed.searchParams.get('resourcekey') || '');
    } catch {
        return '';
    }
}

function parseVisibility(value: string): boolean {
    const normalized = sanitizeText(value).toLowerCase();
    if (!normalized) {
        return true;
    }

    return !['0', 'false', 'no', 'n', 'hide', 'hidden', 'inactive', 'disabled'].includes(normalized);
}

function parseSortOrder(value: string, fallback: number): number {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
        return fallback;
    }

    return parsed;
}

function createGuideId(title: string, url: string, index: number): string {
    const base = sanitizeText(title || url)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);

    return `${base || 'guide'}-${index + 1}`;
}

function rangeFromSheetTitle(title: string): string {
    // Quote sheet names so spaces and punctuation remain valid in A1 notation.
    const escaped = title.replace(/'/g, "''");
    return `'${escaped}'!A2:F`;
}

function findFirstUrl(cells: string[]): string {
    for (const cell of cells) {
        if (/^https:\/\//i.test(cell.trim())) {
            return cell.trim();
        }
    }

    return '';
}

async function resolvePdfLink(candidateUrl: string): Promise<ResolvedPdfLink | null> {
    const normalizedCandidate = sanitizeText(candidateUrl);
    if (!normalizedCandidate) {
        return null;
    }

    try {
        const parsed = new URL(normalizedCandidate);
        if (parsed.protocol !== 'https:') {
            return null;
        }

        const driveFileId = extractGoogleDriveFileId(parsed.toString());
        if (driveFileId) {
            const candidateResourceKey = extractDriveResourceKey(parsed.toString());
            const metadata = await getDriveFileMetadataById(driveFileId, candidateResourceKey || undefined);
            if (!metadata || metadata.mimeType !== 'application/pdf') {
                return null;
            }

            const viewUrl = metadata.webViewLink || `https://drive.google.com/file/d/${driveFileId}/view`;
            const resourceKey = extractDriveResourceKey(metadata.webViewLink) || candidateResourceKey;
            const embedUrl = resourceKey
                ? `/api/hub/guides/preview/${encodeURIComponent(driveFileId)}?resourcekey=${encodeURIComponent(resourceKey)}`
                : `/api/hub/guides/preview/${encodeURIComponent(driveFileId)}`;

            const downloadUrl = metadata.webContentLink || `https://drive.google.com/uc?export=download&id=${driveFileId}`;

            return {
                source: 'drive',
                embedUrl,
                viewUrl,
                downloadUrl,
                canEmbed: true,
                fileName: sanitizeText(metadata.name || ''),
            };
        }

        if (!parsed.pathname.toLowerCase().endsWith('.pdf')) {
            return null;
        }

        const safeUrl = parsed.toString();
        return {
            source: 'direct',
            embedUrl: safeUrl,
            viewUrl: safeUrl,
            downloadUrl: safeUrl,
            canEmbed: true,
        };
    } catch {
        return null;
    }
}

async function getCandidateRangesForSpreadsheet(spreadsheetId: string): Promise<string[]> {
    const titles = await getSpreadsheetSheetTitles(spreadsheetId);
    const discoveredRanges = titles
        .filter((title) => /student\s*hub|transparency\s*hub|handbooks?|guides?/i.test(title))
        .map((title) => rangeFromSheetTitle(title));

    return Array.from(new Set([...BASE_CANDIDATE_RANGES, ...discoveredRanges]));
}

async function loadHubGuideRows(): Promise<any[][]> {
    let hadReadError = false;

    for (const spreadsheetId of CANDIDATE_SPREADSHEET_IDS) {
        const ranges = await getCandidateRangesForSpreadsheet(spreadsheetId);
        for (const range of ranges) {
            try {
                const rows = await getSheetDataWithHyperlinks(spreadsheetId, range);
                if (rows.length > 0) {
                    return rows;
                }
            } catch (error) {
                hadReadError = true;
                console.warn(`[Hub Guides API] Failed to read ${range} from spreadsheet ${spreadsheetId}:`, redactErrorForLog(error));
            }
        }
    }

    if (hadReadError) {
        throw new ApiError(502, 'HUB_GUIDES_SOURCE_UNAVAILABLE', 'Unable to read Student Hub guides from Google Sheets right now.');
    }

    return [];
}

export async function GET(request: Request) {
    const ip = getClientIp(request);
    const limit = await checkRateLimit(`hub_guides_${ip}`, 40, 60_000);

    if (!limit.success) {
        return toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests'));
    }

    try {
        const rawRows = await loadHubGuideRows();

        const guides = await Promise.all(rawRows.map(async (rawRow, index) => {
            const cells = rawRow.map((cell) => sanitizeText(String(cell || '')));
            if (cells.every((cell) => !cell)) {
                return null;
            }

            const titleCell = cells[0] || '';
            const descriptionCell = cells[1] || '';
            const explicitUrl = cells[2] || '';
            const categoryCell = cells[3] || 'Student Handbook & Guides';
            const visibilityCell = cells[4] || '';
            const sortOrderCell = cells[5] || '';

            if (!parseVisibility(visibilityCell)) {
                return null;
            }

            const resolved = await resolvePdfLink(explicitUrl || findFirstUrl(cells));
            if (!resolved) {
                return null;
            }

            const title = titleCell || resolved.fileName || `Guide ${index + 1}`;
            const candidateGuide: TransparencyGuide = {
                id: createGuideId(title, resolved.viewUrl, index),
                title,
                description: descriptionCell,
                category: categoryCell,
                source: resolved.source,
                embedUrl: resolved.embedUrl,
                viewUrl: resolved.viewUrl,
                downloadUrl: resolved.downloadUrl,
                canEmbed: resolved.canEmbed,
                mimeType: 'application/pdf',
                sortOrder: parseSortOrder(sortOrderCell, index),
                updatedAt: new Date().toISOString(),
            };

            const validation = TransparencyGuideSchema.safeParse(candidateGuide);
            if (!validation.success) {
                console.warn(`[Hub Guides] Invalid row skipped (${index + 2})`, validation.error.flatten());
                return null;
            }

            return validation.data;
        }));

        const data = guides
            .filter((guide): guide is TransparencyGuide => Boolean(guide))
            .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));

        return NextResponse.json({ data });
    } catch (error) {
        console.error('[Hub Guides API] Failed to fetch Student Hub guides:', redactErrorForLog(error));
        return toApiResponse(error);
    }
}
