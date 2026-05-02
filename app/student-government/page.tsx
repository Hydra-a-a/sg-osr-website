"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Building2, ChevronLeft, ChevronRight, Landmark, Scale, Users } from 'lucide-react';
import BackLink from '@/components/BackLink';
import {
    studentGovernmentCouncils,
} from '@/lib/student-government';

const structureCards = [
    {
        title: 'Office of the Student Regent',
        description: 'University-level representation on the Board of Regents, including office updates, advocacy priorities, and announcements.',
        href: '/student-government/osr',
        icon: Scale,
        accent: 'gold' as const,
    },
    {
        title: 'Constitutional Commissions',
        description: 'Independent oversight bodies covering elections, budgeting, appointments, discipline, scholarships, and program review.',
        href: '/student-government/commissions',
        icon: Landmark,
        accent: 'sky' as const,
    },
    {
        title: 'Councils and Institutes',
        description: 'Campus, college, and institute councils representing students across Mandaluyong, Pasig, and academic units.',
        href: '/student-government/councils',
        icon: Users,
        accent: 'lilac' as const,
    },
];

const actionCards = [
    {
        title: 'Open Directory',
        description: 'Find officers, branches, councils, and official contact channels.',
        href: '/directory',
    },
    {
        title: 'Go to Services',
        description: 'Access grievances, proposals, and tracking consoles.',
        href: '/services',
    },
    {
        title: 'Review Transparency',
        description: 'Open reports, resolutions, and accountability records.',
        href: '/transparency',
    },
];

export default function StudentGovernmentPage() {
    const featuredCouncils = useMemo(() => studentGovernmentCouncils, []);

    const [activeCouncilIndex, setActiveCouncilIndex] = useState(0);
    const lastInteraction = useRef(0);

    useEffect(() => {
        lastInteraction.current = Date.now();
    }, []);

    const carouselCount = featuredCouncils.length;
    const safeCouncilIndex = carouselCount === 0 ? 0 : activeCouncilIndex % carouselCount;
    const activeCouncil = featuredCouncils[safeCouncilIndex] || studentGovernmentCouncils[0];

    const nextCouncil = useCallback(() => {
        if (carouselCount < 2) {
            return;
        }

        setActiveCouncilIndex((value) => (value + 1) % carouselCount);
        lastInteraction.current = Date.now();
    }, [carouselCount]);

    const previousCouncil = useCallback(() => {
        if (carouselCount < 2) {
            return;
        }

        setActiveCouncilIndex((value) => (value - 1 + carouselCount) % carouselCount);
        lastInteraction.current = Date.now();
    }, [carouselCount]);

    const jumpToCouncil = useCallback((index: number) => {
        if (carouselCount < 2) {
            return;
        }

        setActiveCouncilIndex(index);
        lastInteraction.current = Date.now();
    }, [carouselCount]);

    useEffect(() => {
        if (carouselCount < 2) {
            return;
        }

        const interval = window.setInterval(() => {
            if (Date.now() - lastInteraction.current < 9000) {
                return;
            }

            setActiveCouncilIndex((value) => (value + 1) % carouselCount);
        }, 5000);

        return () => window.clearInterval(interval);
    }, [carouselCount]);

    return (
        <>
            <section className="portal-section-slate section">
                <div className="portal-noise-overlay" aria-hidden="true" />
                <div className="container-main relative z-10">
                    <BackLink href="/" label="Back to Home" className="mb-8 text-slate-200 hover:text-white transition-colors" />
                    <div className="grid gap-8 md:grid-cols-[1.15fr_0.85fr] md:items-end">
                        <div>
                            <span className="portal-eyebrow">Student Government</span>
                            <h1 className="mt-6 portal-title">
                                Digital Hub of{' '}
                                <span className="relative inline-grid align-baseline" data-council={activeCouncil.id}>
                                    <AnimatePresence mode="wait" initial={false}>
                                        <motion.span
                                            key={activeCouncil.id}
                                            className="sg-council-text-gradient col-start-1 row-start-1"
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -6 }}
                                            transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                                        >
                                            RTU Student Governance
                                        </motion.span>
                                    </AnimatePresence>
                                </span>
                                
                            </h1>
                            <p className="mt-6 portal-lead">
                                This hub groups the Office of the Student Regent, constitutional commissions, and councils into a single
                                structure so students can navigate the governance system without guessing which page owns which body.
                            </p>
                            <div className="mt-10 flex flex-wrap gap-4">
                                <Link href="/student-government/councils" className="btn-primary no-underline">
                                    Explore Councils
                                </Link>
                                <Link href="/student-government/commissions" className="btn-secondary no-underline">
                                    View Commissions
                                </Link>
                            </div>
                        </div>

                        <div className="portal-panel p-6 md:p-8">
                            <div className="relative rounded-3xl border border-white/10 bg-white/[0.03] p-4 md:p-5">
                                <div
                                    className="sg-council-glow-layer pointer-events-none absolute inset-0 rounded-3xl blur-[44px] transition-colors duration-500"
                                    data-council={activeCouncil.id}
                                />
                                <div className="relative flex h-48 items-center justify-center overflow-hidden rounded-2xl bg-white/[0.04] md:h-52">
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={activeCouncil.id}
                                            initial={{ opacity: 0, scale: 0.94, y: 10 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.98, y: -8 }}
                                            transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                                            className="sg-council-logo-wrap relative h-40 w-40 md:h-44 md:w-44"
                                            data-council={activeCouncil.id}
                                        >
                                            <Image
                                                src={activeCouncil.src}
                                                alt={activeCouncil.name}
                                                fill
                                                sizes="(max-width: 768px) 160px, 176px"
                                                className="object-contain rounded-full"
                                            />
                                        </motion.div>
                                    </AnimatePresence>
                                </div>

                                <div className="relative mt-4 flex items-center justify-between">
                                    <button
                                        type="button"
                                        onClick={previousCouncil}
                                        className="hero-control-btn"
                                        aria-label="Previous council"
                                        disabled={carouselCount < 2}
                                    >
                                        <ChevronLeft className="text-white" size={18} />
                                    </button>

                                    <div className="text-center">
                                        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-white/60">
                                            {activeCouncil.abbr}
                                        </p>
                                        <p className="mt-1 text-sm font-medium text-white/90">{activeCouncil.name}</p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={nextCouncil}
                                        className="hero-control-btn"
                                        aria-label="Next council"
                                        disabled={carouselCount < 2}
                                    >
                                        <ChevronRight className="text-white" size={18} />
                                    </button>
                                </div>

                                {carouselCount > 1 && (
                                    <div className="relative mt-4 flex justify-center gap-2.5">
                                        {featuredCouncils.map((council, index) => (
                                            <button
                                                key={council.id}
                                                type="button"
                                                onClick={() => jumpToCouncil(index)}
                                                className="sg-council-dot h-2.5 w-2.5 rounded-full transition-all duration-300"
                                                data-council={council.id}
                                                data-active={index === safeCouncilIndex}
                                                aria-label={`Switch to ${council.abbr}`}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="portal-section-dark section">
                <div className="portal-noise-overlay" aria-hidden="true" />
                <div className="container-main relative z-10">
                    <div className="grid gap-6 md:grid-cols-3">
                        {structureCards.map((card) => {
                            const Icon = card.icon;

                            return (
                                <article key={card.title} className="portal-panel portal-accent-card sg-hover-card p-7 md:p-8" data-accent={card.accent}>
                                    <div className="portal-accent-chip mb-6 flex h-14 w-14 items-center justify-center rounded-2xl" data-accent={card.accent}>
                                        <Icon size={28} />
                                    </div>
                                    <h2 className="text-2xl font-bold text-white">{card.title}</h2>
                                    <p className="mt-4 text-sm leading-7 text-slate-300">{card.description}</p>
                                    <Link href={card.href} className="portal-accent-link sg-inline-link mt-6 inline-flex items-center gap-2 text-sm font-semibold no-underline" data-accent={card.accent}>
                                        Open section <ArrowRight size={16} />
                                    </Link>
                                </article>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="portal-section-slate section">
                <div className="portal-noise-overlay" aria-hidden="true" />
                <div className="container-main relative z-10 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                    <div className="portal-panel p-7 md:p-10">
                        <div className="flex items-center gap-3 text-[var(--rtu-gold-light)]">
                            <Building2 size={20} />
                            <span className="portal-kicker">Governance Map</span>
                        </div>
                        <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">How the structure is organized</h2>
                        <div className="mt-8 grid gap-4 md:grid-cols-3">
                            <div className="portal-panel-soft p-5">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">University-wide</p>
                                <p className="mt-3 text-lg font-semibold text-white">SSC and OSR</p>
                                <p className="mt-2 text-sm leading-7 text-slate-300">Top-level representation, regent advocacy, and major governance actions.</p>
                            </div>
                            <div className="portal-panel-soft p-5">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Campus-level</p>
                                <p className="mt-3 text-lg font-semibold text-white">Central Councils</p>
                                <p className="mt-2 text-sm leading-7 text-slate-300">Mandaluyong and Pasig councils handling branch-specific student needs.</p>
                            </div>
                            <div className="portal-panel-soft p-5">
                                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Academic units</p>
                                <p className="mt-3 text-lg font-semibold text-white">College and Institute Councils</p>
                                <p className="mt-2 text-sm leading-7 text-slate-300">Representation tailored to each college, institute, and discipline.</p>
                            </div>
                        </div>
                    </div>

                    <div className="portal-panel p-7 md:p-10">
                        <span className="portal-kicker">Portal Actions</span>
                        <div className="mt-6 space-y-4">
                            {actionCards.map((card) => (
                                <Link key={card.title} href={card.href} className="portal-link-card sg-hover-card sg-inline-link p-5">
                                    <p className="text-lg font-semibold text-white">{card.title}</p>
                                    <p className="mt-2 text-sm leading-7 text-slate-300">{card.description}</p>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}
