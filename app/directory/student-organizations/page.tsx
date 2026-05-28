'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import Image from 'next/image';
import { Facebook, Mail, Search, Users } from 'lucide-react';
import BackLink from '@/components/BackLink';
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

type OrganizationEntry = {
    id?: string;
    name: string;
    position: string;
    branch: string;
    category?: string;
    email?: string;
    facebookUrl?: string;
    logoUrl?: string;
};

const ORGANIZATION_GROUP_ORDER = [
    'Supreme Student Council',
    'Central Student Council',
    'College / Institute Student Council',
    'Academic Organization',
    'Non-Academic Organization',
    'Other',
] as const;

async function fetchDirectoryPayload(url: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load');
    return res.json();
}

function getOrganizationGroup(entry: OrganizationEntry): string {
    const raw = entry.category || entry.branch || 'Other';
    const normalizedRaw = normalizeSearchToken(raw);
    if (
        normalizedRaw.includes('office_of_the_student_regent')
        || normalizedRaw.includes('office of the student regent')
        || normalizedRaw === 'osr'
    ) {
        return 'Supreme Student Council';
    }
    return normalizeGroupLabel(raw);
}

function buildOrganizationGroups(entries: OrganizationEntry[], query: string) {
    const normalizedQuery = normalizeSearchToken(query);
    const filteredEntries = entries.filter((entry) =>
        entryMatchesQuery(
            [entry.name, entry.position, entry.branch, entry.category, entry.email],
            normalizedQuery,
        ),
    );

    const buckets = new Map<string, OrganizationEntry[]>();
    for (const entry of filteredEntries) {
        const group = getOrganizationGroup(entry);
        const current = buckets.get(group) || [];
        current.push(entry);
        buckets.set(group, current);
    }

    const orderedGroups = [
        ...ORGANIZATION_GROUP_ORDER,
        ...Array.from(buckets.keys())
            .filter((group) => !ORGANIZATION_GROUP_ORDER.includes(group as (typeof ORGANIZATION_GROUP_ORDER)[number]))
            .sort(),
    ];

    return orderedGroups
        .map((group) => ({
            key: group,
            slug: slugifyGroupKey(group),
            title: group,
            count: buckets.get(group)?.length || 0,
            items: [...(buckets.get(group) || [])].sort((left, right) => left.name.localeCompare(right.name)),
        }))
        .filter((group) => group.count > 0);
}

function getGroupTone(groupKey: string): string {
    const normalized = normalizeSearchToken(groupKey);
    if (normalized.includes('supreme')) return 'gold';
    if (normalized.includes('central')) return 'sky';
    if (normalized.includes('college') || normalized.includes('institute')) return 'violet';
    if (normalized.includes('non_academic') || normalized.includes('non-academic')) return 'pink';
    if (normalized.includes('academic')) return 'green';
    return 'slate';
}

export default function StudentOrganizationsPage() {
    const { data, error, isLoading } = useSWR('/api/directory/student-organizations', fetchDirectoryPayload, DIRECTORY_SWR_OPTIONS);
    const [search, setSearch] = useState('');
    const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
    const [targetSlug, setTargetSlug] = useState<string | null>(null);
    const didHydrateHashRef = useRef(false);

    const leaders = useMemo(
        () => (Array.isArray(data?.leaders) ? (data.leaders as OrganizationEntry[]) : []),
        [data],
    );
    const groupedOrganizations = useMemo(() => buildOrganizationGroups(leaders, search), [leaders, search]);
    const normalizedSearch = useMemo(() => normalizeSearchToken(search), [search]);
    const hasActiveSearch = normalizedSearch.length > 0;
    const hashTargetSlug = useMemo(() => {
        const hashSlug = readGroupHash();
        if (!hashSlug) return null;
        return groupedOrganizations.some((group) => group.slug === hashSlug) ? hashSlug : null;
    }, [groupedOrganizations]);
    const defaultOpenSlug = useMemo(() => {
        if (hashTargetSlug) return hashTargetSlug;
        return groupedOrganizations[0]?.slug || null;
    }, [groupedOrganizations, hashTargetSlug]);
    const totalCount = leaders.length;
    const visibleCount = groupedOrganizations.reduce((sum, group) => sum + group.count, 0);

    // On first render with data, open either the hash-targeted group or the
    // first visible one so the page never appears empty.
    useEffect(() => {
        if (didHydrateHashRef.current) return;
        if (groupedOrganizations.length === 0) return;
        didHydrateHashRef.current = true;

        if (hashTargetSlug) {
            window.requestAnimationFrame(() => {
                document.getElementById(`group-${hashTargetSlug}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
            });
        }
    }, [groupedOrganizations, hashTargetSlug]);

    const handleJump = useCallback((slug: string) => {
        setOpenGroups((prev) => {
            const next = new Set(prev);
            next.add(slug);
            return next;
        });
        setTargetSlug(slug);
        writeGroupHash(slug);
        window.requestAnimationFrame(() => {
            document.getElementById(`group-${slug}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        });
    }, []);

    const handleToggle = useCallback((slug: string, open: boolean) => {
        setOpenGroups((prev) => {
            const next = new Set(prev);
            if (open) next.add(slug);
            else next.delete(slug);
            return next;
        });
        if (!open && targetSlug === slug) {
            setTargetSlug(null);
            writeGroupHash(null);
        }
    }, [targetSlug]);

    return (
        <section className="portal-section-slate relative overflow-hidden">
            <div className="portal-noise-overlay" aria-hidden="true" />

            <div className="relative z-10 pt-20 pb-16 md:pt-28 md:pb-20">
                <div className="container-main">
                    <BackLink href="/directory" label="Back to Directory" className="mb-8 text-slate-200 hover:text-white transition-colors" />

                    <div className="mx-auto max-w-5xl text-center">
                        <span className="portal-eyebrow inline-flex items-center gap-2 px-4 py-1.5 rounded-full shadow-sm mb-4">
                            <Users size={14} className="text-rtu-gold" /> Student Organizations
                        </span>
                        <h1 className="portal-title">Browse Student Organizations</h1>
                        <p className="portal-lead mt-5 mx-auto">
                            Recognized student-led bodies grouped by organizational family. Use the jump rail to move between councils, academic orgs, and non-academic orgs, or search by name, acronym, branch, or contact.
                        </p>
                        <p className="mt-4 text-sm text-slate-300">{totalCount} organizations currently listed.</p>
                    </div>

                    <div className="portal-panel mt-8 p-5 md:p-6">
                        <label className="directory-glass-field" htmlFor="organization-search">
                            <Search size={18} />
                            <input
                                id="organization-search"
                                value={search}
                                onChange={(event) => setSearch(event.target.value)}
                                placeholder="Search organizations, acronyms, branches, or emails"
                                aria-label="Search organizations"
                            />
                        </label>
                    </div>

                    {!isLoading && !error && groupedOrganizations.length > 1 && (
                        <nav className="directory-jump-rail" aria-label="Jump to organization category">
                            <span className="directory-jump-rail-label">Jump to</span>
                            {groupedOrganizations.map((group) => {
                                const isActive = openGroups.has(group.slug);
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
                        {isLoading && <div className="portal-panel-soft p-6 text-slate-300">Loading organizations…</div>}
                        {error && <div className="portal-notice portal-notice-red">Failed to load organizations</div>}

                        {!isLoading && !error && (
                            <div className="directory-accordion-list">
                                {groupedOrganizations.length === 0 ? (
                                    <div className="portal-panel-soft p-6 text-slate-300">
                                        No organizations matched your search.
                                    </div>
                                ) : (
                                    groupedOrganizations.map((group) => {
                                        const isOpen = hasActiveSearch
                                            || openGroups.has(group.slug)
                                            || (!hasActiveSearch && openGroups.size === 0 && defaultOpenSlug === group.slug);
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
                                                            {group.count} organization{group.count === 1 ? '' : 's'} in this section
                                                        </div>
                                                    </div>
                                                    <div className="directory-accordion-meta">
                                                        <span
                                                            className="directory-restored-chip directory-restored-chip--dot"
                                                            data-tone={getGroupTone(group.key)}
                                                            aria-hidden="true"
                                                        />
                                                    </div>
                                                </summary>

                                                <div className="directory-accordion-panel">
                                                    <div className="directory-entry-grid">
                                                        {group.items.map((organization) => {
                                                            const normalizedBranch = normalizeGroupLabel(organization.branch || '');
                                                            const branchIsDistinct =
                                                                organization.branch &&
                                                                normalizedBranch !== group.key &&
                                                                normalizeSearchToken(organization.branch) !== normalizeSearchToken(group.key);

                                                            return (
                                                                <article key={organization.id || organization.name} className="directory-entry-card">
                                                                    <div className="directory-entry-avatar">
                                                                        {organization.logoUrl ? (
                                                                            <Image
                                                                                src={organization.logoUrl}
                                                                                alt=""
                                                                                width={48}
                                                                                height={48}
                                                                                className="h-full w-full object-cover"
                                                                                unoptimized
                                                                            />
                                                                        ) : (
                                                                            <span>{getInitials(organization.name, 'OR')}</span>
                                                                        )}
                                                                    </div>

                                                                    <div className="min-w-0">
                                                                        <div className="directory-entry-title">{organization.name}</div>
                                                                        <div className="directory-entry-meta">
                                                                            {organization.position || 'Organization'}
                                                                        </div>
                                                                        {branchIsDistinct && (
                                                                            <span className="directory-entry-tag directory-entry-tag--muted">
                                                                                {organization.branch}
                                                                            </span>
                                                                        )}

                                                                        <div className="directory-entry-actions">
                                                                            {organization.email && (
                                                                                <a
                                                                                    href={`mailto:${organization.email}`}
                                                                                    className="directory-entry-chip directory-entry-chip--primary"
                                                                                >
                                                                                    <Mail size={15} className="directory-entry-chip-icon" />
                                                                                    <span>{organization.email}</span>
                                                                                </a>
                                                                            )}
                                                                            {organization.facebookUrl && (
                                                                                <a
                                                                                    href={organization.facebookUrl}
                                                                                    target="_blank"
                                                                                    rel="noreferrer"
                                                                                    className="directory-entry-chip"
                                                                                >
                                                                                    <Facebook size={15} className="directory-entry-chip-icon" />
                                                                                    <span>Facebook</span>
                                                                                </a>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </article>
                                                            );
                                                        })}
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
                        Showing {visibleCount} organization{visibleCount === 1 ? '' : 's'} across {groupedOrganizations.length} section{groupedOrganizations.length === 1 ? '' : 's'}.
                    </p>
                </div>
            </div>
        </section>
    );
}
