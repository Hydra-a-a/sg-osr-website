import 'server-only';

import { unstable_cache } from 'next/cache';
import { getSheetData, getSpreadsheetSheetTitles } from '@/lib/sheets';
import { parseSheetData } from '@/lib/sheets-parser';
import { QuickLinkSchema, type QuickLink } from '@/schemas/links';
import { loadQuickLinksFromDb, resolvePublicContentSource } from '@/lib/public-content-source';
import { PUBLIC_CACHE_TAGS } from '@/lib/public-cache';

const RANGE_CANDIDATES = [
    'QuickLinks!A2:E',
    'Quick Links!A2:E',
    'Quicklinks!A2:E',
    'Links!A2:E',
    'Useful Links!A2:E',
] as const;

function normalizeSheetTitle(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function resolveCandidateRanges(availableTitles: readonly string[]): string[] {
    const normalizedTitles = new Map(
        availableTitles.filter(Boolean).map((title) => [normalizeSheetTitle(title), title] as const),
    );
    const resolved = new Set<string>();
    for (const range of RANGE_CANDIDATES) {
        const bangIndex = range.indexOf('!');
        const configuredTitle = range.slice(0, bangIndex);
        const matchedTitle = normalizedTitles.get(normalizeSheetTitle(configuredTitle));
        if (matchedTitle) resolved.add(`${matchedTitle}${range.slice(bangIndex)}`);
        resolved.add(range);
    }
    return [...resolved];
}

async function queryQuickLinks(): Promise<QuickLink[]> {
    const source = resolvePublicContentSource('QUICK_LINKS_SOURCE');
    if (source !== 'sheet') {
        try {
            return await loadQuickLinksFromDb();
        } catch (error) {
            if (source === 'db') throw error;
            console.warn('[Quick Links] Neon source unavailable; falling back to Sheets.');
        }
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_INFO_ID;
    if (!spreadsheetId) return [];
    const titles = await getSpreadsheetSheetTitles(spreadsheetId);
    let rows: string[][] = [];
    for (const range of resolveCandidateRanges(titles)) {
        try {
            rows = await getSheetData(spreadsheetId, range);
            if (rows.length > 0) break;
        } catch {
            // Continue through legacy sheet-title aliases.
        }
    }
    if (rows.length === 0) return [];

    const { validData } = parseSheetData({
        rows,
        schema: QuickLinkSchema,
        mapping: [
            { index: 0, key: 'id' },
            { index: 1, key: 'label' },
            { index: 2, key: 'desc' },
            { index: 3, key: 'href' },
            { index: 4, key: 'icon', defaultValue: 'ExternalLink' },
        ],
    });
    return validData.map((link, index) => ({
        ...link,
        id: link.id || `link-${index}`,
        label: link.label || 'Link',
        desc: link.desc || '',
        href: link.href || '#',
    }));
}

const cachedQuickLinks = unstable_cache(queryQuickLinks, ['public-quick-links'], {
    revalidate: 3600,
    tags: [PUBLIC_CACHE_TAGS.quickLinks],
});

export function fetchQuickLinks(): Promise<QuickLink[]> {
    return cachedQuickLinks();
}
