'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Users, Newspaper, ExternalLink, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { QuickLink } from '@/schemas/links';

// hardcoded icons because barrel imports made vercel cry
const iconMap: Record<string, LucideIcon> = {
    FileText, Users, Newspaper, ExternalLink,
};

/* ── Council palette definitions ── */
const councils = [
    {
        id: 'ssc',
        name: 'Supreme Student Council',
        abbr: 'SSC',
        src: '/images/RTU_SSC.jpg',
        glow: 'rgba(212, 168, 67, 0.45)',
        gradientFrom: '#d4a843',
        gradientTo: '#f5d98a',
    },
    {
        id: 'cengsc',
        name: 'College of Engineering Student Council',
        abbr: 'CEngSC',
        src: '/images/RTU_CEngSC.jpg',
        glow: 'rgba(220, 110, 30, 0.45)',
        gradientFrom: '#e07020',
        gradientTo: '#fbb040',
    },
    {
        id: 'cbeasc',
        name: 'CBEA Student Council',
        abbr: 'CBEASC',
        src: '/images/RTU_CBEASC.jpg',
        glow: 'rgba(204, 207, 36, 0.87)',
        gradientFrom: '#dad73eff',
        gradientTo: '#dee080ff',
    },
];

export default function Hero() {
    const [links, setLinks] = useState<QuickLink[]>([]);
    const [activeIdx, setActiveIdx] = useState(0);

    const next = useCallback(() => setActiveIdx((i) => (i + 1) % councils.length), []);
    const prev = useCallback(() => setActiveIdx((i) => (i - 1 + councils.length) % councils.length), []);

    // auto-rotate every 5 seconds
    useEffect(() => {
        const id = setInterval(next, 5000);
        return () => clearInterval(id);
    }, [next]);

    useEffect(() => {
        async function fetchLinks() {
            try {
                const res = await fetch('/api/config/links');
                const data = await res.json();
                if (data.data) {
                    setLinks(data.data);
                }
            } catch (err) {
                console.error("Failed to load hero links", err);
            }
        }
        fetchLinks();
    }, []);

    const heroLinks = links.length > 0 ? links.slice(0, 3) : [
        { id: '1', label: 'Services & Forms', desc: 'Need student assistance?', href: '/services', icon: 'FileText' },
        { id: '2', label: 'Officer Directory', desc: 'Meet our student leaders', href: '/directory', icon: 'Users' },
        { id: '3', label: 'Latest News', desc: 'Stay updated with SG', href: '/news', icon: 'Newspaper' },
    ];

    const active = councils[activeIdx];
    const leftIdx = (activeIdx - 1 + councils.length) % councils.length;
    const rightIdx = (activeIdx + 1) % councils.length;

    return (
        <section className="bg-gradient-rtu relative overflow-hidden min-h-[90vh] flex items-center">

            {/* Animated dot grid background for depth */}
            <div className="absolute inset-0 pointer-events-none z-0">
                <div className="hero-dot-grid" />
            </div>

            <div
                className="absolute -top-40 -right-40 w-96 max-w-[50vw] h-96 rounded-full opacity-10 pointer-events-none"
                style={{ background: 'var(--rtu-gold)' }}
            />
            <div
                className="absolute -bottom-20 -left-20 w-72 max-w-[40vw] h-72 rounded-full opacity-10 pointer-events-none"
                style={{ background: 'var(--rtu-gold-light)' }}
            />

            <div className="container-main relative z-10 py-32">
                <div className="flex flex-col md:flex-row items-center gap-12">

                    <motion.div
                        className="flex-1 text-center md:text-left"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                    >
                        <p
                            className="text-sm font-semibold tracking-widest uppercase mb-4"
                            style={{ color: 'var(--rtu-gold-light)' }}
                        >
                            Rizal Technological University
                        </p>
                        <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
                            RTU Student{' '}
                            <motion.span
                                key={active.id}
                                className="inline-block"
                                style={{
                                    background: `linear-gradient(135deg, ${active.gradientFrom}, ${active.gradientTo})`,
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text',
                                }}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.4 }}
                            >
                                Government Portal
                            </motion.span>
                        </h1>
                        <p className="text-lg text-white/70 max-w-xl mb-8">
                            Empowering Rizalinos through transparency, service, and inclusive governance.
                            The unified digital home of the Supreme Student Council and the Office of the Student Regent.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                            <Link href="/services" className="btn-primary text-base no-underline text-center">
                                Access Services
                            </Link>
                            <Link href="/osr" className="btn-secondary text-base no-underline text-center">
                                About OSR
                            </Link>
                        </div>
                    </motion.div>


                    {/* ── Logo Carousel ── */}
                    <motion.div
                        className="flex-shrink-0"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
                    >
                        <div className="relative flex flex-col items-center">
                            {/* Logo stage */}
                            <div className="relative w-72 h-56 md:w-[22rem] md:h-72 flex items-center justify-center">
                                {/* Dynamic glow */}
                                <motion.div
                                    className="absolute inset-[-16px] rounded-full blur-[50px] z-0"
                                    animate={{ background: active.glow }}
                                    transition={{ duration: 0.6 }}
                                    style={{ opacity: 0.5 }}
                                />

                                {/* Left (prev) logo */}
                                <motion.div
                                    key={`left-${leftIdx}`}
                                    className="absolute w-24 h-24 md:w-36 md:h-36 z-10 cursor-pointer"
                                    style={{ left: 0 }}
                                    onClick={prev}
                                    initial={{ opacity: 0, x: 30, scale: 0.7 }}
                                    animate={{ opacity: 0.55, x: 0, scale: 0.75 }}
                                    exit={{ opacity: 0, x: 30, scale: 0.7 }}
                                    transition={{ duration: 0.5, ease: 'easeOut' }}
                                    whileHover={{ opacity: 0.85, scale: 0.82 }}
                                >
                                    <Image
                                        src={councils[leftIdx].src}
                                        alt={councils[leftIdx].name}
                                        fill
                                        className="object-contain rounded-full"
                                        style={{ filter: 'brightness(0.7)' }}
                                    />
                                </motion.div>

                                {/* Center (active) logo */}
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={`center-${activeIdx}`}
                                        className="absolute w-44 h-44 md:w-56 md:h-56 z-20"
                                        style={{ left: '50%', marginLeft: '-7rem', top: '50%', marginTop: '-7rem' }}
                                        initial={{ opacity: 0, scale: 0.85 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.85 }}
                                        transition={{ duration: 0.45, ease: 'easeOut' }}
                                    >
                                        <div className="w-full h-full animate-float relative">
                                            <Image
                                                src={active.src}
                                                alt={active.name}
                                                fill
                                                className="object-contain rounded-full"
                                                style={{
                                                    filter: `drop-shadow(0 12px 32px ${active.glow})`,
                                                }}
                                                priority
                                            />
                                        </div>
                                    </motion.div>
                                </AnimatePresence>

                                {/* Right (next) logo */}
                                <motion.div
                                    key={`right-${rightIdx}`}
                                    className="absolute w-24 h-24 md:w-36 md:h-36 z-10 cursor-pointer"
                                    style={{ right: 0 }}
                                    onClick={next}
                                    initial={{ opacity: 0, x: -30, scale: 0.7 }}
                                    animate={{ opacity: 0.55, x: 0, scale: 0.75 }}
                                    exit={{ opacity: 0, x: -30, scale: 0.7 }}
                                    transition={{ duration: 0.5, ease: 'easeOut' }}
                                    whileHover={{ opacity: 0.85, scale: 0.82 }}
                                >
                                    <Image
                                        src={councils[rightIdx].src}
                                        alt={councils[rightIdx].name}
                                        fill
                                        className="object-contain rounded-full"
                                        style={{ filter: 'brightness(0.7)' }}
                                    />
                                </motion.div>
                            </div>

                            {/* Navigation arrows + label */}
                            <div className="flex items-center gap-4 mt-4">
                                <button
                                    onClick={prev}
                                    className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
                                    aria-label="Previous council"
                                >
                                    <ChevronLeft className="text-white/70" size={18} />
                                </button>

                                <AnimatePresence mode="wait">
                                    <motion.span
                                        key={active.id}
                                        className="text-xs font-bold uppercase tracking-widest min-w-[5rem] text-center"
                                        style={{
                                            background: `linear-gradient(135deg, ${active.gradientFrom}, ${active.gradientTo})`,
                                            WebkitBackgroundClip: 'text',
                                            WebkitTextFillColor: 'transparent',
                                            backgroundClip: 'text',
                                        }}
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -6 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        {active.abbr}
                                    </motion.span>
                                </AnimatePresence>

                                <button
                                    onClick={next}
                                    className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                                    style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
                                    aria-label="Next council"
                                >
                                    <ChevronRight className="text-white/70" size={18} />
                                </button>
                            </div>

                            {/* Dot indicators */}
                            <div className="flex gap-2 mt-3">
                                {councils.map((c, i) => (
                                    <button
                                        key={c.id}
                                        onClick={() => setActiveIdx(i)}
                                        className="w-2 h-2 rounded-full transition-all duration-300"
                                        style={{
                                            background: i === activeIdx ? active.gradientFrom : 'rgba(255,255,255,0.25)',
                                            transform: i === activeIdx ? 'scale(1.4)' : 'scale(1)',
                                        }}
                                        aria-label={`Switch to ${c.abbr}`}
                                    />
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </div>


                <motion.div
                    className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
                >
                    {heroLinks.map((item) => {

                        const IconComponent = iconMap[item.icon || 'ExternalLink'] || ExternalLink;

                        return (
                            <Link
                                key={item.label}
                                href={item.href}
                                className="hero-quick-card card p-6 flex items-start gap-4 no-underline group"
                                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}
                            >
                                <IconComponent className="text-white/80 mt-1 group-hover:text-white transition-colors" size={24} />
                                <div>
                                    <h3 className="text-white font-semibold text-base mb-1">{item.label}</h3>
                                    <p className="text-white/50 text-sm">{item.desc}</p>
                                </div>
                            </Link>
                        );
                    })}
                </motion.div>
            </div>

            {/* Scroll indicator */}
            <motion.div
                className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1, duration: 0.8 }}
            >
                <span className="text-white/30 text-[10px] uppercase tracking-[0.2em]">Explore</span>
                <motion.div
                    animate={{ y: [0, 6, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                >
                    <ChevronDown className="text-white/30" size={20} />
                </motion.div>
            </motion.div>
        </section>
    );
}
