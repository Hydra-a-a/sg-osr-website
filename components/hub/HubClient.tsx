
'use client';

import dynamic from 'next/dynamic';
import { useState, useCallback, useMemo, useSyncExternalStore } from 'react';
import {
    ArrowRight,
    BookOpen,
    Bus,
    Calendar,
    ChevronDown,
    Download,
    ExternalLink,
    Lock,
    MapPin,
    Search,
} from 'lucide-react';
import Image from 'next/image';
import { NoncedStyle } from '@/components/CspNonceProvider';
import { useSession } from 'next-auth/react';
import { getAccessVisibilityState } from '@/lib/access-visibility';
import { HUB_GUIDE_CATEGORIES } from '@/lib/hub-guide-categories';
import { PORTAL_MODE_COOKIE } from '@/lib/portal-mode';

export type HubGuide = {
    id: string;
    title: string;
    description: string;
    category: string;
    source: 'drive' | 'direct';
    embedUrl: string;
    viewUrl: string;
    downloadUrl: string;
    canEmbed: boolean;
    mimeType: 'application/pdf';
    sortOrder: number;
};

type DashboardAction = {
    id: string;
    title: string;
    summary: string;
    icon: typeof BookOpen;
    accentClassName: string;
    onClick: () => void;
    badge: string;
    isLocked?: boolean;
};

export type LockedFeatureNotice = {
    title: string;
    summary: string;
    detail: string;
};

const HubOverlays = dynamic(() => import('./HubOverlays'), { ssr: false });

function getDriveGuideIdentifiers(guide: HubGuide): { fileId: string; resourceKey: string } {
    if (guide.source !== 'drive') {
        return { fileId: '', resourceKey: '' };
    }

    const extractFileId = (urlValue: string): string => {
        if (!urlValue) {
            return '';
        }

        try {
            const absoluteUrl = urlValue.startsWith('/') ? `https://rtu.local${urlValue}` : urlValue;
            const parsed = new URL(absoluteUrl);
            const pathMatch = parsed.pathname.match(/\/d\/([a-zA-Z0-9_-]{10,})/);
            if (pathMatch?.[1]) {
                return pathMatch[1];
            }

            const idParam = parsed.searchParams.get('id') || '';
            if (/^[a-zA-Z0-9_-]{10,}$/.test(idParam)) {
                return idParam;
            }

            return '';
        } catch {
            return '';
        }
    };

    const fileId = extractFileId(guide.viewUrl) || extractFileId(guide.embedUrl);
    if (!fileId) {
        return { fileId: '', resourceKey: '' };
    }


    let resourceKey = '';
    try {
        const parsed = new URL(guide.viewUrl);
        resourceKey = parsed.searchParams.get('resourcekey') || '';
    } catch {
        try {
            const absoluteUrl = guide.embedUrl.startsWith('/') ? `https://rtu.local${guide.embedUrl}` : guide.embedUrl;
            const parsedEmbed = new URL(absoluteUrl);
            resourceKey = parsedEmbed.searchParams.get('resourcekey') || '';
        } catch {
            resourceKey = '';
        }
    }

    return { fileId, resourceKey };
}

function getDrivePreviewProxyUrl(guide: HubGuide): string {
    const { fileId, resourceKey } = getDriveGuideIdentifiers(guide);
    if (!fileId) {
        return '';
    }

    const encodedId = encodeURIComponent(fileId);
    if (resourceKey) {
        return `/api/hub/guides/preview/${encodedId}?resourcekey=${encodeURIComponent(resourceKey)}`;
    }

    return `/api/hub/guides/preview/${encodedId}`;
}

function shouldBypassPdfHashControls(urlValue: string): boolean {
    return /^https:\/\/drive\.google\.com\/file\/d\/.+\/preview/i.test((urlValue || '').trim());
}

function buildGuidePreviewUrl(urlValue: string): string {
    const sanitizedUrl = (urlValue || '').trim();
    if (!sanitizedUrl) {
        return '';
    }

    const [base, hash = ''] = sanitizedUrl.split('#', 2);
    const baseParams = hash
        .split('&')
        .map((part) => part.trim())
        .filter(Boolean)
        .filter((part) => !part.startsWith('toolbar=') && !part.startsWith('navpanes=') && !part.startsWith('scrollbar='));

    baseParams.push('toolbar=0', 'navpanes=0', 'scrollbar=1');
    return `${base}#${baseParams.join('&')}`;
}

function guideLooksLeaderOnly(guide: HubGuide): boolean {
    const source = `${guide.title} ${guide.description} ${guide.category}`.toLowerCase();
    return (
        source.includes('student leader')
        || source.includes('leader')
        || source.includes('officer')
        || source.includes('council memo')
        || source.includes('committee')
        || source.includes('internal')
    );
}

function getPortalModeCookie(): string {
    if (typeof document === 'undefined') return '';
    return document.cookie
        .split('; ')
        .find((row) => row.startsWith(`${PORTAL_MODE_COOKIE}=`))
        ?.split('=')[1] ?? '';
}

function subscribeNoop(): () => void {
    return () => {};
}

export default function HubClient({ initialGuides = [] }: { initialGuides?: HubGuide[] }) {
    const { data: session } = useSession();
    const portalMode = useSyncExternalStore(subscribeNoop, getPortalModeCookie, () => '');
    const visibility = getAccessVisibilityState(session?.user?.role, portalMode, '');
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lockedFeatureNotice, setLockedFeatureNotice] = useState<LockedFeatureNotice | null>(null);
    const [selectedGuideId, setSelectedGuideId] = useState('');
    const [guideSearch, setGuideSearch] = useState('');
    const [guideCategory, setGuideCategory] = useState('');
    const guidesResponse = { data: initialGuides };
    const guidesError = null;
    const guidesLoading = false;
    const [guidePreviewOpen, setGuidePreviewOpen] = useState(false);

    const guides = useMemo(() => {
        const allGuides = guidesResponse?.data || [];
        if (visibility.canSeeLeaderFeatures) {
            return allGuides;
        }
        return allGuides.filter((guide) => !guideLooksLeaderOnly(guide));
    }, [guidesResponse?.data, visibility.canSeeLeaderFeatures]);
    const filteredGuides = useMemo(() => {
        const query = guideSearch.trim().toLowerCase();
        return guides.filter((guide) => {
            if (guideCategory && guide.category !== guideCategory) return false;
            return !query || `${guide.title} ${guide.description} ${guide.category}`.toLowerCase().includes(query);
        });
    }, [guideCategory, guideSearch, guides]);

    const {
        resolvedSelectedGuideId,
        selectedGuide,
        selectedGuidePreviewUrl,
        shouldAttemptGuideEmbed,
    } = useMemo(() => {
        const fallbackGuideId = filteredGuides[0]?.id || '';
        const resolvedGuideId = filteredGuides.some((guide) => guide.id === selectedGuideId)
            ? selectedGuideId
            : fallbackGuideId;
        const activeGuide = filteredGuides.find((guide) => guide.id === resolvedGuideId) || null;

        const selectedGuideEmbedUrl = activeGuide
            ? (
                activeGuide.source === 'drive'
                    ? (getDrivePreviewProxyUrl(activeGuide) || activeGuide.embedUrl)
                    : activeGuide.embedUrl
            )
            : '';

        const previewUrl = shouldBypassPdfHashControls(selectedGuideEmbedUrl)
            ? selectedGuideEmbedUrl
            : buildGuidePreviewUrl(selectedGuideEmbedUrl);

        const canAttemptEmbed = activeGuide
            ? (activeGuide.source === 'drive' ? Boolean(selectedGuideEmbedUrl) : activeGuide.canEmbed)
            : false;

        return {
            resolvedSelectedGuideId: resolvedGuideId,
            selectedGuide: activeGuide,
            selectedGuidePreviewUrl: previewUrl,
            shouldAttemptGuideEmbed: canAttemptEmbed,
        };
    }, [filteredGuides, selectedGuideId]);

    const scrollToSection = useCallback((sectionId: string) => {
        if (typeof window === 'undefined') {
            return;

        }

        const section = document.getElementById(sectionId);
        section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    const openLightbox = useCallback(() => {
        setLightboxOpen(true);
    }, []);

    const closeLightbox = useCallback(() => setLightboxOpen(false), []);
    const openLockedFeatureNotice = useCallback((notice: LockedFeatureNotice) => {
        setLockedFeatureNotice(notice);
    }, []);
    const closeLockedFeatureNotice = useCallback(() => setLockedFeatureNotice(null), []);

    const quickActions = useMemo<DashboardAction[]>(() => ([
        {
            id: 'guides',
            title: 'Open guides',
            summary: 'Access the document list and preview area.',
            icon: BookOpen,
            accentClassName: 'hub-accent-gold',
            onClick: () => scrollToSection('student-guides'),
            badge: `${guides.length} guides`,
        },
        {
            id: 'calendar',
            title: 'View calendar',
            summary: 'Review the academic calendar and open the full view.',
            icon: Calendar,
            accentClassName: 'hub-accent-sky',
            onClick: () => scrollToSection('academic-calendar'),
            badge: 'SY 2026-2027',
        },
        {
            id: 'maps',
            title: 'Plan your commute',
            summary: 'Find the best transit routes and fare estimates.',
            icon: MapPin,
            accentClassName: 'hub-accent-slate',
            onClick: () => {
                window.location.href = '/hub/commute';
            },
            badge: 'New',
        },
        {
            id: 'lost-found',
            title: 'Lost and found',
            summary: 'Check the CSO bulletin and student reports awaiting review.',
            icon: Search,
            accentClassName: 'hub-accent-gold',
            onClick: () => {
                window.location.href = '/hub/lost-found';
            },
            badge: '',
        },
        {
            id: 'campus-wayfinding',
            title: 'Campus wayfinding',
            summary: 'Temporary office relocations make a live campus map unreliable right now.',
            icon: MapPin,
            accentClassName: 'hub-accent-slate',
            onClick: () => openLockedFeatureNotice({
                title: 'Campus wayfinding is temporarily unavailable',
                summary: 'Campus offices and student-facing service points are moving too frequently for a reliable live map right now.',
                detail: 'Ongoing renovation and construction work has relocated multiple offices into temporary spaces. To avoid publishing directions that could quickly become wrong, this hub feature is staying locked until the campus layout stabilizes.',
            }),
            isLocked: true,
            badge: 'Temporarily locked',

        },
    ]), [guides.length, openLockedFeatureNotice, scrollToSection]);

    return (

        <div className="hub-shell relative overflow-hidden">
            <div className="hub-noise" aria-hidden="true" />
            <section className="relative z-10 pt-20 pb-8 md:pt-28 md:pb-10">
                <div className="container-main mx-auto w-full max-w-7xl">
                    <div className="hub-masthead p-6 md:p-8">
                        <Image
                            src="/images/BONI_AVE.jpg"
                            alt=""
                            fill
                            priority
                            quality={70}
                            sizes="(max-width: 1280px) calc(100vw - 2rem), 1280px"
                            className="hub-masthead-image"
                        />
                        <div className="hub-hero-layout">
                            <div className="hub-hero-copy">
                                <h1 className="hub-display w-full text-white">
                                Academic Resource <span className="hub-display-accent">Dashboard</span>
                            </h1>
                                <p className="hub-lead mt-5 max-w-2xl text-slate-200">
                                Access official student references, published guides, and the academic calendar from one page.
                            </p>
                                <p className="hub-academic-year mt-7">Academic Year 2026 - 2027</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="relative z-10 pb-8 md:pb-10">
                <div className="container-main mx-auto w-full max-w-7xl">
                    <div className="hub-command-band p-6 md:p-7">
                        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
                            <div>
                                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Quick Access</p>
                                <h2 className="mt-2 text-2xl font-semibold text-white">Primary Sections</h2>
                            </div>
                            <p className="max-w-xl text-sm leading-relaxed text-slate-300">
                                Open the main hub sections directly from the dashboard.
                            </p>
                        </div>

                        <div className="hub-actions-grid grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            {quickActions.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={item.onClick}
                                    className={`hub-shortcut-card text-left ${item.isLocked ? 'hub-shortcut-card-disabled hub-shortcut-card-locked' : ''}`}
                                >
                                    <div className={`hub-shortcut-icon ${item.accentClassName}`}>
                                        <item.icon size={20} />
                                    </div>
                                    <div className="hub-shortcut-body mt-5 flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-white">{item.title}</p>
                                            <p className="mt-2 text-sm leading-relaxed text-slate-300">{item.summary}</p>
                                        </div>
                                        {item.isLocked ? <Lock size={16} className="text-slate-400 shrink-0 mt-1" /> : <ArrowRight size={16} className="text-amber-200 shrink-0 mt-1" />}
                                    </div>
                                    <div className="hub-shortcut-meta mt-5">
                                        <span className="hub-shortcut-badge">{item.badge}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section id="student-guides" className="relative z-10 pb-8 md:pb-10 scroll-mt-24">
                <div className="container-main mx-auto w-full max-w-7xl">
                    <div className="hub-reading-room p-6 md:p-7">
                        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
                            <div>
                                <h2 className="text-2xl font-semibold text-white">Document Library</h2>
                            </div>
                        </div>

                        {guidesLoading ? (
                            <div className="hub-empty-state">Loading documents...</div>
                        ) : guidesError ? (
                            <div className="hub-empty-state border-red-400/20 bg-red-500/10 text-red-100">
                                {guidesError instanceof Error ? guidesError.message : 'Unable to load student guides at this time.'}
                            </div>
                        ) : guides.length === 0 ? (
                            <div className="hub-empty-state">
                                No documents are available yet.
                            </div>
                        ) : (
                            <>
                                <div className="mb-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_15rem_auto]">
                                    <label className="relative block">
                                        <span className="sr-only">Search the document library</span>
                                        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                                        <input value={guideSearch} onChange={(event) => setGuideSearch(event.target.value)} type="search" placeholder="Search documents" className="min-h-11 w-full border border-white/10 bg-black/10 py-2.5 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-200/50" />
                                    </label>
                                    <label className="relative block">
                                        <span className="sr-only">Filter documents by category</span>
                                        <select value={guideCategory} onChange={(event) => setGuideCategory(event.target.value)} className="min-h-11 w-full appearance-none border border-white/10 bg-black/10 px-3 py-2.5 pr-10 text-sm text-white outline-none [color-scheme:dark] focus:border-amber-200/50 [&>option]:bg-slate-950 [&>option]:text-white">
                                            <option value="">All categories</option>
                                            {HUB_GUIDE_CATEGORIES.map((category) => <option key={category} value={category}>{category}</option>)}
                                        </select>
                                        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" aria-hidden="true" />
                                    </label>
                                    <button type="button" onClick={() => { setGuideSearch(''); setGuideCategory(''); }} disabled={!guideSearch && !guideCategory} className="min-h-11 border border-white/10 px-3 text-sm font-semibold text-slate-200 hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40">Clear</button>
                                </div>

                                <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
                                <div className="hub-guides-sidebar">
                                    <p className="mb-4 text-xs text-slate-400">{filteredGuides.length === guides.length ? `${guides.length} documents` : `${filteredGuides.length} of ${guides.length} documents`}</p>
                                    {filteredGuides.length === 0 ? <div className="hub-empty-state">No matching documents.</div> : <div className="space-y-2">
                                        {filteredGuides.map((guide) => {
                                            const isSelected = guide.id === resolvedSelectedGuideId;
                                            return (
                                                <button
                                                    key={guide.id}
                                                    type="button"
                                                    onClick={() => { setSelectedGuideId(guide.id); setGuidePreviewOpen(false); }}
                                                    className={`hub-guide-list-item ${isSelected ? 'hub-guide-list-item-active' : ''}`}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-semibold text-white break-words">{guide.title}</p>
                                                            {guide.description ? (
                                                                <p className="mt-1 text-xs leading-relaxed text-slate-400">{guide.description}</p>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>}
                                </div>

                                {selectedGuide ? (
                                    <div className="hub-guide-preview-shell">
                                        <div className="hub-guide-preview-header">
                                            <div>
                                                <h3 className="text-2xl font-semibold text-white">{selectedGuide.title}</h3>
                                                {selectedGuide.description ? (

                                                    <p className="mt-2 text-sm leading-relaxed text-slate-300">{selectedGuide.description}</p>
                                                ) : null}
                                            </div>

                                            <div className="flex flex-wrap gap-2">
                                                <a
                                                    href={selectedGuide.viewUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="hub-action-secondary"
                                                >
                                                    <ExternalLink size={15} />
                                                    Open in new tab
                                                </a>
                                                <a
                                                    href={selectedGuide.downloadUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="hub-action-primary"
                                                >
                                                    <Download size={15} />
                                                    Download PDF
                                                </a>
                                            </div>
                                        </div>

                                        <div className={`hub-preview-frame pdf-embed-shell ${guidePreviewOpen ? 'min-h-[46rem]' : 'min-h-[18rem]'}`}>
                                            {shouldAttemptGuideEmbed && guidePreviewOpen ? (
                                                <iframe
                                                    title={`${selectedGuide.title} PDF Preview`}
                                                    src={selectedGuidePreviewUrl}
                                                    className="h-[46rem]"
                                                    loading="lazy"
                                                    referrerPolicy="strict-origin-when-cross-origin"
                                                />
                                            ) : (
                                                <div className={`${guidePreviewOpen ? 'h-[46rem]' : 'h-[18rem]'} flex flex-col items-center justify-center text-center p-8 bg-slate-900/60`}>
                                                    {!guidePreviewOpen && shouldAttemptGuideEmbed ? (
                                                        <button type="button" onClick={() => setGuidePreviewOpen(true)} className="hub-action-primary">
                                                            <Search size={15} />
                                                            Load preview
                                                        </button>
                                                    ) : <p className="text-sm font-semibold text-white">Preview unavailable</p>}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                            </>
                        )}
                    </div>
                </div>
            </section>

            <section id="academic-calendar" className="relative z-10 pb-14 md:pb-16 scroll-mt-24">
                <div className="container-main mx-auto w-full max-w-7xl">
                    <div className="hub-calendar-feature p-6 md:p-7">
                        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
                            <div>
                                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Academic Calendar</p>
                                <h2 className="mt-2 text-2xl font-semibold text-white">Calendar Overview</h2>
                            </div>
                            <p className="max-w-xl text-sm leading-relaxed text-slate-300">
                                Review the current academic calendar and open the expanded view when needed.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={openLightbox}
                            className="hub-calendar-card group"
                        >
                            <div className="hub-calendar-overlay">
                                <div className="hub-calendar-overlay-icon">
                                    <Search className="text-white" size={24} />
                                </div>
                                <p className="mt-3 text-sm font-semibold text-white">Open calendar</p>
                            </div>
                            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-white/10">
                                <div>
                                    <p className="text-sm font-semibold text-white">Academic Calendar</p>
                                    <p className="text-xs text-slate-400 mt-1">School Year 2026-2027</p>
                                </div>
                                <span className="hub-mini-chip">Interactive lightbox</span>
                            </div>
                            <div className="relative w-full aspect-[1/1.4] md:aspect-[16/10] bg-white">
                                <Image
                                    src="/images/ACADEMIC_CALENDAR_2026_2027.jpg"
                                    alt="Academic Calendar 2026-2027"
                                    fill
                                    sizes="(max-width: 768px) 100vw, (max-width: 1280px) 90vw, 1024px"
                                    className="object-contain"
                                />
                            </div>
                        </button>

                    </div>
                </div>
            </section>

            {(lockedFeatureNotice || lightboxOpen) ? (
                <HubOverlays
                    lockedFeatureNotice={lockedFeatureNotice}
                    closeLockedFeatureNotice={closeLockedFeatureNotice}
                    lightboxOpen={lightboxOpen}
                    closeLightbox={closeLightbox}
                />
            ) : null}
            <NoncedStyle css={`
                .hub-shell {
                    min-height: 100vh;
                    background:
                        radial-gradient(88% 96% at 10% 10%, rgba(244, 192, 82, 0.16) 0%, rgba(244, 192, 82, 0) 48%),
                        radial-gradient(108% 118% at 92% 12%, rgba(94, 184, 255, 0.16) 0%, rgba(94, 184, 255, 0) 52%),
                        linear-gradient(135deg, #0c2239 0%, #12314f 45%, #173b5e 100%);
                    color: #e2e8f0;
                }

                .hub-shell::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(circle at top, rgba(255, 255, 255, 0.03) 0%, transparent 100%);
                    pointer-events: none;
                    z-index: 1;
                }

                .hub-noise {
                    position: absolute;
                    inset: 0;
                    background-image: radial-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px);
                    background-size: 28px 28px;
                    opacity: 0.18;
                    mask-image: linear-gradient(to bottom, black 55%, transparent 100%);
                    pointer-events: none;
                    z-index: 2;
                }

                .hub-masthead,
                .hub-command-band,
                .hub-reading-room,
                .hub-calendar-feature {
                    position: relative;
                    border-top: 1px solid rgba(255, 255, 255, 0.14);
                }

                .hub-masthead {
                    overflow: hidden;
                    border-radius: 0.9rem;
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    background:
                        linear-gradient(90deg, rgba(8, 20, 36, 0.86) 0%, rgba(8, 20, 36, 0.58) 58%, rgba(8, 20, 36, 0.72) 100%),
                        linear-gradient(145deg, rgba(16, 34, 55, 0.8), rgba(10, 22, 36, 0.62));
                    box-shadow: 0 24px 58px rgba(4, 10, 22, 0.3);
                    clip-path: polygon(0 0, calc(100% - 18px) 0, 100% 18px, 100% 100%, 0 100%);
                }

                .hub-masthead::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background:
                        radial-gradient(70% 90% at 0% 0%, rgba(245, 158, 11, 0.13) 0%, transparent 72%),
                        radial-gradient(90% 95% at 100% 100%, rgba(56, 189, 248, 0.13) 0%, transparent 66%);
                    pointer-events: none;
                    z-index: 1;
                }

                .hub-masthead-image {
                    z-index: 0;
                    object-fit: cover;
                    object-position: center 46%;
                }

                .hub-command-band,
                .hub-reading-room,
                .hub-calendar-feature {
                    padding-top: 1.75rem;
                }

                .hub-command-band {
                    border-top-color: rgba(245, 158, 11, 0.3);
                }

                .hub-reading-room {
                    border-top-color: rgba(255, 255, 255, 0.16);
                }

                .hub-calendar-feature {
                    border-top-color: rgba(251, 191, 36, 0.28);
                }

                .hub-hero-layout {
                    position: relative;
                    z-index: 2;
                }

                .hub-hero-copy {
                    max-width: 58rem;
                }

                .hub-display {
                    font-size: clamp(2.5rem, 5vw, 4.5rem);
                    line-height: 1.04;
                    font-weight: 700;
                    text-wrap: balance;
                    filter: drop-shadow(0 2px 2px rgba(3, 10, 20, 0.78)) drop-shadow(0 8px 16px rgba(3, 10, 20, 0.46));
                }

                .hub-display-accent {
                    color: transparent;
                    background: linear-gradient(135deg, #fde68a 0%, #f59e0b 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .hub-lead {
                    font-size: clamp(1rem, 1.1vw + 0.5rem, 1.12rem);
                    line-height: 1.75;
                    text-shadow: 0 1px 3px rgba(3, 10, 20, 0.82), 0 5px 12px rgba(3, 10, 20, 0.46);
                }

                .hub-academic-year {
                    color: #fde68a;
                    font-size: 0.95rem;
                    font-weight: 600;
                    text-shadow: 0 1px 3px rgba(3, 10, 20, 0.84), 0 4px 10px rgba(3, 10, 20, 0.44);
                }

                .hub-shortcut-card {
                    position: relative;
                    overflow: hidden;
                    border-radius: 0.75rem;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    background: rgba(6, 16, 28, 0.2);
                    padding: 1.4rem;
                    transition: transform 0.18s ease, border-color 0.18s ease, background-color 0.18s ease;
                    backface-visibility: hidden;
                    contain: layout style paint;
                    clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%);
                }

                .hub-shortcut-card::after {
                    content: '';
                    position: absolute;
                    left: 0.75rem;
                    bottom: 0.6rem;
                    width: 2.25rem;
                    height: 1.05rem;
                    background:
                        linear-gradient(130deg, rgba(214, 238, 255, 0.14), rgba(214, 238, 255, 0.02)),
                        repeating-linear-gradient(135deg, rgba(214, 238, 255, 0.11) 0 1px, transparent 1px 5px);
                    clip-path: polygon(0 20%, 100% 0, 84% 100%, 0 100%);
                    opacity: 0.42;
                    z-index: 0;
                    pointer-events: none;
                }

                .hub-shortcut-card > * {
                    position: relative;
                    z-index: 1;
                }

                .hub-shortcut-card:hover {
                    transform: translateY(-1px);
                    border-color: rgba(244, 192, 82, 0.28);
                }

                .hub-actions-grid .hub-shortcut-card {
                    min-height: 100%;
                    display: flex;
                    flex-direction: column;
                }

                .hub-shortcut-body {
                    flex: 1 1 auto;
                }

                .hub-shortcut-meta {

                    margin-top: auto;
                    padding-top: 1.25rem;
                }

                .hub-actions-grid .hub-shortcut-card:first-child {
                    background:
                        linear-gradient(145deg, rgba(244, 192, 82, 0.16), rgba(15, 34, 54, 0.72)),
                        rgba(6, 16, 28, 0.24);
                    border-color: rgba(244, 192, 82, 0.28);
                }

                .hub-actions-grid .hub-shortcut-card:not(:first-child) {
                    background: transparent;
                    border-color: rgba(255, 255, 255, 0.06);
                    box-shadow: none;
                }

                .hub-actions-grid .hub-shortcut-card:first-child .hub-shortcut-badge {
                    background: rgba(245, 158, 11, 0.2);
                    border-color: rgba(245, 158, 11, 0.34);
                }

                .hub-shortcut-card-disabled {
                    opacity: 0.78;
                }

                .hub-shortcut-card-locked {
                    cursor: pointer;
                }

                .hub-shortcut-card-locked .hub-shortcut-badge {
                    background: rgba(148, 163, 184, 0.14);
                    border-color: rgba(148, 163, 184, 0.18);
                    color: #e2e8f0;
                }

                .hub-shortcut-icon {
                    width: 2.85rem;
                    height: 2.85rem;
                    border-radius: 0.55rem;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    color: #fff;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                }

                .hub-accent-gold {
                    background: linear-gradient(135deg, rgba(245, 158, 11, 0.28), rgba(251, 191, 36, 0.14));
                }

                .hub-accent-sky {
                    background: linear-gradient(135deg, rgba(56, 189, 248, 0.28), rgba(14, 165, 233, 0.14));
                }

                .hub-accent-emerald {
                    background: linear-gradient(135deg, rgba(52, 211, 153, 0.24), rgba(16, 185, 129, 0.14));
                }

                .hub-accent-slate {
                    background: linear-gradient(135deg, rgba(100, 116, 139, 0.24), rgba(51, 65, 85, 0.18));
                }

                .hub-shortcut-badge,
                .hub-mini-chip {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 0.45rem;
                    padding: 0.3rem 0.58rem;
                    font-size: 0.72rem;
                    font-weight: 600;
                    letter-spacing: 0.03em;
                }

                .hub-shortcut-badge {
                    background: rgba(245, 158, 11, 0.12);
                    border: 1px solid rgba(245, 158, 11, 0.18);
                    color: #fde68a;
                }

                .hub-mini-chip {
                    background: rgba(255, 255, 255, 0.06);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    color: rgba(226, 232, 240, 0.88);
                }

                .hub-action-primary,
                .hub-action-secondary {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.45rem;
                    border-radius: 0.5rem;
                    padding: 0.78rem 1rem;
                    font-size: 0.92rem;

                    font-weight: 600;
                    transition: transform 0.18s ease, background-color 0.18s ease, border-color 0.18s ease;
                }

                .hub-action-primary {
                    background: #fbbf24;
                    color: #0f172a;
                }

                .hub-action-primary:hover {
                    transform: translateY(-1px);
                    background: #fcd34d;
                }

                .hub-action-secondary {
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    background: rgba(255, 255, 255, 0.05);
                    color: #fff;
                }

                .hub-action-secondary:hover {
                    transform: translateY(-1px);
                    background: rgba(255, 255, 255, 0.08);
                }

                .hub-guides-sidebar,
                .hub-guide-preview-shell {
                    position: relative;
                    border-radius: 0.8rem;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    background: rgba(6, 16, 28, 0.22);
                    padding: 1.35rem;
                }

                .hub-guides-sidebar {
                    border: 0;
                    border-right: 1px solid rgba(244, 192, 82, 0.24);
                    border-radius: 0;
                    background: transparent;
                    padding-left: 0;
                    border-right-color: rgba(244, 192, 82, 0.24);
                }

                .hub-guide-preview-shell {
                    border-color: rgba(255, 255, 255, 0.1);
                    background:
                        linear-gradient(145deg, rgba(10, 22, 36, 0.26), rgba(10, 22, 36, 0.42)),
                        rgba(6, 16, 28, 0.22);
                    clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 0 100%);
                }

                .hub-guide-list-item {
                    width: 100%;
                    text-align: left;
                    border-radius: 0;
                    border: 0;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                    background: transparent;
                    padding: 0.95rem 0.35rem;
                    transition: border-color 0.18s ease, background-color 0.18s ease, transform 0.18s ease;
                    backface-visibility: hidden;
                    contain: layout style paint;
                }

                .hub-guide-list-item:hover,
                .hub-guide-list-item-active {
                    border-color: rgba(251, 191, 36, 0.3);
                    background: rgba(251, 191, 36, 0.06);
                    transform: translateY(-1px);
                }

                .hub-guide-preview-header {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: flex-start;
                    justify-content: space-between;
                    gap: 1rem;
                    margin-bottom: 1rem;
                }

                .hub-preview-frame {
                    overflow: hidden;
                    border-radius: 0.65rem;
                    border: 1px solid rgba(148, 163, 184, 0.22);

                    background: #f8fafc;
                    box-shadow: none;
                    contain: layout style paint;
                    backface-visibility: hidden;
                }

                .hub-empty-state {
                    border-radius: 0.65rem;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    background: rgba(255, 255, 255, 0.04);
                    padding: 1.25rem;
                    text-align: center;
                    color: rgba(226, 232, 240, 0.92);
                }

                .hub-calendar-card {
                    position: relative;
                    overflow: hidden;
                    width: 100%;
                    padding: 0;
                    border-radius: 0.85rem;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    background: rgba(6, 16, 28, 0.18);
                    cursor: pointer;
                    display: block;
                }

                .hub-calendar-overlay {
                    position: absolute;
                    inset: 0;
                    z-index: 10;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    opacity: 0;
                    transition: opacity 0.2s ease;
                    background: linear-gradient(180deg, rgba(7, 18, 32, 0.18), rgba(7, 18, 32, 0.6));
                }

                .hub-calendar-card:hover .hub-calendar-overlay {
                    opacity: 1;
                }

                .hub-calendar-overlay-icon {
                    width: 3.5rem;
                    height: 3.5rem;
                    border-radius: 0.65rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255, 255, 255, 0.14);
                    border: 1px solid rgba(255, 255, 255, 0.16);
                    backdrop-filter: blur(6px);
                }

                @media (min-width: 768px) {
                    .hub-hero-copy {
                        max-width: 62rem;
                    }
                }

                @media (min-width: 1280px) {
                    .hub-actions-grid {
                        grid-template-columns: repeat(4, minmax(0, 1fr));
                    }

                    .hub-actions-grid .hub-shortcut-card:first-child {
                        grid-column: auto;
                    }

                }

                @media (max-width: 768px) {
                    .hub-masthead,
                    .hub-shortcut-card,
                    .hub-guides-sidebar,
                    .hub-guide-preview-shell,
                    .hub-calendar-card {
                        border-radius: 0.75rem;
                    }

                    .hub-guides-sidebar {
                        border-right: 0;
                        border-bottom: 1px solid rgba(244, 192, 82, 0.24);
                        padding-right: 0;
                        padding-bottom: 1.35rem;
                    }
                }
            `} />
        </div>
    );
}
