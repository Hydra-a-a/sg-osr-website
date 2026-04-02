import { NextResponse } from 'next/server';
import { getSheetData, getSheetDataWithHyperlinks } from '@/lib/sheets';
import { parseSheetData } from '@/lib/sheets-parser';
import { OfficerSchema, OfficeSchema } from '@/schemas/directory';
import { rateLimit } from '@/lib/rate-limit';
import { getClientIp, redactErrorForLog } from '@/lib/security';
import { ApiError, toApiResponse } from '@/lib/api-errors';

// cache for an hour. don't hit google sheets every time or they ban us.
export const revalidate = 3600;

const TEXT_DASHES = /[\u2012\u2013\u2014\u2015\u2212]/g;
const SAFE_TEXT_ALLOWED = /[^a-zA-Z0-9\s.,'\-\u00F1\u00D1()&/]/g;

function normalizeText(value: unknown): string {
    if (value === null || value === undefined) {
        return '';
    }

    return String(value)
        .replace(TEXT_DASHES, '-')
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeSafeText(value: unknown): string {
    return normalizeText(value)
        .replace(/:/g, ' -')
        .replace(SAFE_TEXT_ALLOWED, '')
        .trim();
}

function cleanEmail(value: unknown): string | undefined {
    const cleaned = normalizeText(value)
        .replace(/[<>]/g, '')
        .replace(/^[,;\s]+|[,;\s]+$/g, '')
        .toLowerCase();

    if (!cleaned || ['n/a', 'na', 'none', '-', '--'].includes(cleaned)) {
        return undefined;
    }

    return cleaned || undefined;
}

function cleanFacebookUrl(value: unknown): string | undefined {
    const cleaned = normalizeText(value)
        .replace(/[<>]/g, '')
        .replace(/^[,;\s]+|[,;\s]+$/g, '');

    if (!cleaned) {
        return undefined;
    }

    const hyperlinkMatch = cleaned.match(/^=\s*HYPERLINK\(\s*"([^"]+)"\s*,/i);
    if (hyperlinkMatch?.[1]) {
        const extracted = hyperlinkMatch[1].trim();
        if (/^https?:\/\//i.test(extracted)) {
            return cleanFacebookUrl(extracted);
        }
        if (/^(?:www\.|web\.)?(facebook\.com|fb\.com)\//i.test(extracted)) {
            return `https://${extracted.replace(/^www\./i, '')}`;
        }
    }

    const facebookLike = cleaned.replace(/^https?:\/\//i, '');
    const facebookMatch = facebookLike.match(/^(?:www\.|web\.)?(facebook\.com|fb\.com)\/(.+)$/i);
    if (facebookMatch) {
        const path = facebookMatch[2].replace(/^\/+/, '');
        const normalized = `https://facebook.com/${path}`;
        try {
            const parsed = new URL(normalized);
            if (parsed.protocol === 'https:' && /(^|\.)facebook\.com$/i.test(parsed.hostname)) {
                return normalized;
            }
        } catch {
            return undefined;
        }
    }

    return undefined;
}

function isRowEmpty(row: unknown[]): boolean {
    return row.every((cell) => normalizeText(cell) === '');
}

function isOrganizationHeaderRow(cells: string[]): boolean {
    const joined = cells.join(' ').toLowerCase();
    return (
        joined.includes('rizal technological university student organizations') ||
        (joined.includes('organization') && joined.includes('acronym')) ||
        (joined.includes('name') && joined.includes('initials') && joined.includes('emails')) ||
        joined.includes('# of tickets received')
    );
}

function isOfficeHeaderRow(cells: string[]): boolean {
    const joined = cells.join(' ').toLowerCase();
    return (
        joined.includes('rizal technological university officials') ||
        (joined.includes('offices') && joined.includes('acronym')) ||
        (joined.includes('academic / administrative official') && joined.includes('title / position'))
    );
}

function normalizeOrganizationCategory(value: string): string | undefined {
    const normalized = normalizeSafeText(value).toLowerCase();
    if (!normalized) {
        return undefined;
    }

    if (normalized.includes('non-academic organization') || normalized.includes('non academic organization')) {
        return 'Non-Academic Organization';
    }

    if (normalized.includes('academic organization')) {
        return 'Academic Organization';
    }

    if (normalized.includes('supreme student council')) {
        return 'Supreme Student Council';
    }

    if (normalized.includes('central student council')) {
        return 'Central Student Council';
    }

    if (
        normalized.includes('college and institute student council') ||
        normalized.includes('college & institute student council') ||
        normalized.includes('college/institute student council')
    ) {
        return 'College / Institute Student Council';
    }

    return undefined;
}

function normalizeExplicitOrganizationCategory(value: unknown): string | undefined {
    const safeValue = normalizeSafeText(value);
    if (!safeValue) {
        return undefined;
    }

    return normalizeOrganizationCategory(safeValue) || safeValue;
}

function extractOrganizationCategory(cells: string[]): string | undefined {
    for (const cell of cells) {
        const category = normalizeOrganizationCategory(cell);
        if (category) {
            return category;
        }
    }

    return undefined;
}

function inferCategoryFromOrganizationName(name: string): string | undefined {
    const normalized = normalizeSafeText(name).toLowerCase();
    if (!normalized) {
        return undefined;
    }

    if (normalized.includes('supreme student council')) {
        return 'Supreme Student Council';
    }

    if (normalized.includes('central student council')) {
        return 'Central Student Council';
    }

    if (normalized.includes('student council')) {
        return 'College / Institute Student Council';
    }

    return undefined;
}

function isOrganizationSectionRow(name: string, cells: string[]): boolean {
    const normalizedName = normalizeSafeText(name).toLowerCase();
    if (!normalizedName) {
        return false;
    }

    const knownSectionLabels = [
        'academic organization',
        'academic organizations',
        'non-academic organization',
        'non-academic organizations',
        'central student council',
        'central student councils',
        'college / institute student council',
        'college & institute student council',
        'college and institute student council',
    ];

    if (knownSectionLabels.includes(normalizedName)) {
        return true;
    }

    const contentCells = cells.filter((cell) => normalizeSafeText(cell));
    return contentCells.length === 1 && (normalizedName.includes('organization') || normalizedName.includes('student council'));
}

function dedupeByKey<T>(items: T[], getKey: (item: T) => string): T[] {
    const seen = new Set<string>();
    const deduped: T[] = [];

    for (const item of items) {
        const key = getKey(item);
        if (!key || seen.has(key)) {
            continue;
        }
        seen.add(key);
        deduped.push(item);
    }

    return deduped;
}

function isSupremeStudentCouncilEntry(entry: { name?: string; branch?: string; category?: string }): boolean {
    const normalizedCategory = normalizeOrganizationCategory(entry.category || '');
    if (normalizedCategory === 'Supreme Student Council') {
        return true;
    }

    const normalizedBranch = normalizeOrganizationCategory(entry.branch || '');
    if (normalizedBranch === 'Supreme Student Council') {
        return true;
    }

    return normalizeSafeText(entry.name || '').toLowerCase().includes('supreme student council');
}

function parseWorkbookOrganizations(rows: string[][], options: {
    nameIndex: number;
    acronymIndex: number;
    emailIndex: number;
    facebookIndex?: number;
    categoryIndex?: number;
    sourceLabel: string;
    fallbackBranch?: string;
}) {
    const parsed: Array<{
        id?: string;
        name: string;
        position: string;
        branch: string;
        category?: string;
        email?: string;
        facebookUrl?: string;
        linkedinUrl?: string;
    }> = [];

    let currentBranch = normalizeSafeText(options.fallbackBranch || options.sourceLabel);
    let nameIndex = options.nameIndex;
    let acronymIndex = options.acronymIndex;
    let emailIndex = options.emailIndex;
    let facebookIndex = options.facebookIndex;
    let categoryIndex = options.categoryIndex;

    const valueAt = (cells: string[], index: number): string => {
        if (index < 0) {
            return '';
        }
        return cells[index] || '';
    };

    for (const row of rows) {
        if (!row || isRowEmpty(row)) {
            continue;
        }

        const cells = row.map((cell) => normalizeText(cell));

        if (isOrganizationHeaderRow(cells)) {
            continue;
        }

        const lowerCells = cells.map((cell) => cell.toLowerCase());
        const detectedNameIndex = lowerCells.findIndex((cell) => cell.includes('organization name') || cell === 'organization');
        const detectedEmailIndex = lowerCells.findIndex((cell) => cell.includes('contact email') || cell === 'email' || cell === 'emails');
        const detectedFacebookIndex = lowerCells.findIndex((cell) => cell.includes('facebook'));
        const detectedCategoryIndex = lowerCells.findIndex((cell) => cell.includes('organization category') || cell.includes('category'));
        const detectedAcronymIndex = lowerCells.findIndex((cell) => cell.includes('acronym') || cell.includes('initialism') || cell.includes('initials'));

        if (detectedNameIndex >= 0 && detectedEmailIndex >= 0) {
            nameIndex = detectedNameIndex;
            emailIndex = detectedEmailIndex;
            facebookIndex = detectedFacebookIndex >= 0 ? detectedFacebookIndex : facebookIndex;
            categoryIndex = detectedCategoryIndex >= 0 ? detectedCategoryIndex : categoryIndex;
            acronymIndex = detectedAcronymIndex >= 0 ? detectedAcronymIndex : -1;
            continue;
        }

        const rawName = valueAt(cells, nameIndex);
        const rawAcronym = valueAt(cells, acronymIndex);
        const rawEmail = valueAt(cells, emailIndex);
        const rawFacebook = valueAt(cells, facebookIndex ?? -1);
        const inferredCategoryFromName = inferCategoryFromOrganizationName(rawName);
        const explicitCategory = categoryIndex !== undefined ? normalizeExplicitOrganizationCategory(valueAt(cells, categoryIndex)) : undefined;
        const extractedCategory =
            explicitCategory ||
            extractOrganizationCategory(cells) ||
            inferredCategoryFromName ||
            normalizeOrganizationCategory(options.fallbackBranch || '') ||
            normalizeSafeText(options.fallbackBranch || options.sourceLabel);

        const name = normalizeSafeText(rawName);
        const acronym = normalizeSafeText(rawAcronym);
        const email = cleanEmail(rawEmail);
        const facebookUrl = cleanFacebookUrl(rawFacebook);

        if (!name) {
            continue;
        }

        // Only skip true section/header rows; valid rows may have blank acronym/email or N/A email.
        if (isOrganizationSectionRow(name, cells)) {
            currentBranch = extractedCategory || name;
            continue;
        }

        const candidate = {
            name,
            position: acronym || 'Organization',
            branch: extractedCategory || currentBranch || normalizeSafeText(options.fallbackBranch || options.sourceLabel),
            category: extractedCategory,
            email,
            facebookUrl,
            linkedinUrl: undefined,
        };

        const validated = OfficerSchema.safeParse(candidate);
        if (validated.success) {
            parsed.push(validated.data);
        }
    }

    return parsed;
}

function parseWorkbookOffices(rows: string[][]) {
    const parsed: Array<{
        id?: string;
        officeName: string;
        location: string;
        headDirector: string;
        email?: string;
        branch: string;
        priority?: number;
    }> = [];

    let currentBranch = 'University Office';

    for (const row of rows) {
        if (!row || isRowEmpty(row)) {
            continue;
        }

        const cells = row.map((cell) => normalizeText(cell));
        if (isOfficeHeaderRow(cells)) {
            continue;
        }

        const hasLeadingGap = !cells[0] && !!cells[1];
        const base = hasLeadingGap ? 1 : 0;

        const officeName = normalizeSafeText(cells[base] || '');
        const acronym = normalizeSafeText(cells[base + 1] || '');
        const email = cleanEmail(cells[base + 2] || '');
        const official = normalizeSafeText(cells[base + 3] || '');
        const title = normalizeSafeText(cells[base + 4] || '');
        const location = normalizeSafeText(cells[base + 5] || '');

        if (!officeName) {
            continue;
        }

        // Category rows have only a section label and no office details.
        if (!acronym && !email && !official && !title && !location) {
            currentBranch = officeName;
            continue;
        }

        const candidate = {
            officeName,
            location,
            headDirector: [official, title].filter(Boolean).join(' - '),
            email,
            branch: currentBranch,
            priority: undefined,
        };

        const validated = OfficeSchema.safeParse(candidate);
        if (validated.success) {
            parsed.push(validated.data);
        }
    }

    return parsed;
}

export async function GET(request: Request) {
    const ip = getClientIp(request);
    const limit = rateLimit(`dir_api_${ip}`, 30, 60000); // 30 requests per minute per IP

    if (!limit.success) {
        return toApiResponse(new ApiError(429, 'RATE_LIMITED', 'Too many requests'));
    }

    try {
        const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_DIRECTORY_ID || process.env.GOOGLE_SHEETS_INFO_ID;
        const LEGACY_OFFICERS_RANGE = 'Officers!A2:G';
        const LEGACY_OFFICES_RANGE = 'Offices!A2:F';

        const WORKBOOK_ORG_RANGES = [
            { range: 'ORGANIZATIONS!A1:G', nameIndex: 0, acronymIndex: -1, emailIndex: 1, facebookIndex: 3, categoryIndex: 2, sourceLabel: 'Organizations', fallbackBranch: 'Academic Organization' },
            { range: 'INSTITUTES!A1:D', nameIndex: 0, acronymIndex: 1, emailIndex: 2, facebookIndex: 3, sourceLabel: 'Institutes', fallbackBranch: 'College / Institute Organization' },
            { range: 'Central Student Councils!A1:D', nameIndex: 0, acronymIndex: 1, emailIndex: 2, facebookIndex: 3, sourceLabel: 'Central Student Councils', fallbackBranch: 'Central Student Council' },
            { range: 'Supreme Student Council!A1:D', nameIndex: 0, acronymIndex: -1, emailIndex: 1, facebookIndex: 3, categoryIndex: 2, sourceLabel: 'Supreme Student Council', fallbackBranch: 'Supreme Student Council' },
            { range: 'BONI!A1:D', nameIndex: 0, acronymIndex: 1, emailIndex: 2, facebookIndex: 3, sourceLabel: 'Boni', fallbackBranch: 'Academic Organization' },
            { range: 'PASIG!A1:D', nameIndex: 0, acronymIndex: 1, emailIndex: 2, facebookIndex: 3, sourceLabel: 'Pasig', fallbackBranch: 'Academic Organization' },
            { range: 'Non-Academic Organization!A1:D', nameIndex: 0, acronymIndex: 1, emailIndex: 2, facebookIndex: 3, sourceLabel: 'Non-Academic Organization', fallbackBranch: 'Non-Academic Organization' },
        ] as const;

        const WORKBOOK_OFFICES_RANGE = 'OFFICES!A1:G';

        if (!SPREADSHEET_ID) {
            return toApiResponse(new ApiError(500, 'SERVICE_MISCONFIGURED', 'Internal server error', undefined, false));
        }

        const fetchRangeSafe = async (range: string) => {
            try {
                return await getSheetData(SPREADSHEET_ID, range);
            } catch (rangeError) {
                console.warn(`[Directory] Sheet range unavailable: ${range}`, rangeError);
                return [] as string[][];
            }
        };

        const fetchRangeWithLinksSafe = async (range: string) => {
            try {
                return await getSheetDataWithHyperlinks(SPREADSHEET_ID, range);
            } catch (rangeError) {
                console.warn(`[Directory] Hyperlink sheet range unavailable: ${range}`, rangeError);
                return [] as string[][];
            }
        };

        const [
            legacyOfficerRows,
            ...workbookOrganizationRows
        ] = await Promise.all([
            fetchRangeSafe(LEGACY_OFFICERS_RANGE),
            ...WORKBOOK_ORG_RANGES.map((config) => fetchRangeWithLinksSafe(config.range)),
        ]);

        const { validData: rawLegacyOfficers, invalidCount: invalidLegacyOfficerCount } = parseSheetData({
            rows: legacyOfficerRows || [],
            schema: OfficerSchema,
            mapping: [
                { index: 0, key: 'id' },
                { index: 1, key: 'name', defaultValue: '', transform: normalizeSafeText },
                { index: 2, key: 'position', defaultValue: '', transform: normalizeSafeText },
                { index: 3, key: 'branch', defaultValue: '', transform: normalizeSafeText },
                { index: 7, key: 'category', transform: normalizeOrganizationCategory },
                { index: 4, key: 'facebookUrl' },
                { index: 5, key: 'linkedinUrl' },
                { index: 6, key: 'priority', transform: (v) => parseInt(v, 10) }
            ],
            onError: (err, rowNum) => {
                console.warn(`[Directory:Officers] Row ${rowNum} skipped:`, err);
            }
        });

        // The dedicated "Supreme Student Council" workbook tab is the source of truth for SSC entries.
        const legacyOfficers = rawLegacyOfficers.filter((officer) => !isSupremeStudentCouncilEntry(officer));

        const workbookOfficers = WORKBOOK_ORG_RANGES.flatMap((config, idx) => {
            const parsed = parseWorkbookOrganizations(workbookOrganizationRows[idx] || [], config);
            if (config.sourceLabel === 'Supreme Student Council') {
                return parsed;
            }

            return parsed.filter((officer) => !isSupremeStudentCouncilEntry(officer));
        });

        const mergedOfficers = dedupeByKey(
            [...legacyOfficers, ...workbookOfficers],
            (officer) => [
                normalizeText(officer.name).toLowerCase(),
                normalizeText(officer.email || '').toLowerCase(),
                normalizeText(officer.category || '').toLowerCase(),
                normalizeText(officer.position).toLowerCase(),
            ].join('|')
        );

        const finalOfficers = mergedOfficers.map((officer, index) => ({
            ...officer,
            id: officer.id || `auto-${index}`,
        }));

        let legacyOfficeRows: string[][] = [];
        let workbookOfficeRows: string[][] = [];
        let officeSheetUnavailable = false;
        try {
            [legacyOfficeRows, workbookOfficeRows] = await Promise.all([
                fetchRangeSafe(LEGACY_OFFICES_RANGE),
                fetchRangeSafe(WORKBOOK_OFFICES_RANGE),
            ]);
        } catch (officeFetchError) {
            officeSheetUnavailable = true;
            console.warn('[Directory:Offices] Office sheet unavailable or unreadable. Returning officers only.', officeFetchError);
        }

        const { validData: legacyOffices, invalidCount: invalidLegacyOfficeCount } = parseSheetData({
            rows: legacyOfficeRows || [],
            schema: OfficeSchema,
            mapping: [
                { index: 0, key: 'id' },
                { index: 1, key: 'officeName', defaultValue: '', transform: normalizeSafeText },
                { index: 2, key: 'location', defaultValue: '', transform: normalizeSafeText },
                { index: 3, key: 'headDirector', defaultValue: '', transform: normalizeSafeText },
                { index: 4, key: 'email', transform: cleanEmail },
                { index: 5, key: 'branch', defaultValue: '', transform: normalizeSafeText },
            ],
            onError: (err, rowNum) => {
                console.warn(`[Directory:Offices] Row ${rowNum} skipped:`, err);
            }
        });

        const workbookOffices = parseWorkbookOffices(workbookOfficeRows || []);
        const mergedOffices = dedupeByKey(
            [...legacyOffices, ...workbookOffices],
            (office) => `${normalizeText(office.officeName).toLowerCase()}|${normalizeText(office.email || '').toLowerCase()}`
        );

        const finalOffices = mergedOffices.map((office, index) => ({
            ...office,
            id: office.id || `office-${index}`,
        }));

        const merged = [
            ...finalOfficers,
            ...finalOffices.map(office => ({
                id: office.id,
                name: office.officeName,
                position: office.headDirector ? `Head/Director: ${office.headDirector}` : 'Office Contact',
                branch: office.branch,
                priority: office.priority,
                email: office.email,
                location: office.location,
                entryType: 'office' as const,
            })),
        ];

        return NextResponse.json({
            data: merged,
            leaders: finalOfficers,
            offices: finalOffices,
            meta: {
                total:
                    (legacyOfficerRows?.length || 0) +
                    workbookOrganizationRows.reduce((sum, rows) => sum + (rows?.length || 0), 0) +
                    (legacyOfficeRows?.length || 0) +
                    (workbookOfficeRows?.length || 0),
                valid: finalOfficers.length + finalOffices.length,
                invalid: invalidLegacyOfficerCount + invalidLegacyOfficeCount,
                officeSheetUnavailable,
            }
        });

    } catch (error) {
        console.error('Directory API Error:', redactErrorForLog(error));
        return toApiResponse(error);
    }
}
