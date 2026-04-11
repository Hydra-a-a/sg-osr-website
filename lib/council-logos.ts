export interface DirectoryLogoSource {
    name?: string;
    position?: string;
    branch?: string;
    category?: string;
    logoUrl?: string;
}

export interface CouncilLogoDescriptor {
    id: string;
    name: string;
    abbr: string;
    src: string;
}

const COUNCIL_MATCH_TERMS: Record<string, string[]> = {
    ssc: ['supreme student council', 'ssc'],
    cengsc: ['college of engineering student council', 'cengsc'],
    cbeasc: ['cbea student council', 'cbeasc'],
    mccsc: ['mandaluyong campus central student council', 'mccsc', 'mandaluyong'],
    cassc: ['college of arts and sciences student council', 'cassc', 'arts and sciences'],
    cedsc: ['college of education student council', 'cedsc'],
    iasc: ['institute of architecture student council', 'iasc', 'architecture'],
    icssc: ['institute of computer studies student council', 'icssc', 'computer studies'],
    ihksc: ['institute of human kinetics student council', 'ihksc', 'human kinetics'],
    pccsc: ['pasig campus central student council', 'pccsc', 'pasig'],
};

function normalizeForMatch(value: string): string {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesTerm(haystack: string, term: string): boolean {
    const normalizedTerm = normalizeForMatch(term);
    if (!normalizedTerm) {
        return false;
    }

    if (normalizedTerm.includes(' ')) {
        return haystack.includes(normalizedTerm);
    }

    const pattern = new RegExp(`\\b${escapeRegex(normalizedTerm)}\\b`);
    return pattern.test(haystack);
}

function buildSourceHaystack(source: DirectoryLogoSource): string {
    return normalizeForMatch([
        source.name || '',
        source.position || '',
        source.branch || '',
        source.category || '',
    ].join(' '));
}

function getSafeLogoUrl(value?: string): string | undefined {
    const trimmed = (value || '').trim();
    if (!trimmed) {
        return undefined;
    }

    if (trimmed.startsWith('/')) {
        return trimmed.startsWith('//') ? undefined : trimmed;
    }

    try {
        const parsed = new URL(trimmed);
        if (parsed.protocol !== 'https:') {
            return undefined;
        }
    } catch {
        return undefined;
    }

    return trimmed;
}

function resolveCouncilLogo(council: CouncilLogoDescriptor, sources: DirectoryLogoSource[]): string | undefined {
    const terms = [
        ...(COUNCIL_MATCH_TERMS[council.id] || []),
        council.name,
        council.abbr,
    ].map(normalizeForMatch).filter(Boolean);

    for (const source of sources) {
        const logoUrl = getSafeLogoUrl(source.logoUrl);
        if (!logoUrl) {
            continue;
        }

        const haystack = buildSourceHaystack(source);
        if (!haystack) {
            continue;
        }

        if (terms.some((term) => matchesTerm(haystack, term))) {
            return logoUrl;
        }
    }

    return undefined;
}

export function applyCouncilLogoOverrides<T extends CouncilLogoDescriptor>(
    councils: T[],
    sources: DirectoryLogoSource[]
): T[] {
    if (!Array.isArray(councils) || councils.length === 0) {
        return [];
    }

    if (!Array.isArray(sources) || sources.length === 0) {
        return councils;
    }

    return councils.map((council) => {
        const override = resolveCouncilLogo(council, sources);
        return override ? { ...council, src: override } : council;
    });
}
