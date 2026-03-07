'use client';

import { useState, useRef, useCallback } from 'react';
import { MapPin, Bus, BookOpen, Lock, Calendar, ZoomIn, ZoomOut, RotateCcw, X, Search } from 'lucide-react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

const hubItems = [
    {
        title: 'Campus Maps',
        desc: 'Interactive maps for Mandaluyong and Pasig campuses, including building directories and room locators.',
        icon: MapPin,
        accent: 'blue' as const,
    },
    {
        title: 'Commuter Guides',
        desc: 'Route guides, jeepney/bus schedules, and transportation tips for students commuting to RTU.',
        icon: Bus,
        accent: 'gold' as const,
    },
    {
        title: 'Student Handbooks & Guides',
        desc: 'Academic calendars, enrollment guides, org registration procedures, and other essential student resources.',
        icon: BookOpen,
        accent: 'blue' as const,
    },
];

const accentStyles = {
    blue: { bg: 'rgba(0, 43, 127, 0.1)', color: 'var(--rtu-blue)' },
    gold: { bg: 'rgba(212, 168, 67, 0.1)', color: 'var(--rtu-gold-dark)' },
};

export default function HubPage() {
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

    const openLightbox = () => {
        setLightboxOpen(true);
        setZoom(1);
        setPan({ x: 0, y: 0 });
    };

    const closeLightbox = () => setLightboxOpen(false);

    const zoomIn = useCallback(() => setZoom((z) => Math.min(z + 0.5, 4)), []);
    const zoomOut = useCallback(() => setZoom((z) => Math.max(z - 0.5, 0.5)), []);
    const resetView = useCallback(() => { setZoom(1); setPan({ x: 0, y: 0 }); }, []);

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        setDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }, [pan]);

    const handlePointerMove = useCallback((e: React.PointerEvent) => {
        if (!dragging) return;
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy });
    }, [dragging]);

    const handlePointerUp = useCallback(() => setDragging(false), []);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        setZoom((z) => {
            const delta = e.deltaY > 0 ? -0.15 : 0.15;
            return Math.min(Math.max(z + delta, 0.5), 4);
        });
    }, []);

    return (
        <>
            <section className="bg-gradient-rtu page-header">
                <div className="container-main text-center">
                    <MapPin className="mx-auto mb-4 text-white/80" size={40} />
                    <h1 className="font-bold text-white mb-3">
                        Student Life <span className="text-gradient-gold">Hub</span>
                    </h1>
                    <p className="text-white/60 max-w-lg mx-auto">
                        Everything you need to navigate campus life — maps, commuter guides, and student resources.
                    </p>
                </div>
            </section>

            <section className="section" style={{ background: 'var(--bg-primary)' }}>
                <div className="container-main">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {hubItems.map((item) => {
                            const style = accentStyles[item.accent];
                            return (
                                <div key={item.title} className="card p-8 flex flex-col items-center text-center relative overflow-hidden">
                                    {/* Coming Soon Overlay */}
                                    <div
                                        className="absolute inset-0 z-10 flex flex-col items-center justify-center"
                                        style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(2px)' }}
                                    >
                                        <Lock size={28} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                                        <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                                            Coming Soon
                                        </span>
                                    </div>

                                    <div
                                        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                                        style={{ background: style.bg, color: style.color }}
                                    >
                                        <item.icon size={28} />
                                    </div>
                                    <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                        {item.desc}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* ── Academic Calendar Section ── */}
            <section className="section" style={{ background: '#F2F1EE' }}>
                <div className="container-main">
                    <div className="text-center mb-10">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5" style={{ background: 'rgba(212, 168, 67, 0.1)', color: 'var(--rtu-gold-dark)' }}>
                            <Calendar size={28} />
                        </div>
                        <h2 className="text-3xl font-bold mb-2 section-heading" style={{ color: 'var(--rtu-blue)' }}>
                            Academic Calendar
                        </h2>
                        <p style={{ color: 'var(--text-muted)' }}>
                            School Year 2026-2027
                        </p>
                    </div>

                    {/* Clickable Calendar Card */}
                    <button
                        onClick={openLightbox}
                        className="card p-2 md:p-6 mx-auto max-w-5xl bg-white shadow-xl rounded-2xl overflow-hidden relative group cursor-pointer block w-full border-0"
                        style={{ transition: 'box-shadow 0.3s' }}
                    >
                        {/* Hover overlay hint */}
                        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: 'rgba(0,0,0,0.35)' }}>
                            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-3" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(4px)' }}>
                                <Search className="text-white" size={28} />
                            </div>
                            <span className="text-white font-semibold text-sm tracking-wide">Click to expand &amp; zoom</span>
                        </div>
                        <div className="relative w-full aspect-[1/1.4] md:aspect-[16/10]">
                            <Image
                                src="/images/ACADEMIC_CALENDAR_2026_2027.jpg"
                                alt="Academic Calendar 2026-2027"
                                fill
                                className="object-contain"
                            />
                        </div>
                    </button>
                </div>
            </section>

            {/* ── Lightbox Modal ── */}
            <AnimatePresence>
                {lightboxOpen && (
                    <motion.div
                        className="fixed inset-0 z-[999] flex items-center justify-center"
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
                        <div className="absolute top-4 right-4 z-[1001] flex items-center gap-2">
                            <button
                                onClick={zoomIn}
                                className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
                                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}
                                aria-label="Zoom in"
                            >
                                <ZoomIn className="text-white" size={18} />
                            </button>
                            <button
                                onClick={zoomOut}
                                className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
                                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}
                                aria-label="Zoom out"
                            >
                                <ZoomOut className="text-white" size={18} />
                            </button>
                            <button
                                onClick={resetView}
                                className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
                                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }}
                                aria-label="Reset view"
                            >
                                <RotateCcw className="text-white" size={18} />
                            </button>
                            <div className="px-3 py-1 rounded-lg text-white/70 text-xs font-mono" style={{ background: 'rgba(255,255,255,0.1)' }}>
                                {Math.round(zoom * 100)}%
                            </div>
                            <button
                                onClick={closeLightbox}
                                className="w-10 h-10 rounded-xl flex items-center justify-center ml-2 transition-colors"
                                style={{ background: 'rgba(220,38,38,0.6)', border: '1px solid rgba(220,38,38,0.8)' }}
                                aria-label="Close lightbox"
                            >
                                <X className="text-white" size={20} />
                            </button>
                        </div>

                        {/* Zoom hint */}
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1001] text-white/40 text-xs tracking-wide">
                            Scroll to zoom · Drag to pan · Click backdrop to close
                        </div>

                        {/* Zoomable Image Container */}
                        <motion.div
                            className="relative z-[1000] w-[90vw] h-[85vh] overflow-hidden rounded-2xl"
                            style={{ background: 'rgba(30,30,30,0.6)', cursor: dragging ? 'grabbing' : 'grab' }}
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
                            <div
                                className="w-full h-full flex items-center justify-center select-none"
                                style={{
                                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                                    transition: dragging ? 'none' : 'transform 0.15s ease-out',
                                }}
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
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
