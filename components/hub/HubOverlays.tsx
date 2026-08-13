'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { Lock, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react';

type LockedFeatureNotice = {
    title: string;
    summary: string;
    detail: string;
};

type HubOverlaysProps = {
    lockedFeatureNotice: LockedFeatureNotice | null;
    closeLockedFeatureNotice: () => void;
    lightboxOpen: boolean;
    closeLightbox: () => void;
};

export default function HubOverlays({
    lockedFeatureNotice,
    closeLockedFeatureNotice,
    lightboxOpen,
    closeLightbox,
}: HubOverlaysProps) {
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const activePointers = useRef<Record<number, { x: number; y: number }>>({});
    const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
    const initialDistance = useRef<number | null>(null);
    const initialZoom = useRef(1);

    useEffect(() => {
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

    if (typeof document === 'undefined') {
        return null;
    }

    const getDistance = (first: { x: number; y: number }, second: { x: number; y: number }) => (
        Math.sqrt(Math.pow(second.x - first.x, 2) + Math.pow(second.y - first.y, 2))
    );

    const handlePointerDown = (event: React.PointerEvent) => {
        const target = event.target as HTMLElement;
        target.setPointerCapture(event.pointerId);
        activePointers.current[event.pointerId] = { x: event.clientX, y: event.clientY };

        const pointerKeys = Object.keys(activePointers.current);
        if (pointerKeys.length === 1) {
            setDragging(true);
            dragStart.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
        } else if (pointerKeys.length === 2) {
            setDragging(false);
            const first = activePointers.current[Number(pointerKeys[0])];
            const second = activePointers.current[Number(pointerKeys[1])];
            initialDistance.current = getDistance(first, second);
            initialZoom.current = zoom;
        }
    };

    const handlePointerMove = (event: React.PointerEvent) => {
        if (!activePointers.current[event.pointerId]) return;
        activePointers.current[event.pointerId] = { x: event.clientX, y: event.clientY };

        const pointerKeys = Object.keys(activePointers.current);
        if (pointerKeys.length === 1 && dragging) {
            const dx = event.clientX - dragStart.current.x;
            const dy = event.clientY - dragStart.current.y;
            setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
        } else if (pointerKeys.length === 2 && initialDistance.current !== null) {
            const first = activePointers.current[Number(pointerKeys[0])];
            const second = activePointers.current[Number(pointerKeys[1])];
            const scale = getDistance(first, second) / initialDistance.current;
            setZoom(Math.max(0.5, Math.min(initialZoom.current * scale, 4)));
        }
    };

    const handlePointerUp = (event: React.PointerEvent) => {
        delete activePointers.current[event.pointerId];
        const pointerKeys = Object.keys(activePointers.current);

        if (pointerKeys.length < 2) {
            initialDistance.current = null;
        }
        if (pointerKeys.length === 0) {
            setDragging(false);
        } else if (pointerKeys.length === 1) {
            const currentPan = pan;
            const remainingPointerId = Number(pointerKeys[0]);
            const remaining = activePointers.current[remainingPointerId];
            dragStart.current = { x: remaining.x, y: remaining.y, panX: currentPan.x, panY: currentPan.y };
            setDragging(true);
        }

        try {
            (event.target as HTMLElement).releasePointerCapture(event.pointerId);
        } catch {
        }
    };

    const handleWheel = (event: React.WheelEvent) => {
        event.preventDefault();
        setZoom((current) => Math.min(Math.max(current + (event.deltaY > 0 ? -0.15 : 0.15), 0.5), 4));
    };

    return createPortal(
        <>
            {lockedFeatureNotice && (
                <div className="hub-modal-backdrop fixed inset-0 z-[9998] flex items-center justify-center px-4">
                    <div className="absolute inset-0 bg-slate-950/78 backdrop-blur-sm" onClick={closeLockedFeatureNotice} />
                    <div className="hub-modal-dialog relative z-[9999] w-full max-w-lg rounded-[1.75rem] border border-white/10 bg-[linear-gradient(145deg,rgba(12,22,36,0.92),rgba(11,20,34,0.98))] p-6 shadow-[0_28px_80px_rgba(2,8,23,0.45)]">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-amber-400/25 bg-amber-500/12 text-amber-200">
                                    <Lock size={18} />
                                </div>
                                <div>
                                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-200/80">Later feature</p>
                                    <h3 className="mt-2 text-xl font-semibold text-white">{lockedFeatureNotice.title}</h3>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={closeLockedFeatureNotice}
                                className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
                                aria-label="Close notice"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-50">
                            {lockedFeatureNotice.summary}
                        </div>

                        <p className="mt-4 text-sm leading-7 text-slate-300">{lockedFeatureNotice.detail}</p>

                        <div className="mt-6 flex justify-end">
                            <button type="button" onClick={closeLockedFeatureNotice} className="hub-action-secondary text-sm">
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {lightboxOpen && (
                <div className="hub-lightbox fixed inset-0 z-[9999] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={closeLightbox} />

                    <div className="absolute top-4 right-4 z-[10001] flex items-center gap-2">
                        <button onClick={() => setZoom((current) => Math.min(current + 0.5, 4))} className="glass-control-btn w-10 h-10 rounded-xl flex items-center justify-center transition-colors" aria-label="Zoom in">
                            <ZoomIn className="text-white" size={18} />
                        </button>
                        <button onClick={() => setZoom((current) => Math.max(current - 0.5, 0.5))} className="glass-control-btn w-10 h-10 rounded-xl flex items-center justify-center transition-colors" aria-label="Zoom out">
                            <ZoomOut className="text-white" size={18} />
                        </button>
                        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="glass-control-btn w-10 h-10 rounded-xl flex items-center justify-center transition-colors" aria-label="Reset view">
                            <RotateCcw className="text-white" size={18} />
                        </button>
                        <div className="glass-control-meter px-3 py-1 rounded-lg text-white/70 text-xs font-mono">{Math.round(zoom * 100)}%</div>
                        <button onClick={closeLightbox} className="glass-control-btn-danger w-10 h-10 rounded-xl flex items-center justify-center ml-2 transition-colors" aria-label="Close lightbox">
                            <X className="text-white" size={20} />
                        </button>
                    </div>

                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[10001] text-white/40 text-xs tracking-wide">
                        Scroll to zoom · Drag to pan · Click backdrop to close
                    </div>

                    <div
                        className={`calendar-lightbox-surface relative z-[10000] w-[90vw] h-[85vh] overflow-hidden rounded-2xl ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                        onWheel={handleWheel}
                    >
                        <div className="w-full h-full flex items-center justify-center select-none">
                            <Image
                                src="/images/ACADEMIC_CALENDAR_2026_2027.jpg"
                                alt="Academic Calendar 2026-2027 (Zoomed)"
                                width={1600}
                                height={2000}
                                className="object-contain max-w-full max-h-full pointer-events-none"
                                quality={95}
                                draggable={false}
                            />
                        </div>
                    </div>
                </div>
            )}
        </>,
        document.body,
    );
}
