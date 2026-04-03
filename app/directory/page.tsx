'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { Search, Facebook, Linkedin, Users, Grid, List as ListIcon, Mail, MapPin, Building2 } from 'lucide-react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
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
    priority?: number;
}

interface Office {
    id?: string;
    officeName: string;
    location?: string;
    headDirector?: string;
    email?: string;
    branch?: string;
    priority?: number;
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

    if (branchMatchKeywords.SSC.some((k) => haystack.includes(k))) {
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

export default function DirectoryPage() {
    const { data: response, error, isLoading } = useSWR('/api/directory', (url: string) => fetch(url).then(res => res.json()));
    const officers: Officer[] = response?.leaders || [];
    const offices: Office[] = response?.offices || [];
    const prefersReducedMotion = useReducedMotion();

    const [search, setSearch] = useState('');
    const [viewModeState, setViewModeState] = useState<ViewMode>('grid');
    const [userOverridden, setUserOverridden] = useState(false);
    const [mode, setMode] = useState<DirectoryMode>('ssc');
    const [sortMode, setSortMode] = useState<SortMode>('relevance');
    const [prefsLoaded, setPrefsLoaded] = useState(false);
    const [showRestoredHint, setShowRestoredHint] = useState(false);

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

    const filteredOfficers = officers
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

    const filteredAcademicOrganizations = filteredOfficers.filter((o) => belongsToMode(o, 'academic'));
    const filteredNonAcademicOrganizations = filteredOfficers.filter((o) => belongsToMode(o, 'nonAcademic'));
    const baseAcademicOrganizations = officers.filter((o) => belongsToMode(o, 'academic'));
    const baseNonAcademicOrganizations = officers.filter((o) => belongsToMode(o, 'nonAcademic'));

    const filteredCouncilLeaders = filteredOfficers.filter((officer) => {
        if (!isCouncilMode(mode)) {
            return false;
        }

        return belongsToMode(officer, mode);
    });

    const baseCouncilLeaders = officers.filter((officer) => {
        if (!isCouncilMode(mode)) {
            return false;
        }

        return belongsToMode(officer, mode);
    });

    const filteredOffices = offices
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

    const sectionDataCount =
        mode === 'academic'
            ? filteredAcademicOrganizations.length
            : mode === 'nonAcademic'
                ? filteredNonAcademicOrganizations.length
                : mode === 'offices'
                    ? filteredOffices.length
                    : filteredCouncilLeaders.length;

    const displayedOfficers = mode === 'academic'
        ? filteredAcademicOrganizations
        : mode === 'nonAcademic'
            ? filteredNonAcademicOrganizations
            : filteredCouncilLeaders;

    const sortedDisplayedOfficers = sortMode === 'nameAsc'
        ? [...displayedOfficers].sort((a, b) => a.name.localeCompare(b.name, 'en-US', { sensitivity: 'base' }))
        : displayedOfficers;

    const sortedFilteredOffices = sortMode === 'nameAsc'
        ? [...filteredOffices].sort((a, b) => a.officeName.localeCompare(b.officeName, 'en-US', { sensitivity: 'base' }))
        : filteredOffices;

    const suggestionSourceValues = mode === 'offices'
        ? offices.flatMap((office) => [office.officeName, office.headDirector, office.branch].filter(Boolean) as string[])
        : mode === 'academic'
            ? baseAcademicOrganizations.flatMap((officer) => [officer.name, officer.position, officer.branch, officer.category].filter(Boolean) as string[])
            : mode === 'nonAcademic'
                ? baseNonAcademicOrganizations.flatMap((officer) => [officer.name, officer.position, officer.branch, officer.category].filter(Boolean) as string[])
                : baseCouncilLeaders.flatMap((officer) => [officer.name, officer.position, officer.branch, officer.category].filter(Boolean) as string[]);

    const suggestionChips = buildSuggestionChips(suggestionSourceValues, modeFallbackSuggestionChips[mode]);

    const officerBadge = mode === 'academic'
        ? 'Academic Organization'
        : mode === 'nonAcademic'
            ? 'Non-Academic Organization'
            : mode === 'ssc'
                ? 'Supreme Student Council'
                : mode === 'csc'
                    ? 'Central Student Council'
                    : 'College / Institute Student Council';

    return (
        <>
            {/* Header — no motion, instant render */}
            <section className="bg-gradient-rtu page-header">
                <div className="container-main text-center">
                    <div className="mx-auto mb-4 h-10 w-10 relative">
                        <AnimatePresence mode="wait" initial={false}>
                            <motion.div
                                key={headerIconKey}
                                className="absolute inset-0 flex items-center justify-center"
                                initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                                exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                                transition={{ duration: 0.2 }}
                            >
                                <HeaderIcon className="text-white/80" size={40} />
                            </motion.div>
                        </AnimatePresence>
                    </div>
                    <h1 className="page-header-title font-bold text-white mb-3">
                        University <span className="text-gradient-gold">Directory</span>
                    </h1>
                    <p className="page-header-subtitle max-w-lg mx-auto">
                        Browse RTU organizations by hierarchy: SSC, Central Student Councils, College/Institute councils, academic and non-academic organizations, plus university offices.
                    </p>
                </div>
            </section>

            {/* Directory Hierarchy Tabs */}
            <section className="container-main mt-8 md:mt-10 mb-4">
                <LayoutGroup id="directory-mode-tabs">
                    <div className="flex gap-3 md:gap-4 justify-center flex-wrap">
                        {modeButtons.map((modeButton) => {
                            const isActive = mode === modeButton.key;
                            return (
                                <button
                                    key={modeButton.key}
                                    onClick={() => {
                                        setMode(modeButton.key);
                                    }}
                                    className="relative px-5 py-2.5 rounded-full text-sm font-semibold cursor-pointer border-2 transition-colors"
                                    aria-pressed={isActive}
                                    title={modeButton.label}
                                    style={{
                                        color: isActive ? 'white' : 'var(--text-secondary)',
                                        borderColor: isActive ? 'transparent' : 'var(--glass-border)',
                                        background: isActive ? 'transparent' : 'var(--bg-card)',
                                    }}
                                >
                                    {isActive && (
                                        <motion.span
                                            aria-hidden
                                            layoutId="active-directory-mode"
                                            className="absolute inset-0 rounded-full"
                                            style={{ background: 'var(--rtu-gold-dark)' }}
                                            transition={prefersReducedMotion
                                                ? { duration: 0 }
                                                : { type: 'spring', stiffness: 420, damping: 34, mass: 0.55 }}
                                        />
                                    )}
                                    <span className="relative z-10 md:hidden">{modeButton.shortLabel}</span>
                                    <span className="relative z-10 hidden md:inline">{modeButton.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </LayoutGroup>
            </section>

            {/* Search Bar & View Toggle */}
            <section className="container-main mt-2 md:mt-3">
                <div className="card p-5 md:p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
                    <div className="flex items-center gap-3 flex-1 min-w-0 rounded-lg p-2 border border-soft bg-surface-base">
                        <Search size={20} className="text-subtle" />
                        <input
                            type="text"
                            placeholder={modeSearchPlaceholders[mode]}
                            className="flex-1 min-w-0 outline-none text-base bg-transparent text-strong placeholder:text-subtle"
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                            }}
                        />
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                        <label className="text-xs text-subtle font-semibold uppercase tracking-[0.06em]">
                            Sort
                        </label>
                        <select
                            value={sortMode}
                            onChange={(e) => setSortMode(e.target.value === 'nameAsc' ? 'nameAsc' : 'relevance')}
                            className="h-9 rounded-lg border border-soft px-3 text-sm text-body bg-white outline-none"
                            aria-label="Sort directory results"
                        >
                            <option value="relevance">Relevance</option>
                            <option value="nameAsc">Name A-Z</option>
                        </select>

                        {/* View Controls */}
                        <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => handleViewChange('grid')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-amber-500' : 'text-gray-400 hover:text-gray-600'}`}
                            title="Grid View"
                            aria-label="Switch to grid view"
                            aria-pressed={viewMode === 'grid'}
                        >
                            <Grid size={18} />
                        </button>
                        <button
                            onClick={() => handleViewChange('list')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-amber-500' : 'text-gray-400 hover:text-gray-600'}`}
                            title="List View"
                            aria-label="Switch to list view"
                            aria-pressed={viewMode === 'list'}
                        >
                            <ListIcon size={18} />
                        </button>
                        </div>
                    </div>
                </div>
            </section>

            <section className="container-main mt-4 mb-2">
                <div className="rounded-xl border border-soft bg-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="pill-label bg-blue-50 text-blue-700 border border-blue-100">{modeDisplayName[mode]}</span>
                        <span className="text-sm text-body font-semibold">{sectionDataCount} {sectionDataCount === 1 ? 'result' : 'results'}</span>
                        {showRestoredHint && (
                            <span className="micro-note text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">
                                Preferences restored
                            </span>
                        )}
                    </div>
                    <button
                        onClick={clearFilters}
                        className="text-sm font-medium text-subtle hover:text-body transition-colors"
                    >
                        Clear search and sort
                    </button>
                </div>
            </section>

            {/* Grid */}
            <section className="section pt-10 md:pt-12">
                <div className="container-main">
                    {isLoading && (
                        <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-4"}>
                            {Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="card p-6 flex flex-col gap-4">
                                    <div className="skeleton w-16 h-16 rounded-full" />
                                    <div className="skeleton h-4 w-3/4" />
                                    <div className="skeleton h-3 w-1/2" />
                                    <div className="skeleton h-3 w-1/3" />
                                </div>
                            ))}
                        </div>
                    )}
                    {error && (
                        <p className="text-center text-red-500">Failed to load directory</p>
                    )}
                    <p className="sr-only" aria-live="polite">
                        Showing {sectionDataCount} entries in {viewMode} view.
                    </p>
                    {!isLoading && !error && sectionDataCount === 0 && (
                        <div className="card p-6 text-center">
                            <p className="text-body font-medium">
                                {search
                                    ? modeEmptyStateMessage[mode]
                                    : `No ${mode === 'offices' ? 'offices' : 'entries'} in this section yet.`}
                            </p>
                            <p className="text-sm text-subtle mt-2">
                                Try one of these suggested searches:
                            </p>
                            <div className="mt-3 flex flex-wrap justify-center gap-2">
                                {suggestionChips.map((chip) => (
                                    <button
                                        key={chip}
                                        onClick={() => handleSuggestionChipClick(chip)}
                                        className="pill-label pill-label-tight bg-surface-base text-body border border-soft hover:bg-blue-50 hover:text-blue-700 hover:border-blue-100 transition-colors"
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
                            className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" : "flex flex-col gap-4"}
                            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                            transition={{ duration: 0.2 }}
                        >
                            {mode !== 'offices' && sortedDisplayedOfficers.map((officer, idx) => (
                                <div
                                    key={officer.id || idx}
                                    className={`card p-6 flex ${viewMode === 'list' ? 'flex-row items-start sm:items-center gap-4 sm:gap-6' : 'flex-col'} content-visibility-auto`}
                                >
                                {/* Avatar */}
                                <div
                                    className={`${viewMode === 'list' ? 'w-12 h-12 mb-0 shrink-0' : 'w-16 h-16 mb-4'} rounded-full flex items-center justify-center text-white font-bold text-xl`}
                                    style={{ background: 'linear-gradient(135deg, var(--rtu-blue), var(--rtu-blue-light))' }}
                                >
                                    {officer.name.charAt(0)}
                                </div>

                                <div className={`${viewMode === 'list' ? 'flex-1 min-w-0' : 'min-w-0'} space-y-1.5`}>
                                    {/* Category Badge */}
                                    <span className={`${directoryBadgeBaseClass} bg-blue-50 text-blue-700 border-blue-100`}>
                                        {officer.category || officerBadge}
                                    </span>
                                    {/* Organization Name */}
                                    <h3 className="font-semibold text-strong break-words leading-snug">
                                        {officer.name}
                                    </h3>
                                    {/* Email */}
                                    {officer.email && (
                                        <p className="text-sm text-subtle break-words">
                                            {officer.email}
                                        </p>
                                    )}
                                    {/* Position/Acronym for list view */}
                                    {officer.position && viewMode === 'list' && (
                                        <p className="text-xs text-subtle break-words">
                                            {officer.position}
                                        </p>
                                    )}
                                </div>

                                {/* Right side: Contact buttons */}
                                <div className={`flex flex-wrap gap-2 ${viewMode === 'grid' ? 'mt-auto' : 'ml-0 sm:ml-4 shrink-0'} ${viewMode === 'list' ? 'self-start sm:self-auto' : ''}`}>
                                    {officer.email && (
                                        <a
                                            href={`mailto:${officer.email}`}
                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-soft bg-white text-sm text-subtle hover:text-brand hover:bg-gray-50 transition-colors"
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
                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-soft bg-white text-sm text-subtle hover:text-brand hover:bg-gray-50 transition-colors"
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
                                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-soft bg-white text-sm text-subtle hover:text-brand hover:bg-gray-50 transition-colors"
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
                                    className={`card p-6 flex ${viewMode === 'list' ? 'flex-row items-start sm:items-center gap-4 sm:gap-6' : 'flex-col'} content-visibility-auto`}
                                >
                                <div
                                    className={`${viewMode === 'list' ? 'w-12 h-12 mb-0 shrink-0' : 'w-16 h-16 mb-4'} rounded-full flex items-center justify-center text-white`}
                                    style={{ background: 'linear-gradient(135deg, var(--rtu-blue), var(--rtu-blue-light))' }}
                                >
                                    <Building2 size={22} />
                                </div>

                                <div className={`${viewMode === 'list' ? 'flex-1 min-w-0' : 'min-w-0'} space-y-1.5`}>
                                    <span className={`${directoryBadgeBaseClass} bg-amber-50 text-amber-700 border-amber-100`}>
                                        University Office
                                    </span>
                                    <h3 className="font-semibold text-strong break-words leading-snug">
                                        {office.officeName}
                                    </h3>

                                    {office.headDirector && (
                                        <p className="text-sm break-words" style={{ color: 'var(--accent-primary)' }}>
                                            Head/Director: {office.headDirector}
                                        </p>
                                    )}

                                    {office.branch && (
                                        <p className="text-xs text-subtle break-words">
                                            {office.branch}
                                        </p>
                                    )}

                                    <div className="space-y-1 text-sm text-subtle">
                                        {office.location && (
                                            <p className="flex items-center gap-2">
                                                <MapPin size={14} />
                                                <span>{office.location}</span>
                                            </p>
                                        )}
                                        {office.email && (
                                            <a
                                                href={`mailto:${office.email}`}
                                                className="flex items-center gap-2 no-underline text-subtle hover:text-brand transition-colors"
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
            </section >
        </>
    );
}
