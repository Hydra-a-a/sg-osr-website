
export const SSC_SUB_CATEGORIES: readonly string[] = [
    'office of the ssc',
    'office of the supreme student council',
    'legislative committee',
    'constitutional commission',
    'executive committee',
    'judicial committee',
    'election committee',
    'commission on audit',
    'commission on appointments',
];

export const CSC_SUB_CATEGORIES: readonly string[] = [
    'office of the csc',
    'office of the central student council',
];

export function normalizeGroupLabel(raw: string): string {
    const lower = raw.toLowerCase().trim();
    if (!lower) return 'Other';

    if (SSC_SUB_CATEGORIES.some((sub) => lower.includes(sub))) {
        return 'Supreme Student Council';
    }
    if (CSC_SUB_CATEGORIES.some((sub) => lower.includes(sub))) {
        return 'Central Student Council';
    }

    return raw;
}

export function slugifyGroupKey(label: string): string {
    return label
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
}

export function readGroupHash(): string | null {
    if (typeof window === 'undefined') return null;
    const raw = window.location.hash.replace(/^#/, '');
    if (!raw) return null;

    const parts = raw.split('&');
    for (const part of parts) {
        const [key, value] = part.split('=');
        if (key === 'group' && value) {
            return decodeURIComponent(value);
        }
    }
    return null;
}


export function writeGroupHash(slug: string | null): void {
    if (typeof window === 'undefined') return;
    const { pathname, search } = window.location;
    const nextHash = slug ? `#group=${encodeURIComponent(slug)}` : '';
    const nextUrl = `${pathname}${search}${nextHash}`;
    window.history.replaceState(null, '', nextUrl);
}


export function normalizeSearchToken(value: string): string {
    return value
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

/**
 * Returns true when any of the given fields contain the normalized query.
 * Undefined or empty fields are skipped so null contact methods don't match.
 */
export function entryMatchesQuery(fields: Array<string | undefined | null>, normalizedQuery: string): boolean {
    if (!normalizedQuery) return true;
    for (const field of fields) {
        if (!field) continue;
        if (normalizeSearchToken(String(field)).includes(normalizedQuery)) {
            return true;
        }
    }
    return false;
}

export function getInitials(name: string, fallback: string): string {
    const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
    if (parts.length === 0) return fallback;
    return parts
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}
