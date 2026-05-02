'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
    ArrowRight,
    BookOpen,
    Bus,
    Calendar,
    Download,
    ExternalLink,
    FileText,
    Lock,
    MapPin,
    RotateCcw,
    Search,
    Sparkles,
    X,
    ZoomIn,
    ZoomOut,
} from 'lucide-react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import useSWR from 'swr';
import { NoncedStyle } from '@/components/CspNonceProvider';

const HUB_GUIDES_SWR_OPTIONS = {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 120000,
    keepPreviousData: true,
} as const;

type HubGuide = {
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
    disabled?: boolean;
    onClick: () => void;
    badge: string;
};

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

function getDriveInlineViewerUrl(guide: HubGuide): string {
    const { fileId, resourceKey } = getDriveGuideIdentifiers(guide);
    if (!fileId) {
        return '';
    }

    if (resourceKey) {
        return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview?resourcekey=${encodeURIComponent(resourceKey)}`;
    }

    return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
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

const hubFetcher = async (url: string) => {
    const response = await fetch(url);
    const json = await response.json().catch(() => ({}));

    if (!response.ok) {
        const fallbackMessage = 'Unable to load hub guides at the moment.';
        const message = typeof json?.error?.message === 'string'
            ? json.error.message
            : typeof json?.error === 'string'
                ? json.error
                : fallbackMessage;
        throw new Error(message);
    }

    return json as { data?: HubGuide[] };
};

function selectFeaturedGuides(guides: HubGuide[]): HubGuide[] {
    if (guides.length <= 3) {
        return guides;
    }

    const preferredOrder = [
        'student government code',
        'student handbook',
        'enrollment',
    ];

    const picked: HubGuide[] = [];
    for (const keyword of preferredOrder) {
        const match = guides.find((guide) => guide.title.toLowerCase().includes(keyword));
        if (match && !picked.some((guide) => guide.id === match.id)) {
            picked.push(match);
        }
    }

    for (const guide of guides) {
        if (picked.length >= 3) {
            break;
        }
        if (!picked.some((item) => item.id === guide.id)) {
            picked.push(guide);
        }
    }

    return picked;
}

export default function HubPage() {
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const [selectedGuideId, setSelectedGuideId] = useState('');
    const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
    const { data: guidesResponse, error: guidesError, isLoading: guidesLoading } = useSWR('/api/hub/guides', hubFetcher, HUB_GUIDES_SWR_OPTIONS);

    const guides = useMemo(() => guidesResponse?.data || [], [guidesResponse?.data]);
    const featuredGuides = useMemo(() => selectFeaturedGuides(guides), [guides]);

    const {
        resolvedSelectedGuideId,
        selectedGuide,
        selectedGuidePreviewUrl,
        shouldAttemptGuideEmbed,
    } = useMemo(() => {
        const preferredGuide = guides.find((guide) => guide.title.toLowerCase().includes('student government code'));
        const fallbackGuideId = preferredGuide?.id || guides[0]?.id || '';
        const resolvedGuideId = guides.some((guide) => guide.id === selectedGuideId)
            ? selectedGuideId
            : fallbackGuideId;
        const activeGuide = guides.find((guide) => guide.id === resolvedGuideId) || null;

        const selectedGuideEmbedUrl = activeGuide
            ? (
                activeGuide.source === 'drive'
                    ? (getDriveInlineViewerUrl(activeGuide) || getDrivePreviewProxyUrl(activeGuide) || activeGuide.embedUrl)
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
    }, [guides, selectedGuideId]);

    const scrollToSection = useCallback((sectionId: string) => {
        if (typeof window === 'undefined') {
            return;
        }

        const section = document.getElementById(sectionId);
        section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    const handleGuideSelection = useCallback((guideId: string) => {
        setSelectedGuideId(guideId);
        scrollToSection('student-guides');
    }, [scrollToSection]);

    const openLightbox = useCallback(() => {
        setLightboxOpen(true);
        setZoom(1);
        setPan({ x: 0, y: 0 });
    }, []);

    const closeLightbox = useCallback(() => setLightboxOpen(false), []);
    const zoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.5, 4)), []);
    const zoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.5, 0.5)), []);
    const resetView = useCallback(() => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    }, []);

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
            id: 'featured',
            title: 'Open selected guide',
            summary: selectedGuide
                ? selectedGuide.title
                : 'Open the currently selected guide.',
            icon: FileText,
            accentClassName: 'hub-accent-emerald',
            onClick: () => {
                if (selectedGuide) {
                    window.open(selectedGuide.viewUrl, '_blank', 'noopener,noreferrer');
                } else {
                    scrollToSection('student-guides');
                }
            },
            badge: selectedGuide ? 'Ready to open' : 'Workspace',
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
            disabled: false,
            badge: 'New',
        },
    ]), [guides.length, scrollToSection, selectedGuide]);

    const activePointers = useRef<{ [key: number]: { x: number; y: number } }>({});
    const initialDistance = useRef<number | null>(null);
    const initialZoom = useRef<number>(1);

    const getDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) =>
        Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        const target = e.target as HTMLElement;
        target.setPointerCapture(e.pointerId);
        activePointers.current[e.pointerId] = { x: e.clientX, y: e.clientY };

        const pointerKeys = Object.keys(activePointers.current);
        if (pointerKeys.length === 1) {
            setDragging(true);
            dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
        } else if (pointerKeys.length === 2) {
            setDragging(false);
            const p1 = activePointers.current[Number(pointerKeys[0])];
            const p2 = activePointers.current[Number(pointerKeys[1])];
            initialDistance.current = getDistance(p1, p2);
            initialZoom.current = zoom;
        }
    }, [pan, zoom]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!activePointers.current[e.pointerId]) return;
        activePointers.current[e.pointerId] = { x: e.clientX, y: e.clientY };

        const pointerKeys = Object.keys(activePointers.current);
        if (pointerKeys.length === 1 && dragging) {
            const dx = e.clientX - dragStart.current.x;
            const dy = e.clientY - dragStart.current.y;
            setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
        } else if (pointerKeys.length === 2 && initialDistance.current !== null) {
            const p1 = activePointers.current[Number(pointerKeys[0])];
            const p2 = activePointers.current[Number(pointerKeys[1])];
            const currentDistance = getDistance(p1, p2);
            const scale = currentDistance / initialDistance.current;
            setZoom(Math.max(0.5, Math.min(initialZoom.current * scale, 4)));
        }
    }, [dragging]);

    const handlePointerUp = useCallback((e: React.PointerEvent) => {
        delete activePointers.current[e.pointerId];
        const pointerKeys = Object.keys(activePointers.current);

        if (pointerKeys.length < 2) {
            initialDistance.current = null;
        }
        if (pointerKeys.length === 0) {
            setDragging(false);
        } else if (pointerKeys.length === 1) {
            setPan((currentPan) => {
                const remainingPointerId = Number(pointerKeys[0]);
                const p = activePointers.current[remainingPointerId];
                dragStart.current = { x: p.x, y: p.y, panX: currentPan.x, panY: currentPan.y };
                setDragging(true);
                return currentPan;
            });
        }

        try {
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        } catch {
        }
    }, []);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        setZoom((z) => {
            const delta = e.deltaY > 0 ? -0.15 : 0.15;
            return Math.min(Math.max(z + delta, 0.5), 4);
        });
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined' || !lightboxOpen) {
            return;
        }

        const originalOverflow = document.body.style.overflow;
        const originalPaddingRight = document.body.style.paddingRight;
        const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

        document.body.style.overflow = 'hidden';
        if (scrollbarWidth > 0) {
            document.body.style.paddingRight = `${scrollbarWidth}px`;
        }

        return () => {
            document.body.style.overflow = originalOverflow;
            document.body.style.paddingRight = originalPaddingRight;
        };
    }, [lightboxOpen]);

    return (
        <div className="hub-shell relative overflow-hidden">
            <div className="hub-noise" aria-hidden="true" />

            <section className="relative z-10 pt-20 pb-8 md:pt-28 md:pb-10">
                <div className="container-main mx-auto w-full max-w-7xl">
                    <div className="hub-panel p-6 md:p-8 flex flex-col items-center text-center">
                            <span className="hub-eyebrow inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5">
                                <Sparkles size={14} className="text-amber-300" />
                                Information Hub
                            </span>
                            <h1 className="hub-display w-full text-white mx-auto">
                                Academic Resource <span className="hub-display-accent">Dashboard</span>
                            </h1>
                            <p className="hub-lead mt-5 max-w-2xl text-slate-200 mx-auto">
                                Access official student references, published guides, and the academic calendar from one page.
                            </p>

                            <div className="mt-7 grid w-full gap-3 sm:grid-cols-3">
                                <div className="hub-stat-card">
                                    <p className="hub-stat-label">Live Guides</p>
                                    <p className="hub-stat-value">{guides.length}</p>
                                    <p className="hub-stat-note">Published PDFs ready for preview or download</p>
                                </div>
                                <div className="hub-stat-card">
                                    <p className="hub-stat-label">Featured Focus</p>
                                    <p className="hub-stat-value text-lg">{featuredGuides[0]?.title || 'Awaiting guide'}</p>
                                    <p className="hub-stat-note">Highlighted as a starting point for students</p>
                                </div>
                                <div className="hub-stat-card">
                                    <p className="hub-stat-label">Calendar View</p>
                                    <p className="hub-stat-value">SY 2026-2027</p>
                                    <p className="hub-stat-note">Zoomable academic snapshot built into the hub</p>
                                </div>
                            </div>
                    </div>
                </div>
            </section>

            <section className="relative z-10 pb-8 md:pb-10">
                <div className="container-main mx-auto w-full max-w-7xl">
                    <div className="hub-panel p-6 md:p-7">
                        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
                            <div>
                                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Quick Access</p>
                                <h2 className="mt-2 text-2xl font-semibold text-white">Primary Sections</h2>
                            </div>
                            <p className="max-w-xl text-sm leading-relaxed text-slate-300">
                                Open the main hub sections directly from the dashboard.
                            </p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                            {quickActions.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={item.onClick}
                                    disabled={item.disabled}
                                    className={`hub-shortcut-card text-left ${item.disabled ? 'hub-shortcut-card-disabled' : ''}`}
                                >
                                    <div className={`hub-shortcut-icon ${item.accentClassName}`}>
                                        <item.icon size={20} />
                                    </div>
                                    <div className="mt-5 flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-semibold text-white">{item.title}</p>
                                            <p className="mt-2 text-sm leading-relaxed text-slate-300">{item.summary}</p>
                                        </div>
                                        {item.disabled ? <Lock size={16} className="text-slate-500 shrink-0 mt-1" /> : <ArrowRight size={16} className="text-amber-200 shrink-0 mt-1" />}
                                    </div>
                                    <div className="mt-5">
                                        <span className="hub-shortcut-badge">{item.badge}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section className="relative z-10 pb-8 md:pb-10">
                <div className="container-main mx-auto w-full max-w-7xl">
                    <div className="hub-panel p-6 md:p-7">
                        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
                            <div>
                                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Featured Documents</p>
                                <h2 className="mt-2 text-2xl font-semibold text-white">Priority References</h2>
                            </div>
                            <p className="max-w-xl text-sm leading-relaxed text-slate-300">
                                Selected documents are highlighted for quick access.
                            </p>
                        </div>

                        {guidesLoading ? (
                            <div className="grid gap-4 lg:grid-cols-3">
                                {Array.from({ length: 3 }).map((_, idx) => (
                                    <div key={idx} className="hub-feature-card animate-pulse">
                                        <div className="h-8 w-24 rounded-full bg-white/10" />
                                        <div className="mt-5 h-6 w-2/3 rounded bg-white/10" />
                                        <div className="mt-3 h-16 rounded bg-white/10" />
                                    </div>
                                ))}
                            </div>
                        ) : guidesError ? (
                            <div className="hub-empty-state border-red-400/20 bg-red-500/10 text-red-100">
                                {guidesError instanceof Error ? guidesError.message : 'Unable to load featured documents right now.'}
                            </div>
                        ) : featuredGuides.length === 0 ? (
                            <div className="hub-empty-state">
                                No featured guides are published yet. Once PDF entries are available, they will appear here automatically.
                            </div>
                        ) : (
                            <div className="grid gap-4 lg:grid-cols-3">
                                {featuredGuides.map((guide, index) => (
                                    <article key={guide.id} className="hub-feature-card">
                                        <div className="flex items-center justify-between gap-3">
                                            <span className="hub-feature-rank">Essential {index + 1}</span>
                                            <span className="hub-mini-chip">{guide.category || 'PDF Guide'}</span>
                                        </div>
                                        <h3 className="mt-5 text-xl font-semibold text-white leading-snug">{guide.title}</h3>
                                        <p className="mt-3 text-sm leading-relaxed text-slate-300">
                                            {guide.description || 'Published as part of the student academic resource library.'}
                                        </p>
                                        <div className="mt-5 flex flex-wrap gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleGuideSelection(guide.id)}
                                                className="hub-action-primary"
                                            >
                                                <Search size={15} />
                                                Preview
                                            </button>
                                            <a
                                                href={guide.downloadUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="hub-action-secondary"
                                            >
                                                <Download size={15} />
                                                Download
                                            </a>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <section id="student-guides" className="relative z-10 pb-8 md:pb-10 scroll-mt-24">
                <div className="container-main mx-auto w-full max-w-7xl">
                    <div className="hub-panel p-6 md:p-7">
                        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
                            <div>
                                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Student Guides</p>
                                <h2 className="mt-2 text-2xl font-semibold text-white">Document Library</h2>
                            </div>
                            <p className="max-w-xl text-sm leading-relaxed text-slate-300">
                                Select a guide from the list to preview or open the document.
                            </p>
                        </div>

                        {guidesLoading ? (
                            <div className="hub-empty-state">Loading documents...</div>
                        ) : guidesError ? (
                            <div className="hub-empty-state border-red-400/20 bg-red-500/10 text-red-100">
                                {guidesError instanceof Error ? guidesError.message : 'Unable to load student guides at this time.'}
                            </div>
                        ) : guides.length === 0 ? (
                            <div className="hub-empty-state">
                                No PDF guides are published yet. Add or unhide rows in Student Hub Control to make documents appear here.
                            </div>
                        ) : (
                            <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
                                <div className="hub-guides-sidebar">
                                        <div className="flex items-center justify-between gap-3 mb-4">
                                            <div>
                                                <p className="text-sm font-semibold text-white">Available Guides</p>
                                                <p className="text-xs text-slate-400 mt-1">Select a document to preview.</p>
                                            </div>
                                            <span className="hub-mini-chip">{guides.length} total</span>
                                        </div>
                                    <div className="space-y-2">
                                        {guides.map((guide) => {
                                            const isSelected = guide.id === resolvedSelectedGuideId;
                                            return (
                                                <button
                                                    key={guide.id}
                                                    type="button"
                                                    onClick={() => setSelectedGuideId(guide.id)}
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
                                    </div>
                                </div>

                                {selectedGuide ? (
                                    <div className="hub-guide-preview-shell">
                                        <div className="hub-guide-preview-header">
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="hub-preview-chip">Current preview</span>
                                                    <span className="hub-mini-chip">{selectedGuide.category || 'PDF Guide'}</span>
                                                </div>
                                                <h3 className="mt-4 text-2xl font-semibold text-white">{selectedGuide.title}</h3>
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

                                        <div className="hub-preview-frame pdf-embed-shell">
                                            {shouldAttemptGuideEmbed ? (
                                                <iframe
                                                    title={`${selectedGuide.title} PDF Preview`}
                                                    src={selectedGuidePreviewUrl}
                                                    className="h-[46rem]"
                                                    loading="lazy"
                                                    referrerPolicy="strict-origin-when-cross-origin"
                                                />
                                            ) : (
                                                <div className="h-[46rem] flex flex-col items-center justify-center text-center p-8 bg-slate-900/60">
                                                    <p className="text-white font-semibold mb-2">Preview unavailable</p>
                                                    <p className="max-w-md text-sm leading-relaxed text-slate-300">
                                                        This document can still be opened or downloaded.
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                                            <div className="flex flex-wrap gap-2">
                                                <span className="hub-mini-chip">Embedded preview</span>
                                                <span className="hub-mini-chip">PDF-only gating active</span>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <section id="academic-calendar" className="relative z-10 pb-14 md:pb-16 scroll-mt-24">
                <div className="container-main mx-auto w-full max-w-7xl">
                    <div className="hub-panel p-6 md:p-7">
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

            {typeof document !== 'undefined' && createPortal(
                <AnimatePresence>
                    {lightboxOpen && (
                        <motion.div
                            className="fixed inset-0 z-[9999] flex items-center justify-center"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25 }}
                        >
                            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeLightbox} />

                            <div className="absolute top-4 right-4 z-[10001] flex items-center gap-2">
                                <button onClick={zoomIn} className="glass-control-btn w-10 h-10 rounded-xl flex items-center justify-center transition-colors" aria-label="Zoom in">
                                    <ZoomIn className="text-white" size={18} />
                                </button>
                                <button onClick={zoomOut} className="glass-control-btn w-10 h-10 rounded-xl flex items-center justify-center transition-colors" aria-label="Zoom out">
                                    <ZoomOut className="text-white" size={18} />
                                </button>
                                <button onClick={resetView} className="glass-control-btn w-10 h-10 rounded-xl flex items-center justify-center transition-colors" aria-label="Reset view">
                                    <RotateCcw className="text-white" size={18} />
                                </button>
                                <div className="glass-control-meter px-3 py-1 rounded-lg text-white/70 text-xs font-mono">
                                    {Math.round(zoom * 100)}%
                                </div>
                                <button onClick={closeLightbox} className="glass-control-btn-danger w-10 h-10 rounded-xl flex items-center justify-center ml-2 transition-colors" aria-label="Close lightbox">
                                    <X className="text-white" size={20} />
                                </button>
                            </div>

                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[10001] text-white/40 text-xs tracking-wide">
                                Scroll to zoom · Drag to pan · Click backdrop to close
                            </div>

                            <motion.div
                                className={`calendar-lightbox-surface relative z-[10000] w-[90vw] h-[85vh] overflow-hidden rounded-2xl ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                                initial={{ scale: 0.92, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.92, opacity: 0 }}
                                transition={{ duration: 0.25, ease: 'easeOut' }}
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerLeave={handlePointerUp}
                                onWheel={handleWheel}
                            >
                                <motion.div
                                    className="w-full h-full flex items-center justify-center select-none"
                                    animate={{ x: pan.x, y: pan.y, scale: zoom }}
                                    transition={dragging ? { duration: 0 } : { duration: 0.15, ease: 'easeOut' }}
                                >
                                    <Image
                                        src="/images/ACADEMIC_CALENDAR_2026_2027.jpg"
                                        alt="Academic Calendar 2026-2027 (Zoomed)"
                                        width={1600}
                                        height={2000}
                                        className="object-contain max-w-full max-h-full pointer-events-none"
                                        quality={95}
                                        draggable={false}
                                    />
                                </motion.div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            <NoncedStyle css={`
                .hub-shell {
                    min-height: 100vh;
                    background:
                        radial-gradient(88% 96% at 10% 10%, rgba(244, 192, 82, 0.18) 0%, rgba(244, 192, 82, 0) 48%),
                        radial-gradient(108% 118% at 92% 12%, rgba(94, 184, 255, 0.18) 0%, rgba(94, 184, 255, 0) 52%),
                        linear-gradient(135deg, #102845 0%, #1c436c 45%, #245f82 100%);
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

                .hub-panel,
                .hub-feature-card,
                .hub-shortcut-card,
                .hub-guides-sidebar,
                .hub-guide-preview-shell,
                .hub-calendar-card {
                    position: relative;
                    border-radius: 1.5rem;
                    background: linear-gradient(145deg, rgba(12, 22, 36, 0.42), rgba(11, 20, 34, 0.62));
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    box-shadow: 0 20px 50px rgba(4, 10, 22, 0.26);
                    backdrop-filter: blur(18px);
                    -webkit-backdrop-filter: blur(18px);
                }

                .hub-eyebrow {
                    background: rgba(244, 192, 82, 0.12);
                    border: 1px solid rgba(244, 192, 82, 0.2);
                    color: #fde68a;
                    font-size: 0.8rem;
                    font-weight: 600;
                    backdrop-filter: blur(8px);
                }

                .hub-display {
                    font-size: clamp(2.5rem, 5vw, 4.5rem);
                    line-height: 1.04;
                    font-weight: 700;
                    text-wrap: balance;
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
                }

                .hub-stat-card {
                    border-radius: 1.25rem;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    background: rgba(0, 0, 0, 0.16);
                    padding: 1rem;
                }

                .hub-stat-label {
                    font-size: 0.75rem;
                    letter-spacing: 0.12em;
                    text-transform: uppercase;
                    color: rgba(148, 163, 184, 0.9);
                }

                .hub-stat-value {
                    margin-top: 0.5rem;
                    font-size: 1.35rem;
                    font-weight: 700;
                    color: #fff;
                    line-height: 1.2;
                }

                .hub-stat-note {
                    margin-top: 0.45rem;
                    font-size: 0.82rem;
                    line-height: 1.5;
                    color: rgba(203, 213, 225, 0.86);
                }

                .hub-shortcut-card,
                .hub-feature-card {
                    padding: 1.4rem;
                    transition: transform 0.18s ease, border-color 0.18s ease, background-color 0.18s ease;
                    backface-visibility: hidden;
                    contain: layout style paint;
                }

                .hub-shortcut-card:hover,
                .hub-feature-card:hover {
                    transform: translateY(-2px);
                    border-color: rgba(244, 192, 82, 0.26);
                }

                .hub-shortcut-card-disabled {
                    opacity: 0.78;
                    cursor: not-allowed;
                }

                .hub-shortcut-icon {
                    width: 3rem;
                    height: 3rem;
                    border-radius: 1rem;
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
                .hub-feature-rank,
                .hub-preview-chip,
                .hub-mini-chip {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 999px;
                    padding: 0.35rem 0.7rem;
                    font-size: 0.72rem;
                    font-weight: 600;
                }

                .hub-shortcut-badge,
                .hub-feature-rank,
                .hub-preview-chip {
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
                    border-radius: 0.9rem;
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
                    padding: 1.35rem;
                }

                .hub-guide-list-item {
                    width: 100%;
                    text-align: left;
                    border-radius: 1rem;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    background: rgba(255, 255, 255, 0.04);
                    padding: 0.95rem 1rem;
                    transition: border-color 0.18s ease, background-color 0.18s ease, transform 0.18s ease;
                    backface-visibility: hidden;
                    contain: layout style paint;
                }

                .hub-guide-list-item:hover,
                .hub-guide-list-item-active {
                    border-color: rgba(251, 191, 36, 0.24);
                    background: rgba(251, 191, 36, 0.1);
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
                    border-radius: 1.25rem;
                    border: 1px solid rgba(148, 163, 184, 0.22);
                    background: #f8fafc;
                    box-shadow: none;
                    contain: layout style paint;
                    backface-visibility: hidden;
                }

                .hub-empty-state {
                    border-radius: 1.25rem;
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    background: rgba(255, 255, 255, 0.04);
                    padding: 1.25rem;
                    text-align: center;
                    color: rgba(226, 232, 240, 0.92);
                }

                .hub-calendar-card {
                    overflow: hidden;
                    width: 100%;
                    padding: 0;
                    border: 0;
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
                    border-radius: 999px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255, 255, 255, 0.14);
                    border: 1px solid rgba(255, 255, 255, 0.16);
                    backdrop-filter: blur(6px);
                }

                @media (max-width: 768px) {
                    .hub-panel,
                    .hub-feature-card,
                    .hub-shortcut-card,
                    .hub-guides-sidebar,
                    .hub-guide-preview-shell {
                        border-radius: 1.25rem;
                    }
                }
            `} />
        </div>
    );
}
