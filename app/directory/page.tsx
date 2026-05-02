'use client';

import { useState, useEffect, useMemo } from 'react';
import useSWR from 'swr';
import Image from 'next/image';
import { Search, Facebook, Linkedin, Users, Grid, List as ListIcon, Mail, MapPin, Building2 } from 'lucide-react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import BackLink from '@/components/BackLink';
import { isSafeNavigationHref } from '@/lib/security';

const councilBranchGroups = {
    ssc: ['SSC'],
    csc: ['MCCSC', 'PCCSC'],
    cisc: ['CEngSC', 'CBEASC', 'CASSC', 'CEDSC', 'IASC', 'ICSSC', 'IHKSC'],
} as const;

type CouncilMode = keyof typeof councilBranchGroups;
type DirectoryMode = CouncilMode | 'academic' | 'nonAcademic' | 'offices';
type SortMode = 'relevance' | 'nameAsc';
type ViewMode = 'grid' | 'list';

const DIRECTORY_UI_PREFERENCES_KEY = 'directory-ui-preferences-v1';
const DIRECTORY_UI_RESTORE_NOTICE_KEY = 'directory-ui-restored-notice-seen-v1';

const modeButtons: Array<{ key: DirectoryMode; label: string; shortLabel: string }> = [
    { key: 'ssc', label: 'Supreme Student Council', shortLabel: 'SSC' },
    { key: 'csc', label: 'Central Student Councils', shortLabel: 'CSCs' },
    { key: 'cisc', label: 'College / Institute Student Councils', shortLabel: 'CISCs' },
    { key: 'academic', label: 'Academic Organizations', shortLabel: 'Academic' },
    { key: 'nonAcademic', label: 'Non-Academic Organizations', shortLabel: 'Non-Academic' },
    { key: 'offices', label: 'University Offices', shortLabel: 'Offices' },
];

const isDirectoryMode = (value: unknown): value is DirectoryMode =>
    typeof value === 'string' && modeButtons.some((mode) => mode.key === value);

const isSortMode = (value: unknown): value is SortMode => value === 'relevance' || value === 'nameAsc';
const isViewMode = (value: unknown): value is ViewMode => value === 'grid' || value === 'list';

const modeSearchPlaceholders: Record<DirectoryMode, string> = {
    ssc: 'Search SSC officers by name, position, branch, or email.',
    csc: 'Search Central Student Councils by name, acronym, branch, or email.',
    cisc: 'Search College/Institute councils by name, acronym, branch, or email.',
    academic: 'Search academic organizations by name, category, branch, or email.',
    nonAcademic: 'Search non-academic organizations by name, category, branch, or email.',
    offices: 'Search university offices by office name, head/director, branch, or email.',
};

const modeDisplayName: Record<DirectoryMode, string> = {
    ssc: 'Supreme Student Council',
    csc: 'Central Student Councils',
    cisc: 'College / Institute Student Councils',
    academic: 'Academic Organizations',
    nonAcademic: 'Non-Academic Organizations',
    offices: 'University Offices',
};

const modeEmptyStateMessage: Record<DirectoryMode, string> = {
    ssc: 'No SSC entries matched your search.',
    csc: 'No Central Student Council entries matched your search.',
    cisc: 'No College/Institute council entries matched your search.',
    academic: 'No academic organizations matched your search.',
    nonAcademic: 'No non-academic organizations matched your search.',
    offices: 'No university offices matched your search.',
};

const modeFallbackSuggestionChips: Record<DirectoryMode, string[]> = {
    ssc: ['supreme', 'student regent', 'chairperson'],
    csc: ['mccsc', 'pccsc', 'central'],
    cisc: ['engineering', 'computer studies', 'architecture'],
    academic: ['society', 'association', 'organization'],
    nonAcademic: ['peer facilitator', 'osr', 'student council'],
    offices: ['registrar', 'admissions', 'finance'],
};

const suggestionStopWords = new Set([
    'the', 'and', 'for', 'from', 'with', 'office', 'offices', 'university', 'student', 'students', 'rtu', 'council',
    'organization', 'organizations', 'college', 'institute', 'campus', 'committee', 'department', 'center',
]);

const buildSuggestionChips = (values: string[], fallback: string[]): string[] => {
    const counts = new Map<string, number>();

    for (const value of values) {
        const tokens = value
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .map((token) => token.trim())
            .filter((token) => token.length >= 4 && !suggestionStopWords.has(token));

        const uniqueTokens = new Set(tokens);
        for (const token of uniqueTokens) {
            counts.set(token, (counts.get(token) ?? 0) + 1);
        }
    }

    const ranked = [...counts.entries()]
        .sort((a, b) => {
            if (b[1] !== a[1]) {
                return b[1] - a[1];
            }
            return a[0].localeCompare(b[0], 'en-US');
        })
        .slice(0, 3)
        .map(([token]) => token);

    return ranked.length > 0 ? ranked : fallback;
};

const directoryBadgeBaseClass = 'pill-label max-w-full mb-2 border whitespace-normal break-normal';

const branchMatchKeywords: Record<string, string[]> = {
    SSC: ['ssc', 'supreme student council'],
    MCCSC: ['mccsc', 'mandaluyong'],
    PCCSC: ['pccsc', 'pasig'],
    CEngSC: ['cengsc', 'engineering'],
    CBEASC: ['cbeasc', 'cbea'],
    CASSC: ['cassc', 'arts and sciences'],
    CEDSC: ['cedsc', 'education'],
    IASC: ['iasc', 'architecture'],
    ICSSC: ['icssc', 'computer studies'],
    IHKSC: ['ihksc', 'human kinetics'],
    OSR: ['osr', 'student regent'],
};

interface Officer {
    id?: string;
    name: string;
    position: string;
    branch?: string;
    category?: string;
    email?: string;
    facebookUrl?: string;
    linkedinUrl?: string;
    logoUrl?: string;
    priority?: number;
}

interface Office {
    id?: string;
    officeName: string;
    location?: string;
    headDirector?: string;
    email?: string;
    branch?: string;
    logoUrl?: string;
    priority?: number;
}

interface DirectoryEntryRecord {
    id?: string;
    name?: string;
    position?: string;
    branch?: string;
    category?: string;
    email?: string;
    facebookUrl?: string;
    linkedinUrl?: string;
    logoUrl?: string;
    location?: string;
    entryType?: 'office';
}

const academicBranchKeywords = ['cengsc', 'cbeasc', 'cassc', 'cedsc', 'iasc', 'icssc', 'ihksc', 'college', 'institute'];
const nonAcademicBranchKeywords = ['osr', 'ssc', 'mccsc', 'pccsc', 'pasig', 'supreme', 'student regent'];

const normalizeCategory = (category?: string): string => {
    const c = (category || '').toLowerCase();
    if (!c) {
        return '';
    }

    if (c.includes('non-academic organization') || c.includes('non academic organization')) {
        return 'nonAcademic';
    }
    if (c.includes('academic organization')) {
        return 'academic';
    }
    if (c.includes('supreme student council')) {
        return 'ssc';
    }
    if (c.includes('constitutional commission') || c.includes('constitutional commision')) {
        return 'ssc';
    }
    if (c.includes('legislative committee')) {
        return 'ssc';
    }
    if (c.includes('office of the ssc president') || c.includes('office of ssc president') || c.includes('ssc president')) {
        return 'ssc';
    }
    if (c.includes('office of student regent') || c.includes('office of the student regent')) {
        return 'ssc';
    }
    if (c.includes('independent media organization')) {
        return 'ssc';
    }
    if (c.includes('central student council')) {
        return 'csc';
    }
    if (c.includes('college') && c.includes('student council')) {
        return 'cisc';
    }

    return '';
};

const inferCouncilModeFromText = (officer: Officer): CouncilMode | '' => {
    const haystack = `${officer.branch || ''} ${officer.position || ''} ${officer.name || ''}`.toLowerCase();

    if (
        branchMatchKeywords.SSC.some((k) => haystack.includes(k))
        || haystack.includes('constitutional commission')
        || haystack.includes('legislative committee')
        || haystack.includes('office of the ssc president')
        || haystack.includes('office of ssc president')
    ) {
        return 'ssc';
    }
    if (branchMatchKeywords.OSR.some((k) => haystack.includes(k))) {
        return 'ssc';
    }
    if (branchMatchKeywords.MCCSC.some((k) => haystack.includes(k)) || branchMatchKeywords.PCCSC.some((k) => haystack.includes(k))) {
        return 'csc';
    }
    if (councilBranchGroups.cisc.some((code) => branchMatchKeywords[code].some((k) => haystack.includes(k)))) {
        return 'cisc';
    }

    return '';
};

const isCouncilMode = (mode: DirectoryMode): mode is CouncilMode => mode === 'ssc' || mode === 'csc' || mode === 'cisc';

const classifyOrganization = (officer: Officer): 'academic' | 'nonAcademic' => {
    const explicitCategory = normalizeCategory(officer.category);
    if (explicitCategory === 'academic') {
        return 'academic';
    }
    if (explicitCategory === 'nonAcademic') {
        return 'nonAcademic';
    }

    const haystack = `${officer.branch || ''} ${officer.position || ''}`.toLowerCase();
    if (academicBranchKeywords.some(keyword => haystack.includes(keyword))) {
        return 'academic';
    }

    if (nonAcademicBranchKeywords.some(keyword => haystack.includes(keyword))) {
        return 'nonAcademic';
    }

    return 'nonAcademic';
};

const belongsToMode = (officer: Officer, mode: DirectoryMode): boolean => {
    if (mode === 'offices') {
        return false;
    }

    const explicitCategory = normalizeCategory(officer.category);
    if (mode === 'academic' || mode === 'nonAcademic') {
        return explicitCategory === mode;
    }

    if (explicitCategory) {
        return explicitCategory === mode;
    }

    return inferCouncilModeFromText(officer) === mode;
};

const normalizeSearchText = (value: string): string =>
    value
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');

const compactSearchText = (value: string): string =>
    normalizeSearchText(value).replace(/[^a-z0-9]/g, '');

const matchesSearch = (query: string, values: Array<string | undefined>): boolean => {
    if (!query) {
        return true;
    }

    const normalizedQuery = normalizeSearchText(query);
    const compactQuery = compactSearchText(query);
    const haystack = normalizeSearchText(values.filter(Boolean).join(' '));
    const compactHaystack = compactSearchText(haystack);

    return haystack.includes(normalizedQuery) || (!!compactQuery && compactHaystack.includes(compactQuery));
};

const scoreSearchField = (query: string, fieldValue?: string, weight = 1): number => {
    if (!query || !fieldValue) {
        return 0;
    }

    const normalizedQuery = normalizeSearchText(query);
    const compactQuery = compactSearchText(query);
    const normalizedField = normalizeSearchText(fieldValue);
    const compactField = compactSearchText(fieldValue);

    if (!normalizedField && !compactField) {
        return 0;
    }

    if (normalizedField === normalizedQuery || compactField === compactQuery) {
        return 120 * weight;
    }
    if (normalizedField.startsWith(normalizedQuery) || (compactQuery && compactField.startsWith(compactQuery))) {
        return 80 * weight;
    }
    if (normalizedField.includes(normalizedQuery) || (compactQuery && compactField.includes(compactQuery))) {
        return 40 * weight;
    }

    return 0;
};

const getOfficerSearchScore = (query: string, officer: Officer): number => {
    if (!query) {
        return 1;
    }

    let score = 0;
    score += scoreSearchField(query, officer.name, 6);
    score += scoreSearchField(query, officer.email, 5);
    score += scoreSearchField(query, officer.position, 4);
    score += scoreSearchField(query, officer.category, 3);
    score += scoreSearchField(query, officer.branch, 2);
    return score;
};

const getOfficeSearchScore = (query: string, office: Office): number => {
    if (!query) {
        return 1;
    }

    let score = 0;
    score += scoreSearchField(query, office.officeName, 6);
    score += scoreSearchField(query, office.email, 5);
    score += scoreSearchField(query, office.headDirector, 4);
    score += scoreSearchField(query, office.location, 3);
    score += scoreSearchField(query, office.branch, 2);
    return score;
};

const getSafeExternalHref = (href?: string): string | undefined => {
    if (!href || !isSafeNavigationHref(href)) {
        return undefined;
    }

    return href;
};

type DirectoryResponsePayload = {
    leaders?: Officer[];
    offices?: Office[];
    data?: DirectoryEntryRecord[];
    error?: { message?: string } | string;
};

const DIRECTORY_SWR_OPTIONS = {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000,
    keepPreviousData: true,
} as const;

async function fetchDirectoryPayload(url: string): Promise<DirectoryResponsePayload> {
    const response = await fetch(url);
    const payload = await response.json().catch(() => ({} as DirectoryResponsePayload));

    if (!response.ok) {
        const fallbackMessage = 'Failed to load directory data';
        const message = typeof payload?.error === 'string'
            ? payload.error
            : payload?.error?.message || fallbackMessage;
        throw new Error(message);
    }

    return payload;
}

export default function DirectoryPage() {
    const { data: response, error, isLoading } = useSWR('/api/directory', fetchDirectoryPayload, DIRECTORY_SWR_OPTIONS);
    const officers = useMemo(() => {
        if (Array.isArray(response?.leaders) && response.leaders.length > 0) {
            return response.leaders as Officer[];
        }

        return ((response?.data || []) as DirectoryEntryRecord[])
            .filter((entry) => entry.entryType !== 'office')
            .map((entry, index) => ({
                id: entry.id || `entry-${index}`,
                name: entry.name || '',
                position: entry.position || 'Organization',
                branch: entry.branch,
                category: entry.category,
                email: entry.email,
                facebookUrl: entry.facebookUrl,
                linkedinUrl: entry.linkedinUrl,
                logoUrl: entry.logoUrl,
            }))
            .filter((entry) => Boolean(entry.name));
    }, [response?.data, response?.leaders]);
    const offices = useMemo(() => {
        if (Array.isArray(response?.offices) && response.offices.length > 0) {
            return response.offices as Office[];
        }

        return ((response?.data || []) as DirectoryEntryRecord[])
            .filter((entry) => entry.entryType === 'office')
            .map((entry, index) => ({
                id: entry.id || `office-${index}`,
                officeName: entry.name || '',
                location: entry.location,
                headDirector: entry.position?.startsWith('Head/Director:')
                    ? entry.position.replace(/^Head\/Director:\s*/i, '')
                    : entry.position,
                email: entry.email,
                branch: entry.branch,
                logoUrl: entry.logoUrl,
            }))
            .filter((entry) => Boolean(entry.officeName));
    }, [response?.data, response?.offices]);
    const prefersReducedMotion = useReducedMotion();

    const [search, setSearch] = useState('');
    const [viewModeState, setViewModeState] = useState<ViewMode>('grid');
    const [userOverridden, setUserOverridden] = useState(false);
    const [mode, setMode] = useState<DirectoryMode>('ssc');
    const [sortMode, setSortMode] = useState<SortMode>('relevance');
    const [prefsLoaded, setPrefsLoaded] = useState(false);
    const [showRestoredHint, setShowRestoredHint] = useState(false);
    const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
    const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

    const handleImageLoad = (imageId: string) => {
        setLoadedImages((prev) => {
            if (prev.has(imageId)) return prev;
            const next = new Set(prev);
            next.add(imageId);
            return next;
        });
    };

    const handleImageError = (imageId: string) => {
        setFailedImages((prev) => {
            if (prev.has(imageId)) return prev;
            const next = new Set(prev);
            next.add(imageId);
            return next;
        });
    };

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem(DIRECTORY_UI_PREFERENCES_KEY);
            if (!raw) {
                setPrefsLoaded(true);
                return;
            }

            let restoredAnyPreference = false;

            const parsed = JSON.parse(raw) as {
                mode?: unknown;
                sortMode?: unknown;
                viewMode?: unknown;
                userOverridden?: unknown;
            };

            if (isDirectoryMode(parsed.mode)) {
                setMode(parsed.mode);
                restoredAnyPreference = true;
            }

            if (isSortMode(parsed.sortMode)) {
                setSortMode(parsed.sortMode);
                restoredAnyPreference = true;
            }

            if (isViewMode(parsed.viewMode)) {
                setViewModeState(parsed.viewMode);
                restoredAnyPreference = true;
            }

            if (typeof parsed.userOverridden === 'boolean') {
                setUserOverridden(parsed.userOverridden);
                restoredAnyPreference = true;
            }

            const restoreNoticeSeen = sessionStorage.getItem(DIRECTORY_UI_RESTORE_NOTICE_KEY) === '1';
            if (restoredAnyPreference && !restoreNoticeSeen) {
                setShowRestoredHint(true);
                sessionStorage.setItem(DIRECTORY_UI_RESTORE_NOTICE_KEY, '1');
            }
        } catch {
            // Ignore malformed storage and continue with defaults.
        } finally {
            setPrefsLoaded(true);
        }
    }, []);

    useEffect(() => {
        if (!showRestoredHint) {
            return;
        }

        const timer = window.setTimeout(() => {
            setShowRestoredHint(false);
        }, 3200);

        return () => window.clearTimeout(timer);
    }, [showRestoredHint]);

    useEffect(() => {
        if (!prefsLoaded) {
            return;
        }

        sessionStorage.setItem(
            DIRECTORY_UI_PREFERENCES_KEY,
            JSON.stringify({
                mode,
                sortMode,
                viewMode: viewModeState,
                userOverridden,
            })
        );
    }, [mode, sortMode, viewModeState, userOverridden, prefsLoaded]);

    const HeaderIcon = mode === 'offices' ? Building2 : Users;
    const headerIconKey = mode === 'offices' ? 'offices' : 'organizations';

    const currentCount = mode === 'offices' ? offices.length : officers.length;
    const viewMode = (!userOverridden && currentCount > 15) ? 'list' : viewModeState;

    const handleViewChange = (mode: 'grid' | 'list') => {
        setViewModeState(mode);
        setUserOverridden(true);
    };

    const handleSuggestionChipClick = (value: string) => {
        setSearch(value);
    };

    const clearFilters = () => {
        setSearch('');
        setSortMode('relevance');
    };

    const filteredOfficers = useMemo(() => {
        return officers
            .map((o, idx) => ({
                officer: o,
                idx,
                score: getOfficerSearchScore(search, o),
            }))
            .filter(({ officer, score }) =>
                score > 0 && matchesSearch(search, [officer.name, officer.email, officer.position, officer.branch, officer.category])
            )
            .sort((a, b) => {
                if (b.score !== a.score) {
                    return b.score - a.score;
                }
                return a.idx - b.idx;
            })
            .map(({ officer }) => officer);
    }, [officers, search]);

    const filteredAcademicOrganizations = useMemo(
        () => filteredOfficers.filter((o) => belongsToMode(o, 'academic')),
        [filteredOfficers]
    );
    const filteredNonAcademicOrganizations = useMemo(
        () => filteredOfficers.filter((o) => belongsToMode(o, 'nonAcademic')),
        [filteredOfficers]
    );
    const baseAcademicOrganizations = useMemo(
        () => officers.filter((o) => belongsToMode(o, 'academic')),
        [officers]
    );
    const baseNonAcademicOrganizations = useMemo(
        () => officers.filter((o) => belongsToMode(o, 'nonAcademic')),
        [officers]
    );

    const filteredCouncilLeaders = useMemo(() => {
        if (!isCouncilMode(mode)) {
            return [] as Officer[];
        }

        return filteredOfficers.filter((officer) => belongsToMode(officer, mode));
    }, [filteredOfficers, mode]);

    const baseCouncilLeaders = useMemo(() => {
        if (!isCouncilMode(mode)) {
            return [] as Officer[];
        }

        return officers.filter((officer) => belongsToMode(officer, mode));
    }, [officers, mode]);

    const filteredOffices = useMemo(() => {
        return offices
            .map((o, idx) => ({
                office: o,
                idx,
                score: getOfficeSearchScore(search, o),
            }))
            .filter(({ office, score }) =>
                score > 0 && matchesSearch(search, [office.officeName, office.location, office.headDirector, office.email, office.branch])
            )
            .sort((a, b) => {
                if (b.score !== a.score) {
                    return b.score - a.score;
                }
                return a.idx - b.idx;
            })
            .map(({ office }) => office);
    }, [offices, search]);

    const sectionDataCount = useMemo(() => {
        if (mode === 'academic') {
            return filteredAcademicOrganizations.length;
        }
        if (mode === 'nonAcademic') {
            return filteredNonAcademicOrganizations.length;
        }
        if (mode === 'offices') {
            return filteredOffices.length;
        }
        return filteredCouncilLeaders.length;
    }, [filteredAcademicOrganizations.length, filteredNonAcademicOrganizations.length, filteredOffices.length, filteredCouncilLeaders.length, mode]);

    const displayedOfficers = useMemo(() => {
        if (mode === 'academic') {
            return filteredAcademicOrganizations;
        }
        if (mode === 'nonAcademic') {
            return filteredNonAcademicOrganizations;
        }
        return filteredCouncilLeaders;
    }, [filteredAcademicOrganizations, filteredCouncilLeaders, filteredNonAcademicOrganizations, mode]);

    const sortedDisplayedOfficers = useMemo(() => {
        if (sortMode !== 'nameAsc') {
            return displayedOfficers;
        }

        return [...displayedOfficers].sort((a, b) => a.name.localeCompare(b.name, 'en-US', { sensitivity: 'base' }));
    }, [displayedOfficers, sortMode]);

    const sortedFilteredOffices = useMemo(() => {
        if (sortMode !== 'nameAsc') {
            return filteredOffices;
        }

        return [...filteredOffices].sort((a, b) => a.officeName.localeCompare(b.officeName, 'en-US', { sensitivity: 'base' }));
    }, [filteredOffices, sortMode]);

    const suggestionSourceValues = useMemo(() => {
        if (mode === 'offices') {
            return offices.flatMap((office) => [office.officeName, office.headDirector, office.branch].filter(Boolean) as string[]);
        }

        if (mode === 'academic') {
            return baseAcademicOrganizations.flatMap((officer) => [officer.name, officer.position, officer.branch, officer.category].filter(Boolean) as string[]);
        }

        if (mode === 'nonAcademic') {
            return baseNonAcademicOrganizations.flatMap((officer) => [officer.name, officer.position, officer.branch, officer.category].filter(Boolean) as string[]);
        }

        return baseCouncilLeaders.flatMap((officer) => [officer.name, officer.position, officer.branch, officer.category].filter(Boolean) as string[]);
    }, [baseAcademicOrganizations, baseCouncilLeaders, baseNonAcademicOrganizations, mode, offices]);

    const suggestionChips = useMemo(
        () => buildSuggestionChips(suggestionSourceValues, modeFallbackSuggestionChips[mode]),
        [mode, suggestionSourceValues]
    );

    const officerBadge = useMemo(() => {
        if (mode === 'academic') {
            return 'Academic Organization';
        }
        if (mode === 'nonAcademic') {
            return 'Non-Academic Organization';
        }
        if (mode === 'ssc') {
            return 'Supreme Student Council';
        }
        if (mode === 'csc') {
            return 'Central Student Council';
        }
        return 'College / Institute Student Council';
    }, [mode]);

    return (
        <>
            {/* Header — no motion, instant render */}
            <section className="portal-section-slate pt-14 pb-8 md:pt-18 md:pb-10">
                <div className="portal-noise-overlay" aria-hidden="true" />
                <div className="container-main relative z-10">
                    <div className="mx-auto w-full max-w-7xl">
                        <BackLink href="/" label="Back to Home" className="mb-6 text-slate-200 hover:text-white transition-colors" />

                        <div className="directory-hero-shell grid gap-7 lg:grid-cols-[minmax(0,1.15fr)_320px] lg:items-end">
                            <div className="max-w-2xl">
                                <span className="portal-eyebrow">Student Directory</span>
                                <div className="mt-5">
                                    <div className="directory-hero-icon relative flex h-12 w-12 items-center justify-center rounded-2xl">
                                        <AnimatePresence mode="wait" initial={false}>
                                            <motion.div
                                                key={headerIconKey}
                                                className="absolute inset-0 flex items-center justify-center"
                                                initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                                                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                                                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                                                transition={{ duration: 0.2 }}
                                            >
                                                <HeaderIcon className="text-white/85" size={28} />
                                            </motion.div>
                                        </AnimatePresence>
                                    </div>
                                </div>
                                <h1 className="mt-6 portal-title">
                                    University <span className="portal-title-accent">Directory</span>
                                </h1>
                                <p className="mt-5 portal-lead max-w-2xl">
                                    Browse RTU organizations by hierarchy: SSC, Central Student Councils, College/Institute councils,
                                    academic and non-academic organizations, plus university offices.
                                </p>
                            </div>

                            <div className="directory-hero-meta-card portal-panel-soft p-5 md:p-6">
                                <p className="directory-hero-meta-kicker">Live View</p>
                                <div className="directory-hero-meta-grid mt-4">
                                    <div className="directory-hero-meta-row">
                                        <span className="directory-hero-meta-label">Focus</span>
                                        <span className="directory-hero-meta-value">{modeDisplayName[mode]}</span>
                                    </div>
                                    <div className="directory-hero-meta-row">
                                        <span className="directory-hero-meta-label">Results</span>
                                        <span className="directory-hero-meta-value">{sectionDataCount}</span>
                                    </div>
                                    <div className="directory-hero-meta-row">
                                        <span className="directory-hero-meta-label">Layout</span>
                                        <span className="directory-hero-meta-value">{viewMode === 'grid' ? 'Grid' : 'List'}</span>
                                    </div>
                                    <div className="directory-hero-meta-row">
                                        <span className="directory-hero-meta-label">Sort</span>
                                        <span className="directory-hero-meta-value">{sortMode === 'nameAsc' ? 'Name A-Z' : 'Relevance'}</span>
                                    </div>
                                </div>
                                {showRestoredHint && (
                                    <p className="mt-4 text-xs text-amber-100/85">
                                        Your last directory preferences were restored for this session.
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="portal-panel directory-controls-panel mt-8 p-5 md:p-6">
                            <LayoutGroup id="directory-mode-tabs">
                                <div className="flex justify-center gap-2.5 md:gap-3 flex-wrap">
                                    {modeButtons.map((modeButton) => {
                                        const isActive = mode === modeButton.key;
                                        return (
                                            <button
                                                key={modeButton.key}
                                                onClick={() => {
                                                    setMode(modeButton.key);
                                                }}
                                                className={`relative px-5 py-2.5 rounded-full text-sm font-semibold cursor-pointer border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/60 ${isActive ? 'directory-mode-pill-active' : 'directory-mode-pill-inactive'}`}
                                                aria-pressed={isActive}
                                                title={modeButton.label}
                                            >
                                                {isActive && (
                                                    <motion.span
                                                        aria-hidden
                                                        layoutId="active-directory-mode"
                                                        className="directory-mode-pill-bg absolute inset-0 rounded-full"
                                                        transition={prefersReducedMotion
                                                            ? { duration: 0 }
                                                            : { type: 'spring', stiffness: 420, damping: 34, mass: 0.55 }}
                                                    />
                                                )}
                                                <span className="directory-mode-label-short relative z-10 md:hidden">{modeButton.shortLabel}</span>
                                                <span className="directory-mode-label-full relative z-10 hidden md:inline">{modeButton.label}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </LayoutGroup>

                            <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                                <div className="directory-glass-field">
                                    <Search size={20} className="text-slate-300" />
                                    <input
                                        type="text"
                                        placeholder={modeSearchPlaceholders[mode]}
                                        className="flex-1 min-w-0 bg-transparent text-base text-white outline-none placeholder:text-slate-400"
                                        value={search}
                                        onChange={(e) => {
                                            setSearch(e.target.value);
                                        }}
                                    />
                                </div>

                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:justify-end">
                                    <div className="flex items-center gap-3">
                                        <label className="text-xs text-slate-300 font-semibold uppercase tracking-[0.12em]">
                                            Sort
                                        </label>
                                        <select
                                            value={sortMode}
                                            onChange={(e) => setSortMode(e.target.value === 'nameAsc' ? 'nameAsc' : 'relevance')}
                                            className="directory-select"
                                            aria-label="Sort directory results"
                                        >
                                            <option value="relevance">Relevance</option>
                                            <option value="nameAsc">Name A-Z</option>
                                        </select>
                                    </div>

                                    <div className="directory-view-toggle">
                                        <button
                                            onClick={() => handleViewChange('grid')}
                                            className={`directory-view-toggle-button ${viewMode === 'grid' ? 'directory-view-toggle-button-active' : ''}`}
                                            title="Grid View"
                                            aria-label="Switch to grid view"
                                            aria-pressed={viewMode === 'grid'}
                                        >
                                            <Grid size={18} />
                                        </button>
                                        <button
                                            onClick={() => handleViewChange('list')}
                                            className={`directory-view-toggle-button ${viewMode === 'list' ? 'directory-view-toggle-button-active' : ''}`}
                                            title="List View"
                                            aria-label="Switch to list view"
                                            aria-pressed={viewMode === 'list'}
                                        >
                                            <ListIcon size={18} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="portal-section-dark pt-6 pb-12 md:pt-8 md:pb-14">
                <div className="portal-noise-overlay" aria-hidden="true" />
                <div className="container-main relative z-10">
                    <div className="mx-auto w-full max-w-7xl">
                    <div className="portal-panel directory-summary-panel px-4 py-3 md:px-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                <span className="directory-summary-chip">{modeDisplayName[mode]}</span>
                                <span className="text-sm font-semibold text-slate-100">
                                    {sectionDataCount} {sectionDataCount === 1 ? 'result' : 'results'}
                                </span>
                                {showRestoredHint && (
                                    <span className="directory-restored-chip">
                                        Preferences restored
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={clearFilters}
                                className="directory-filter-action"
                            >
                                Clear search and sort
                            </button>
                        </div>
                    </div>

                    <div className="mt-6">
                        {isLoading && (
                            <div className={viewMode === 'grid' ? 'grid grid-cols-1 gap-8 md:grid-cols-2 2xl:grid-cols-3' : 'flex flex-col gap-4'}>
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <div key={i} className="portal-panel p-6 flex flex-col gap-4">
                                        <div className="skeleton w-16 h-16 rounded-full" />
                                        <div className="skeleton h-4 w-3/4" />
                                        <div className="skeleton h-3 w-1/2" />
                                        <div className="skeleton h-3 w-1/3" />
                                    </div>
                                ))}
                            </div>
                        )}
                        {error && (
                            <div className="portal-notice portal-notice-red rounded-3xl px-5 py-4 text-center">
                                Failed to load directory
                            </div>
                        )}
                        <p className="sr-only" aria-live="polite">
                            Showing {sectionDataCount} entries in {viewMode} view.
                        </p>
                        {!isLoading && !error && sectionDataCount === 0 && (
                            <div className="portal-panel p-6 md:p-8 text-center">
                                <p className="font-medium text-white">
                                    {search
                                        ? modeEmptyStateMessage[mode]
                                        : `No ${mode === 'offices' ? 'offices' : 'entries'} in this section yet.`}
                                </p>
                                <p className="mt-2 text-sm text-slate-300">
                                    Try one of these suggested searches:
                                </p>
                                <div className="mt-3 flex flex-wrap justify-center gap-2">
                                    {suggestionChips.map((chip) => (
                                        <button
                                            key={chip}
                                            onClick={() => handleSuggestionChipClick(chip)}
                                            className="directory-empty-chip"
                                        >
                                            {chip}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.div
                                key={`${mode}-results`}
                                className={viewMode === 'grid' ? 'grid grid-cols-1 gap-8 md:grid-cols-2 2xl:grid-cols-3' : 'flex flex-col gap-4'}
                                initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                                transition={{ duration: 0.2 }}
                            >
                                {mode !== 'offices' && sortedDisplayedOfficers.map((officer, idx) => (
                                    <div
                                        key={officer.id || idx}
                                        className={`portal-panel directory-result-card sg-hover-card ${viewMode === 'list' ? 'p-6 flex-row items-start gap-4 sm:items-center sm:gap-6' : 'directory-result-card-grid p-7 md:p-8 flex-col'} flex content-visibility-auto`}
                                    >
                                        <div
                                            className={`directory-avatar-gradient ${viewMode === 'list' ? 'mb-0 h-12 w-12 shrink-0' : 'mb-5 h-[4.5rem] w-[4.5rem]'} rounded-full flex items-center justify-center text-white font-bold text-xl`}
                                        >
                                            {getSafeExternalHref(officer.logoUrl) && !failedImages.has(officer.id) ? (
                                                <div className="relative w-full h-full rounded-full overflow-hidden bg-white">
                                                    {!loadedImages.has(officer.id) && (
                                                        <div className="absolute inset-0 skeleton" />
                                                    )}
                                                    <Image
                                                        src={getSafeExternalHref(officer.logoUrl) as string}
                                                        alt={`${officer.name} logo`}
                                                        fill
                                                        sizes={viewMode === 'list' ? '48px' : '64px'}
                                                        unoptimized
                                                        className="object-contain p-1"
                                                        onLoad={() => handleImageLoad(officer.id)}
                                                        onError={() => handleImageError(officer.id)}
                                                    />
                                                </div>
                                            ) : (
                                                officer.name.charAt(0)
                                            )}
                                        </div>

                                        <div className={`${viewMode === 'list' ? 'flex-1 min-w-0 space-y-1.5' : 'min-w-0 space-y-3'}`}>
                                            <span className={`${directoryBadgeBaseClass} bg-sky-400/12 text-sky-200 border-white/10`}>
                                                {officer.category || officerBadge}
                                            </span>
                                            <h3 className="font-semibold text-white break-words leading-snug text-[1.15rem]">
                                                {officer.name}
                                            </h3>
                                            {officer.email && (
                                                <p className="text-sm text-slate-300 break-words">
                                                    {officer.email}
                                                </p>
                                            )}
                                            {officer.position && viewMode === 'list' && (
                                                <p className="text-xs text-slate-400 break-words">
                                                    {officer.position}
                                                </p>
                                            )}
                                        </div>

                                        <div className={`directory-result-actions flex flex-wrap gap-2 ${viewMode === 'grid' ? 'mt-6' : 'ml-0 w-full self-start sm:ml-4 sm:w-auto sm:shrink-0 sm:self-auto'}`}>
                                            {officer.email && (
                                                <a
                                                    href={`mailto:${officer.email}`}
                                                    className="directory-contact-link"
                                                    title={`Email ${officer.name}`}
                                                >
                                                    <Mail size={18} />
                                                    <span>Email</span>
                                                </a>
                                            )}
                                            {getSafeExternalHref(officer.facebookUrl) && (
                                                <a
                                                    href={getSafeExternalHref(officer.facebookUrl)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="directory-contact-link"
                                                    title={`Facebook page for ${officer.name}`}
                                                >
                                                    <Facebook size={18} />
                                                    <span>Facebook</span>
                                                </a>
                                            )}
                                            {getSafeExternalHref(officer.linkedinUrl) && (
                                                <a
                                                    href={getSafeExternalHref(officer.linkedinUrl)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="directory-contact-link"
                                                    title="LinkedIn Profile"
                                                >
                                                    <Linkedin size={18} />
                                                    <span>LinkedIn</span>
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {mode === 'offices' && sortedFilteredOffices.map((office, idx) => (
                                    <div
                                        key={office.id || idx}
                                        className={`portal-panel directory-result-card sg-hover-card ${viewMode === 'list' ? 'p-6 flex-row items-start gap-4 sm:items-center sm:gap-6' : 'directory-result-card-grid p-7 md:p-8 flex-col'} flex content-visibility-auto`}
                                    >
                                        <div
                                            className={`directory-avatar-gradient ${viewMode === 'list' ? 'mb-0 h-12 w-12 shrink-0' : 'mb-5 h-[4.5rem] w-[4.5rem]'} rounded-full flex items-center justify-center text-white`}
                                        >
                                            {getSafeExternalHref(office.logoUrl) && !failedImages.has(office.id) ? (
                                                <div className="relative w-full h-full rounded-full overflow-hidden bg-white">
                                                    {!loadedImages.has(office.id) && (
                                                        <div className="absolute inset-0 skeleton" />
                                                    )}
                                                    <Image
                                                        src={getSafeExternalHref(office.logoUrl) as string}
                                                        alt={`${office.officeName} logo`}
                                                        fill
                                                        sizes={viewMode === 'list' ? '48px' : '64px'}
                                                        unoptimized
                                                        className="object-contain p-1"
                                                        onLoad={() => handleImageLoad(office.id)}
                                                        onError={() => handleImageError(office.id)}
                                                    />
                                                </div>
                                            ) : (
                                                <Building2 size={22} />
                                            )}
                                        </div>

                                        <div className={`${viewMode === 'list' ? 'flex-1 min-w-0 space-y-1.5' : 'min-w-0 space-y-3'}`}>
                                            <span className={`${directoryBadgeBaseClass} bg-amber-300/12 text-amber-100 border-white/10`}>
                                                University Office
                                            </span>
                                            <h3 className="font-semibold text-white break-words leading-snug text-[1.15rem]">
                                                {office.officeName}
                                            </h3>

                                            {office.headDirector && (
                                                <p className="directory-office-head text-sm break-words">
                                                    Head/Director: {office.headDirector}
                                                </p>
                                            )}

                                            {office.branch && (
                                                <p className="text-xs text-slate-400 break-words">
                                                    {office.branch}
                                                </p>
                                            )}

                                            <div className="space-y-1 text-sm text-slate-300">
                                                {office.location && (
                                                    <p className="flex items-center gap-2">
                                                        <MapPin size={14} />
                                                        <span>{office.location}</span>
                                                    </p>
                                                )}
                                                {office.email && (
                                                    <a
                                                        href={`mailto:${office.email}`}
                                                        className="inline-flex items-center gap-2 no-underline text-slate-300 hover:text-white transition-colors"
                                                    >
                                                        <Mail size={14} />
                                                        <span>{office.email}</span>
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                    </div>
                </div>
            </section>
        </>
    );
}
