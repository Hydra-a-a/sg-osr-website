'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import useSWR from 'swr';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
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
    {
        id: 'mccsc',
        name: 'Mandaluyong Campus Central Student Council',
        abbr: 'MCCSC',
        src: '/images/MCCSC.png',
        glow: 'rgba(126, 34, 206, 0.5)',
        gradientFrom: '#7e22ce',
        gradientTo: '#fbbf24',
    },
    {
        id: 'cassc',
        name: 'College of Arts and Sciences Student Council',
        abbr: 'CASSC',
        src: '/images/RTU_CASSC.jpg',
        glow: 'rgba(22, 163, 74, 0.5)',
        gradientFrom: '#15803d',
        gradientTo: '#4ade80',
    },
    {
        id: 'cedsc',
        name: 'College of Education Student Council',
        abbr: 'CEDSC',
        src: '/images/RTU_CEDSC.jpg',
        glow: 'rgba(37, 99, 235, 0.45)',
        gradientFrom: '#1d4ed8',
        gradientTo: '#f59e0b',
    },
    {
        id: 'iasc',
        name: 'Institute of Architecture Student Council',
        abbr: 'IASC',
        src: '/images/RTU_IASC.jpg',
        glow: 'rgba(220, 38, 38, 0.45)',
        gradientFrom: '#b91c1c',
        gradientTo: '#ef4444',
    },
    {
        id: 'icssc',
        name: 'Institute of Computer Studies Student Council',
        abbr: 'ICSSC',
        src: '/images/RTU_ICSSC.jpg',
        glow: 'rgba(37, 99, 235, 0.45)',
        gradientFrom: '#2563eb',
        gradientTo: '#a855f7',
    },
    {
        id: 'ihksc',
        name: 'Institute of Human Kinetics Student Council',
        abbr: 'IHKSC',
        src: '/images/RTU_IHKSC.jpg',
        glow: 'rgba(217, 70, 239, 0.45)',
        gradientFrom: '#d946ef',
        gradientTo: '#f0abfc',
    },
    {
        id: 'pccsc',
        name: 'Pasig Campus Central Student Council',
        abbr: 'PCCSC',
        src: '/images/RTU_PCCSC.jpg',
        glow: 'rgba(185, 28, 28, 0.5)',
        gradientFrom: '#b91c1c',
        gradientTo: '#f59e0b',
    },
];

export default function Hero() {
    const { data: linksResponse } = useSWR('/api/config/links', (url: string) => fetch(url).then(r => r.json()));
    const links: QuickLink[] = linksResponse?.data || [];
    const prefersReducedMotion = useReducedMotion();
    const [isMotionConservative, setIsMotionConservative] = useState(false);
    const [isHeroInView, setIsHeroInView] = useState(true);
    const [isPageVisible, setIsPageVisible] = useState(true);
    const [activeIdx, setActiveIdx] = useState(0);
    const lastInteraction = useRef(0);
    const sectionRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        const nav = navigator as Navigator & { deviceMemory?: number };
        const mobileViewport = window.matchMedia('(max-width: 900px)').matches;
        const noHoverInput = window.matchMedia('(hover: none)').matches;
        const lowCpu = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 6;
        const lowMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4;

        const frame = window.requestAnimationFrame(() => {
            if (mobileViewport && (noHoverInput || lowCpu || lowMemory)) {
                setIsMotionConservative(true);
            }
        });

        return () => window.cancelAnimationFrame(frame);
    }, []);

    const reduceHeroMotion = prefersReducedMotion || isMotionConservative;
    const activeCouncilIndex = reduceHeroMotion ? 0 : activeIdx;

    useEffect(() => {
        lastInteraction.current = Date.now();
    }, []);

    useEffect(() => {
        const section = sectionRef.current;
        if (!section) {
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsHeroInView(entry.isIntersecting);
            },
            { threshold: 0.1 }
        );

        observer.observe(section);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const onVisibilityChange = () => {
            setIsPageVisible(document.visibilityState === 'visible');
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }, []);

    const next = useCallback(() => {
        if (reduceHeroMotion) {
            return;
        }
        setActiveIdx((i) => (i + 1) % councils.length);
        lastInteraction.current = Date.now();
    }, [reduceHeroMotion]);

    const prev = useCallback(() => {
        if (reduceHeroMotion) {
            return;
        }
        setActiveIdx((i) => (i - 1 + councils.length) % councils.length);
        lastInteraction.current = Date.now();
    }, [reduceHeroMotion]);

    const jumpTo = useCallback((idx: number) => {
        if (reduceHeroMotion) {
            return;
        }
        setActiveIdx(idx);
        lastInteraction.current = Date.now();
    }, [reduceHeroMotion]);

    // auto-rotate every 5 seconds, but only if user hasn't interacted for 10 seconds
    useEffect(() => {
        if (reduceHeroMotion || !isHeroInView || !isPageVisible) {
            return;
        }

        const interval = setInterval(() => {
            const now = Date.now();
            if (now - lastInteraction.current > 10000) {
                setActiveIdx((i) => (i + 1) % councils.length);
            }
        }, 5000);
        return () => clearInterval(interval);
    }, [reduceHeroMotion, isHeroInView, isPageVisible]);

    const heroLinks = links.length > 0 ? links.slice(0, 3) : [
        { id: '1', label: 'Student Grievances', desc: 'Use the Official Student Grievance Form', href: '/services', icon: 'FileText' },
        { id: '2', label: 'Directory', desc: 'A unified directory for all administrative offices, organizations, and councils of Rizal Technological University', href: '/directory', icon: 'Users' },
        { id: '3', label: 'Latest News', desc: 'Stay updated with the latest announcements', href: '/news', icon: 'Newspaper' },
    ];

    const active = councils[activeCouncilIndex];
    const leftIdx = (activeCouncilIndex - 1 + councils.length) % councils.length;
    const rightIdx = (activeCouncilIndex + 1) % councils.length;

    return (
        <section ref={sectionRef} className="hero-banner bg-gradient-rtu relative overflow-hidden min-h-[84vh] md:min-h-[90vh] flex items-center">

            {/* Animated dot grid background for depth */}
            {!reduceHeroMotion && (
                <div className="absolute inset-0 pointer-events-none z-0">
                    <div className="hero-dot-grid" />
                </div>
            )}

            {!reduceHeroMotion && (
                <>
                    <div
                        className="absolute -top-40 -right-40 w-96 max-w-[50vw] h-96 rounded-full opacity-10 pointer-events-none"
                        style={{ background: 'var(--rtu-gold)' }}
                    />
                    <div
                        className="absolute -bottom-20 -left-20 w-72 max-w-[40vw] h-72 rounded-full opacity-10 pointer-events-none"
                        style={{ background: 'var(--rtu-gold-light)' }}
                    />
                </>
            )}

            <div className="container-main relative z-10 py-16 md:py-24 lg:py-28">
                <div className="flex flex-col md:flex-row items-center gap-10 lg:gap-14">

                    <motion.div
                        suppressHydrationWarning
                        className="flex-1 text-center md:text-left"
                        initial={reduceHeroMotion ? false : { opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={reduceHeroMotion ? { duration: 0 } : { duration: 0.6, ease: 'easeOut' }}
                    >
                        <p
                            className="text-sm font-semibold tracking-widest uppercase mb-4"
                            style={{ color: 'var(--rtu-gold-light)' }}
                        >
                            Rizal Technological University
                        </p>
                        <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-5 md:mb-6 min-h-[3em] md:min-h-0">
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
                                transition={reduceHeroMotion ? { duration: 0 } : { duration: 0.4 }}
                            >
                                Government Portal
                            </motion.span>
                        </h1>
                        <p className="text-base md:text-lg text-white/70 max-w-xl mb-7 md:mb-8">
                            Empowering Rizalianos through transparent, responsive, and inclusive student governance.
                            The unified digital home of the Supreme Student Council, its Constitutional Commissions,
                            and the Office of the Student Regent.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                            <Link href="/services" className="btn-primary text-base no-underline text-center">
                                Access Services
                            </Link>
                            <Link href="/about" className="btn-secondary text-base no-underline text-center">
                                {`About ${active.abbr}`}
                            </Link>
                        </div>
                    </motion.div>


                    {/* ── Logo Carousel ── */}
                    <motion.div
                        suppressHydrationWarning
                        className="flex-shrink-0 w-full md:w-auto"
                        initial={reduceHeroMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={reduceHeroMotion ? { duration: 0 } : { duration: 0.6, delay: 0.15, ease: 'easeOut' }}
                    >
                        <div className="relative flex flex-col items-center">
                            {/* Logo stage */}
                            <div className="relative w-full max-w-[20rem] md:max-w-[22rem] h-60 md:h-72 flex items-center justify-center">
                                {/* Dynamic glow */}
                                {!reduceHeroMotion && (
                                    <motion.div
                                        className="absolute inset-[10%] rounded-full blur-[40px] md:blur-[50px] z-0"
                                        animate={{ background: active.glow }}
                                        transition={{ duration: 0.6 }}
                                        style={{ opacity: 0.5 }}
                                    />
                                )}

                                {/* Left (prev) logo */}
                                {!reduceHeroMotion && (
                                    <motion.div
                                        key={`left-${leftIdx}`}
                                        className="absolute hidden md:block w-28 h-28 md:w-36 md:h-36 z-10 cursor-pointer"
                                        style={{ left: '-5%', top: '50%' }}
                                        onClick={prev}
                                        initial={{ opacity: 0, x: 20, y: '-50%', scale: 0.7 }}
                                        animate={{ opacity: 0.4, x: 0, y: '-50%', scale: 0.7 }}
                                        exit={{ opacity: 0, x: 20, y: '-50%', scale: 0.7 }}
                                        transition={{ duration: 0.5 }}
                                        whileHover={{ opacity: 0.7, scale: 0.75, y: '-50%' }}
                                    >
                                        <Image
                                            src={councils[leftIdx].src}
                                            alt={councils[leftIdx].name}
                                            fill
                                            sizes="(max-width: 768px) 0px, 144px"
                                            className="object-contain rounded-full brightness-75 transition-all"
                                        />
                                    </motion.div>
                                )}

                                {/* Center (active) logo */}
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={`center-${activeCouncilIndex}`}
                                        className="absolute w-48 h-48 md:w-56 md:h-56 z-20 flex items-center justify-center"
                                        style={{ top: '50%', left: '50%' }}
                                        initial={{ opacity: 0, scale: 0.8, x: '-50%', y: '-50%' }}
                                        animate={{ opacity: 1, scale: 1, x: '-50%', y: '-50%' }}
                                        exit={{ opacity: 0, scale: 0.8, x: '-50%', y: '-50%' }}
                                        transition={reduceHeroMotion ? { duration: 0 } : { duration: 0.45, ease: 'easeOut' }}
                                    >
                                        <div className={`w-full h-full relative flex items-center justify-center ${reduceHeroMotion ? '' : 'animate-float'}`}>
                                            <Image
                                                src={active.src}
                                                alt={active.name}
                                                fill
                                                sizes="(max-width: 768px) 192px, 224px"
                                                className="object-contain rounded-full shadow-2xl"
                                                style={{
                                                    filter: reduceHeroMotion ? 'none' : `drop-shadow(0 12px 32px ${active.glow})`,
                                                }}
                                                priority
                                            />
                                        </div>
                                    </motion.div>
                                </AnimatePresence>

                                {/* Right (next) logo */}
                                {!reduceHeroMotion && (
                                    <motion.div
                                        key={`right-${rightIdx}`}
                                        className="absolute hidden md:block w-28 h-28 md:w-36 md:h-36 z-10 cursor-pointer"
                                        style={{ right: '-5%', top: '50%' }}
                                        onClick={next}
                                        initial={{ opacity: 0, x: -20, y: '-50%', scale: 0.7 }}
                                        animate={{ opacity: 0.4, x: 0, y: '-50%', scale: 0.7 }}
                                        exit={{ opacity: 0, x: -20, y: '-50%', scale: 0.7 }}
                                        transition={{ duration: 0.5 }}
                                        whileHover={{ opacity: 0.7, scale: 0.75, y: '-50%' }}
                                    >
                                        <Image
                                            src={councils[rightIdx].src}
                                            alt={councils[rightIdx].name}
                                            fill
                                            sizes="(max-width: 768px) 0px, 144px"
                                            className="object-contain rounded-full brightness-75 transition-all"
                                        />
                                    </motion.div>
                                )}
                            </div>

                            {/* Navigation arrows + label */}
                            <div className="flex items-center gap-4 mt-4 md:mt-6">
                                <button
                                    onClick={prev}
                                    className="hero-control-btn"
                                    aria-label="Previous council"
                                    disabled={reduceHeroMotion}
                                >
                                    <ChevronLeft className="text-white" size={20} />
                                </button>

                                <AnimatePresence mode="wait">
                                    <motion.span
                                        key={active.id}
                                        className="text-sm font-bold uppercase tracking-widest min-w-[6rem] text-center"
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
                                    className="hero-control-btn"
                                    aria-label="Next council"
                                    disabled={reduceHeroMotion}
                                >
                                    <ChevronRight className="text-white" size={20} />
                                </button>
                            </div>

                            {/* Dot indicators */}
                            {!reduceHeroMotion && (
                                <div className="flex gap-3 mt-4">
                                    {councils.map((c, i) => (
                                        <button
                                            key={c.id}
                                            onClick={() => jumpTo(i)}
                                            className="w-2.5 h-2.5 rounded-full transition-all duration-300"
                                            style={{
                                                background: i === activeCouncilIndex ? active.gradientFrom : 'rgba(255,255,255,0.2)',
                                                transform: i === activeCouncilIndex ? 'scale(1.3)' : 'scale(1)',
                                                boxShadow: i === activeCouncilIndex ? `0 0 10px ${active.glow}` : 'none'
                                            }}
                                            aria-label={`Switch to ${c.abbr}`}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>


                <motion.div
                    suppressHydrationWarning
                    className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mt-12 md:mt-16"
                    initial={reduceHeroMotion ? false : { opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={reduceHeroMotion ? { duration: 0 } : { duration: 0.5, delay: 0.3, ease: 'easeOut' }}
                >
                    {heroLinks.map((item) => {

                        const IconComponent = iconMap[item.icon || 'ExternalLink'] || ExternalLink;

                        return (
                            <Link
                                key={item.label}
                                href={item.href}
                                className="hero-quick-card hero-quick-card-shell card p-6 flex items-start gap-4 no-underline group"
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
                suppressHydrationWarning
                className="absolute bottom-5 md:bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-10"
                initial={reduceHeroMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={reduceHeroMotion ? { duration: 0 } : { delay: 1, duration: 0.8 }}
            >
                <span className="text-white/30 text-[10px] uppercase tracking-[0.2em]">Explore</span>
                <motion.div
                    animate={reduceHeroMotion ? { y: 0 } : { y: [0, 6, 0] }}
                    transition={reduceHeroMotion ? { duration: 0 } : { repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                >
                    <ChevronDown className="text-white/30" size={20} />
                </motion.div>
            </motion.div>
        </section>
    );
}
