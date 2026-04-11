'use client';

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { MapPin, Bus, BookOpen, Lock, Calendar, ZoomIn, ZoomOut, RotateCcw, X, Search, ExternalLink, Download, FileText } from 'lucide-react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import useSWR from 'swr';

const hubItems = [
    {
        title: 'Campus Maps',
        desc: 'Interactive maps for Mandaluyong and Pasig campuses, including building directories and room locators.',
        icon: MapPin,
        accent: 'blue' as const,
        comingSoon: true,
    },
    {
        title: 'Commuter Guides',
        desc: 'Route guides, jeepney/bus schedules, and transportation tips for students commuting to RTU.',
        icon: Bus,
        accent: 'gold' as const,
        comingSoon: false,
    },
    {
        title: 'Student Handbooks & Guides',
        desc: 'Academic calendars, enrollment guides, org registration procedures, and other essential student resources.',
        icon: BookOpen,
        accent: 'blue' as const,
        comingSoon: false,
    },
];

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
    updatedAt: string;
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

export default function HubPage() {
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const [selectedGuideId, setSelectedGuideId] = useState('');
    const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
    const { data: guidesResponse, error: guidesError, isLoading: guidesLoading } = useSWR('/api/hub/guides', hubFetcher, HUB_GUIDES_SWR_OPTIONS);

    const guides = useMemo(() => guidesResponse?.data || [], [guidesResponse?.data]);
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

    const goToGuides = () => {
        if (typeof window === 'undefined') {
            return;
        }

        const section = document.getElementById('student-guides');
        section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const openLightbox = () => {
        setLightboxOpen(true);
        setZoom(1);
        setPan({ x: 0, y: 0 });
    };

    const closeLightbox = () => setLightboxOpen(false);

    const zoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.5, 4)), []);
    const zoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.5, 0.5)), []);
    const resetView = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

    const activePointers = useRef<{ [key: number]: { x: number; y: number } }>({});
    const initialDistance = useRef<number | null>(null);
    const initialZoom = useRef<number>(1);

    const getDistance = (p1: { x: number, y: number }, p2: { x: number, y: number }) => {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    };

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        const target = e.target as HTMLElement;
        target.setPointerCapture(e.pointerId);
        activePointers.current[e.pointerId] = { x: e.clientX, y: e.clientY };

        const pointerKeys = Object.keys(activePointers.current);
        if (pointerKeys.length === 1) {
            setDragging(true);
            dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
        } else if (pointerKeys.length === 2) {
            setDragging(false); // Stop panning when zooming
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
            const newZoom = initialZoom.current * scale;

            setZoom(Math.max(0.5, Math.min(newZoom, 4)));
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
            setPan(currentPan => {
                const remainingPointerId = Number(pointerKeys[0]);
                const p = activePointers.current[remainingPointerId];
                dragStart.current = { x: p.x, y: p.y, panX: currentPan.x, panY: currentPan.y };
                setDragging(true);
                return currentPan;
            });
        }
        try {
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        } catch (err) {
            // Ignore capture release errors
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
        if (typeof window === 'undefined') {
            return;
        }

        if (!lightboxOpen) {
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
        <>
            <section className="bg-gradient-rtu page-header">
                <div className="container-main text-center">
                    <MapPin className="mx-auto mb-4 text-white/80" size={40} />
                    <h1 className="font-bold text-white mb-3">
                        Student Life <span className="text-gradient-gold">Hub</span>
                    </h1>
                    <p className="page-header-subtitle max-w-lg mx-auto">
                        Everything you need to navigate campus life — maps, commuter guides, and student resources.
                    </p>
                </div>
            </section>

            <section className="section bg-surface-base">
                <div className="container-main">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-8">
                        {hubItems.map((item) => {
                            return (
                                <div
                                    key={item.title}
                                    className={`feature-card card p-6 md:p-8 flex flex-col items-center text-center relative overflow-hidden ${item.comingSoon ? '' : 'cursor-pointer'}`}
                                    onClick={item.comingSoon ? undefined : goToGuides}
                                    onKeyDown={item.comingSoon ? undefined : (event) => {
                                        if (event.key === 'Enter' || event.key === ' ') {
                                            event.preventDefault();
                                            goToGuides();
                                        }
                                    }}
                                    role={item.comingSoon ? undefined : 'button'}
                                    tabIndex={item.comingSoon ? undefined : 0}
                                >
                                    {/* Coming Soon Overlay */}
                                    {item.comingSoon ? (
                                        <div className="coming-soon-overlay">
                                            <Lock size={28} className="text-subtle mb-2" />
                                            <span className="coming-soon-label">
                                                Coming Soon
                                            </span>
                                        </div>
                                    ) : null}

                                    <div
                                        className="portal-accent-chip w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                                        data-accent={item.accent}
                                    >
                                        <item.icon size={28} />
                                    </div>
                                    <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                                    <p className="text-sm text-subtle">
                                        {item.desc}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section id="student-guides" className="section bg-surface-base scroll-mt-24">
                <div className="container-main">
                    <div className="text-center mb-10">
                        <div className="icon-chip-blue mx-auto mb-5">
                            <FileText size={28} />
                        </div>
                        <h2 className="text-3xl font-bold mb-2 section-heading text-brand">
                            Student Handbooks &amp; Guides
                        </h2>
                        <p className="text-subtle max-w-2xl mx-auto">
                            This section is for files relevant to get to know the Campus, Student Government, and other important resources.
                        </p>
                    </div>

                    {guidesLoading ? (
                        <div className="card p-8 text-center text-subtle">Loading Student Government Code and guide documents...</div>
                    ) : guidesError ? (
                        <div className="card p-8 border border-red-200 bg-red-50 text-red-700 text-center">
                            {guidesError instanceof Error ? guidesError.message : 'Unable to load student guides at this time.'}
                        </div>
                    ) : guides.length === 0 ? (
                        <div className="card p-8 text-center text-subtle">
                            No PDF guides are published yet. Add or unhide rows in Student Hub Control (or Transparency Hub) to make guides appear here.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
                            <div className="card p-4 sm:p-5 max-h-[34rem] overflow-auto custom-scrollbar">
                                <h3 className="font-bold text-brand mb-3">Available Guides</h3>
                                <div className="space-y-2">
                                    {guides.map((guide) => {
                                        const isSelected = guide.id === resolvedSelectedGuideId;
                                        return (
                                            <button
                                                key={guide.id}
                                                type="button"
                                                onClick={() => setSelectedGuideId(guide.id)}
                                                className={`w-full text-left rounded-xl border px-3 py-3 transition-colors ${isSelected
                                                    ? 'guide-list-button-selected'
                                                    : 'border-soft hover:bg-surface-soft'}`}
                                            >
                                                <p className="text-sm font-semibold text-strong">{guide.title}</p>
                                                {guide.description && (
                                                    <p className="mt-1 text-xs text-subtle leading-relaxed">{guide.description}</p>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {selectedGuide && (
                                <div className="card overflow-hidden p-0">
                                    <div className="guide-preview-header px-4 py-4 sm:px-6 border-b border-soft">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <h3 className="text-xl font-bold text-brand">{selectedGuide.title}</h3>
                                                {selectedGuide.description && (
                                                    <p className="text-sm text-subtle mt-1">{selectedGuide.description}</p>
                                                )}
                                            </div>
                                            <div className="flex gap-2">
                                                <a
                                                    href={selectedGuide.viewUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="guide-link-secondary inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors"
                                                >
                                                    <ExternalLink size={14} /> Open in New Tab
                                                </a>
                                                <a
                                                    href={selectedGuide.downloadUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="btn-primary text-sm inline-flex items-center gap-1.5"
                                                >
                                                    <Download size={14} /> Download PDF
                                                </a>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="p-4 sm:p-5">
                                        <div className="rounded-2xl overflow-hidden border border-slate-300/80 shadow-[0_12px_36px_rgba(15,23,42,0.18)] bg-slate-900">
                                            <div className="relative bg-white">
                                                {shouldAttemptGuideEmbed ? (
                                                    <iframe
                                                        title={`${selectedGuide.title} PDF Preview`}
                                                        src={selectedGuidePreviewUrl}
                                                        className="w-full h-[40rem] bg-white"
                                                        loading="lazy"
                                                        referrerPolicy="strict-origin-when-cross-origin"
                                                    />
                                                ) : (
                                                    <div className="h-[40rem] flex flex-col items-center justify-center text-center p-8 bg-surface-soft">
                                                        <p className="text-strong font-semibold mb-2">Preview unavailable for this file</p>
                                                        <p className="text-sm text-subtle max-w-md">
                                                            This guide can still be opened or downloaded safely. Some external providers block embedded previews even for valid PDFs.
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <p className="micro-note text-subtle mt-3">
                                            PDF-only enforcement is active. Non-PDF links are ignored automatically.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </section>

            {/* ── Academic Calendar Section ── */}
            <section className="section bg-surface-soft">
                <div className="container-main">
                    <div className="text-center mb-10">
                        <div className="icon-chip-gold mx-auto mb-5">
                            <Calendar size={28} />
                        </div>
                        <h2 className="text-3xl font-bold mb-2 section-heading text-brand">
                            Academic Calendar
                        </h2>
                        <p className="text-subtle">
                            School Year 2026-2027
                        </p>
                    </div>

                    {/* Clickable Calendar Card */}
                    <button
                        onClick={openLightbox}
                        className="card p-2 md:p-6 mx-auto max-w-5xl bg-white shadow-xl rounded-2xl overflow-hidden relative group cursor-pointer block w-full border-0 transition-shadow"
                    >
                        {/* Hover overlay hint */}
                        <div className="calendar-card-overlay absolute inset-0 z-10 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div className="calendar-card-overlay-icon w-16 h-16 rounded-full flex items-center justify-center mb-3">
                                <Search className="text-white" size={28} />
                            </div>
                            <span className="text-white font-semibold text-sm tracking-wide">Click to expand &amp; zoom</span>
                        </div>
                        <div className="relative w-full aspect-[1/1.4] md:aspect-[16/10]">
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
            </section>

            {/* ── Lightbox Modal ── */}
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
                            {/* Backdrop */}
                            <div
                                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                                onClick={closeLightbox}
                            />

                            {/* Controls Bar */}
                            <div className="absolute top-4 right-4 z-[10001] flex items-center gap-2">
                                <button
                                    onClick={zoomIn}
                                    className="glass-control-btn w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
                                    aria-label="Zoom in"
                                >
                                    <ZoomIn className="text-white" size={18} />
                                </button>
                                <button
                                    onClick={zoomOut}
                                    className="glass-control-btn w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
                                    aria-label="Zoom out"
                                >
                                    <ZoomOut className="text-white" size={18} />
                                </button>
                                <button
                                    onClick={resetView}
                                    className="glass-control-btn w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
                                    aria-label="Reset view"
                                >
                                    <RotateCcw className="text-white" size={18} />
                                </button>
                                <div className="glass-control-meter px-3 py-1 rounded-lg text-white/70 text-xs font-mono">
                                    {Math.round(zoom * 100)}%
                                </div>
                                <button
                                    onClick={closeLightbox}
                                    className="glass-control-btn-danger w-10 h-10 rounded-xl flex items-center justify-center ml-2 transition-colors"
                                    aria-label="Close lightbox"
                                >
                                    <X className="text-white" size={20} />
                                </button>
                            </div>

                            {/* Zoom hint */}
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[10001] text-white/40 text-xs tracking-wide">
                                Scroll to zoom · Drag to pan · Click backdrop to close
                            </div>

                            {/* Zoomable Image Container */}
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
        </>
    );
}
