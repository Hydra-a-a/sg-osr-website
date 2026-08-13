'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import Image from 'next/image';
import { Building2, ChevronDown, Mail, MapPin, Search } from 'lucide-react';
import BackLink from '@/components/BackLink';
import { SectionPlaceholderIcon } from '@/components/SectionPlaceholderIcon';
import {
    entryMatchesQuery,
    getInitials,
    normalizeGroupLabel,
    normalizeSearchToken,
    readGroupHash,
    slugifyGroupKey,
    writeGroupHash,
} from '@/lib/directory-ui';

const DIRECTORY_SWR_OPTIONS = {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000,
} as const;

type OfficeEntry = {
    id?: string;
    officeName: string;
    location?: string;
    headDirector?: string;
    email?: string;
    branch?: string;
    logoUrl?: string;
};

async function fetchDirectoryPayload(url: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load');
    return res.json();
}

type UniversityOfficesPayload = {
    offices: OfficeEntry[];
    meta?: {
        total?: number;
        valid?: number;
        invalid?: number;
        officeSheetUnavailable?: boolean;
        source?: string;
    };
};

function getOfficeGroup(entry: OfficeEntry): string {
    const rawBranch = entry.branch || 'University Offices';
    const normalizedBranch = normalizeSearchToken(rawBranch);
    const normalizedOfficeName = normalizeSearchToken(entry.officeName || '');
    if (
        normalizedBranch.includes('office_of_the_student_regent')
        || normalizedBranch.includes('office of the student regent')
        || normalizedBranch === 'osr'
        || normalizedOfficeName.includes('office_of_the_student_regent')
        || normalizedOfficeName.includes('office of the student regent')
        || normalizedOfficeName === 'osr'
    ) {
        return 'Supreme Student Council';
    }
    return normalizeGroupLabel(rawBranch);
}

function buildOfficeGroups(entries: OfficeEntry[], query: string) {
    const normalizedQuery = normalizeSearchToken(query);
    const filteredEntries = entries.filter((entry) =>
        entryMatchesQuery(
            [entry.officeName, entry.headDirector, entry.location, entry.branch, entry.email],
            normalizedQuery,
        ),
    );

    const buckets = new Map<string, OfficeEntry[]>();
    for (const entry of filteredEntries) {
        const group = getOfficeGroup(entry);
        const current = buckets.get(group) || [];
        current.push(entry);
        buckets.set(group, current);
    }

    const groupNames = Array.from(buckets.keys()).sort((left, right) => {
        const priority = (value: string) => {
            if (value.includes('President')) return 0;
            if (value.includes('Vice President')) return 1;
            if (value.includes('Chancellor')) return 2;
            return 10;
        };

        return priority(left) - priority(right) || left.localeCompare(right);
    });

    return groupNames.map((group) => ({
        key: group,
        slug: slugifyGroupKey(group),
        title: group,
        count: buckets.get(group)?.length || 0,
        items: [...(buckets.get(group) || [])].sort((left, right) => left.officeName.localeCompare(right.officeName)),
    }));
}

function getGroupTone(groupKey: string): string {
    const normalized = normalizeSearchToken(groupKey);
    if (normalized.includes('president')) return 'gold';
    if (normalized.includes('vice_president') || normalized.includes('vice president')) return 'sky';
    if (normalized.includes('chancellor')) return 'violet';
    if (normalized.includes('supreme')) return 'green';
    return 'slate';
}

export default function UniversityOfficesPage({ initialData }: { initialData?: UniversityOfficesPayload }) {
    const { data, error, isLoading } = useSWR<UniversityOfficesPayload>(
        '/api/directory/offices',
        fetchDirectoryPayload,
        { ...DIRECTORY_SWR_OPTIONS, fallbackData: initialData },
    );
    const [search, setSearch] = useState('');
    const [openGroups, setOpenGroups] = useState<Set<string> | null>(null);
    const [targetSlug, setTargetSlug] = useState<string | null>(null);
    const didHydrateHashRef = useRef(false);

    const offices = useMemo(
        () => (Array.isArray(data?.offices) ? (data.offices as OfficeEntry[]) : []),
        [data],
    );
    const groupedOffices = useMemo(() => buildOfficeGroups(offices, search), [offices, search]);
    const normalizedSearch = useMemo(() => normalizeSearchToken(search), [search]);
    const hasActiveSearch = normalizedSearch.length > 0;
    const hashTargetSlug = useMemo(() => {
        const hashSlug = readGroupHash();
        if (!hashSlug) return null;
        return groupedOffices.some((group) => group.slug === hashSlug) ? hashSlug : null;
    }, [groupedOffices]);
    const defaultOpenSlug = useMemo(() => {
        if (hashTargetSlug) return hashTargetSlug;
        return groupedOffices[0]?.slug || null;
    }, [groupedOffices, hashTargetSlug]);
    const totalCount = offices.length;
    const visibleCount = groupedOffices.reduce((sum, group) => sum + group.count, 0);

    useEffect(() => {
        if (didHydrateHashRef.current) return;
        if (groupedOffices.length === 0) return;
        didHydrateHashRef.current = true;

        if (hashTargetSlug) {
            window.requestAnimationFrame(() => {
                document.getElementById(`group-${hashTargetSlug}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
            });
        }
    }, [groupedOffices, hashTargetSlug]);

    const handleJump = useCallback((slug: string) => {
        setOpenGroups((prev) => {
            const next = new Set(prev ?? (defaultOpenSlug ? [defaultOpenSlug] : []));
            next.add(slug);
            return next;
        });
        setTargetSlug(slug);
        writeGroupHash(slug);
        window.requestAnimationFrame(() => {
            document.getElementById(`group-${slug}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        });
    }, [defaultOpenSlug]);

    const handleToggle = useCallback((slug: string, open: boolean) => {
        setOpenGroups((prev) => {
            const next = new Set(prev ?? (defaultOpenSlug ? [defaultOpenSlug] : []));
            if (open) next.add(slug);
            else next.delete(slug);
            return next;
        });
        if (!open && targetSlug === slug) {
            setTargetSlug(null);
            writeGroupHash(null);
        }
    }, [defaultOpenSlug, targetSlug]);

    return (
        <section className="university-offices-page directory-detail-page portal-section-slate relative overflow-hidden">
            <div className="portal-noise-overlay" aria-hidden="true" />

            <div className="relative z-10 pt-20 pb-16 md:pt-28 md:pb-20">
                <div className="container-main">
                    <BackLink href="/directory" label="Back to Directory" className="mb-8 text-slate-200 hover:text-white transition-colors" />

                    <div className="mx-auto max-w-5xl text-center">
                        <span className="directory-page-kicker">
                            <Building2 size={14} className="text-rtu-gold" /> University Offices
                        </span>
                        <h1 className="portal-title">Browse University Offices</h1>
                        <p className="portal-lead mx-auto mt-5 max-w-3xl">
                            Administrative offices grouped by reporting branch. Use the jump rail to move between the President&apos;s office, Vice Presidents, and supporting units, or search by office, director, or location.
                        </p>
                        <p className="mt-5 text-sm text-slate-300">{totalCount} offices currently listed.</p>
                    </div>

                    <div className="directory-detail-search mx-auto mt-10 max-w-3xl">
                        <label className="directory-glass-field" htmlFor="office-search">
                            <Search size={18} />
                            <input
                                id="office-search"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search offices, directors, locations, or branches"
                                aria-label="Search university offices"
                            />
                        </label>
                    </div>

                    {!isLoading && !error && groupedOffices.length > 1 && (
                        <nav className="directory-jump-rail" aria-label="Jump to office branch">
                            <span className="directory-jump-rail-label">Jump to</span>
                            {groupedOffices.map((group) => {
                                const isActive = openGroups === null
                                    ? defaultOpenSlug === group.slug
                                    : openGroups.has(group.slug);
                                return (
                                    <button
                                        key={group.slug}
                                        type="button"
                                        onClick={() => handleJump(group.slug)}
                                        className={`directory-jump-chip${isActive ? ' directory-jump-chip--active' : ''}`}
                                        aria-pressed={isActive}
                                        data-tone={getGroupTone(group.key)}
                                    >
                                        <span>{group.title}</span>
                                    </button>
                                );
                            })}
                        </nav>
                    )}

                    <div className="mt-6">
                        {isLoading && <div className="directory-state-line text-slate-300">Loading offices...</div>}
                        {error && <div className="directory-state-line directory-state-line-error">Failed to load offices</div>}

                        {!isLoading && !error && (
                            <div className="directory-accordion-list">
                                {groupedOffices.length === 0 ? (
                                    <div className="directory-state-line text-slate-300">
                                        No offices matched your search.
                                    </div>
                                ) : (
                                    groupedOffices.map((group) => {
                                        const isOpen = hasActiveSearch || (
                                            openGroups === null
                                                ? defaultOpenSlug === group.slug
                                                : openGroups.has(group.slug)
                                        );
                                        const isTarget = targetSlug === group.slug;
                                        return (
                                            <details
                                                key={group.slug}
                                                id={`group-${group.slug}`}
                                                className={`directory-accordion-item${isTarget ? ' directory-accordion-item--target' : ''}`}
                                                open={isOpen}
                                                onToggle={(event) => handleToggle(group.slug, (event.currentTarget as HTMLDetailsElement).open)}
                                            >
                                                <summary className="directory-accordion-summary">
                                                    <div className="directory-accordion-summary-copy">
                                                        <div className="directory-accordion-title">{group.title}</div>
                                                        <div className="directory-accordion-subtitle">
                                                            {group.count} office{group.count === 1 ? '' : 's'} in this section
                                                        </div>
                                                    </div>
                                                    <div className="directory-accordion-meta">
                                                        <ChevronDown className="directory-accordion-chevron" size={20} aria-hidden="true" />
                                                    </div>
                                                </summary>

                                                <div className="directory-accordion-panel">
                                                    <div className="directory-entry-grid">
                                                        {group.items.map((office) => (
                                                            <article key={office.id || office.officeName} className="directory-entry-card">
                                                                <div className="directory-entry-avatar">
                                                                    {office.logoUrl ? (
                                                                        <Image
                                                                            src={office.logoUrl}
                                                                            alt=""
                                                                            width={48}
                                                                            height={48}
                                                                            sizes="48px"
                                                                            className="h-full w-full object-cover"
                                                                        />
                                                                    ) : (
                                                                        <div className="flex h-full w-full items-center justify-center text-slate-300">
                                                                            <SectionPlaceholderIcon
                                                                                section="university-office"
                                                                                name={office.officeName}
                                                                                size={22}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className="min-w-0">
                                                                    <div className="directory-entry-title">{office.officeName}</div>
                                                                    <div className="directory-entry-meta">
                                                                        {office.headDirector || 'Office contact'}
                                                                    </div>
                                                                    {office.location && (
                                                                        <div className="directory-entry-excerpt inline-flex items-center gap-2">
                                                                            <MapPin size={14} />
                                                                            <span>{office.location}</span>
                                                                        </div>
                                                                    )}

                                                                    <div className="directory-entry-actions">
                                                                        {office.email && (
                                                                            <a
                                                                                href={`mailto:${office.email}`}
                                                                                className="directory-entry-chip directory-entry-chip--primary"
                                                                            >
                                                                                <Mail size={15} className="directory-entry-chip-icon" />
                                                                                <span>{office.email}</span>
                                                                            </a>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </article>
                                                        ))}
                                                    </div>
                                                </div>
                                            </details>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>

                    <p className="mt-6 text-slate-400 text-sm">
                        Showing {visibleCount} office{visibleCount === 1 ? '' : 's'} across {groupedOffices.length} section{groupedOffices.length === 1 ? '' : 's'}.
                    </p>
                </div>
            </div>
        </section>
    );
}
