"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
    ArrowRightIcon,
    BuildingLibraryIcon,
    ChevronLeftIcon,
    ChevronRightIcon,
    ScaleIcon,
    UserGroupIcon,
} from '@heroicons/react/24/outline';
import BackLink from '@/components/BackLink';
import {
    studentGovernmentCouncils,
} from '@/lib/student-government';

const structureCards = [
    {
        title: 'Office of the Student Regent',
        description: 'University-level representation on the Board of Regents, including office updates, advocacy priorities, and announcements.',
        href: '/student-government/osr',
        icon: ScaleIcon,
        accent: 'gold' as const,
    },
    {
        title: 'Constitutional Commissions',
        description: 'Independent oversight bodies covering elections, budgeting, appointments, discipline, scholarships, and program review.',
        href: '/student-government/commissions',
        icon: BuildingLibraryIcon,
        accent: 'sky' as const,
    },
    {
        title: 'Councils and Institutes',
        description: 'Campus, college, and institute councils representing students across Mandaluyong, Pasig, and academic units.',
        href: '/student-government/councils',
        icon: UserGroupIcon,
        accent: 'lilac' as const,
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
            <section className="portal-section-slate section sg-hub-hero-section">
                <div className="portal-noise-overlay" aria-hidden="true" />
                <div className="container-main relative z-10">
                    <BackLink href="/" label="Back to Home" className="mb-8 text-slate-200 hover:text-white transition-colors sg-hub-back-link" />
                    <div className="grid gap-8 md:grid-cols-[1.15fr_0.85fr] md:items-end sg-hub-hero-grid">
                        <div className="sg-hub-copy">
                            <span className="sg-hub-kicker-line">Student Government</span>
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
                            <div className="mt-10 flex flex-wrap gap-4 sg-hub-cta-row">
                                <Link href="/student-government/councils" className="btn-primary no-underline">
                                    Explore Councils
                                </Link>
                                <Link href="/student-government/commissions" className="btn-secondary no-underline">
                                    View Commissions
                                </Link>
                            </div>
                        </div>

                        <div className="sg-hub-stage-wrap">
                            <div className="sg-hub-stage" data-council={activeCouncil.id}>
                            <div className="sg-hub-stage-grid" aria-hidden="true" />
                            <div className="sg-hub-stage-core-zone">
                                <span className="sg-hub-stage-orbit sg-hub-stage-orbit-lg" aria-hidden="true" />
                                <span className="sg-hub-stage-orbit sg-hub-stage-orbit-md" aria-hidden="true" />
                                <span className="sg-hub-stage-orbit sg-hub-stage-orbit-sm" aria-hidden="true" />
                                <button
                                    type="button"
                                    onClick={previousCouncil}
                                    className="sg-hub-stage-nav sg-hub-stage-nav-prev"
                                    aria-label="Previous council"
                                    disabled={carouselCount < 2}
                                >
                                    <ChevronLeftIcon className="h-[18px] w-[18px]" aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    onClick={nextCouncil}
                                    className="sg-hub-stage-nav sg-hub-stage-nav-next"
                                    aria-label="Next council"
                                    disabled={carouselCount < 2}
                                >
                                    <ChevronRightIcon className="h-[18px] w-[18px]" aria-hidden="true" />
                                </button>
                                <AnimatePresence mode="wait">
                                    <motion.div
                                        key={activeCouncil.id}
                                        initial={{ opacity: 0, scale: 0.94, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.98, y: -8 }}
                                        transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                                        className="sg-hub-stage-core sg-council-logo-wrap relative"
                                        data-council={activeCouncil.id}
                                    >
                                        <Image
                                            src={activeCouncil.src}
                                            alt={activeCouncil.name}
                                            fill
                                            sizes="(max-width: 768px) 152px, 176px"
                                            className="object-contain rounded-full"
                                        />
                                    </motion.div>
                                </AnimatePresence>
                            </div>

                            <div className="sg-hub-stage-meta">
                                <p className="sg-hub-stage-abbr">{activeCouncil.abbr}</p>
                                <p className="sg-hub-stage-name">{activeCouncil.name}</p>
                            </div>

                            {carouselCount > 1 && (
                                <div className="sg-hub-stage-pager">
                                    {featuredCouncils.map((council, index) => (
                                        <button
                                            key={council.id}
                                            type="button"
                                            onClick={() => jumpToCouncil(index)}
                                            className="sg-hub-stage-dot"
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
                    <div className="sg-structure-stack">
                        {structureCards.map((card) => {
                            const Icon = card.icon;

                            return (
                                <article key={card.title} className="sg-structure-lane" data-accent={card.accent}>
                                    <div className="sg-structure-header">
                                        <div className="sg-structure-icon portal-accent-chip" data-accent={card.accent}>
                                            <Icon className="h-7 w-7" aria-hidden="true" />
                                        </div>
                                        <h2 className="sg-structure-title">{card.title}</h2>
                                    </div>
                                    <div className="sg-structure-copy">
                                        <p className="sg-structure-description">{card.description}</p>
                                    </div>
                                    <div className="sg-structure-footer">
                                        <Link href={card.href} className="sg-structure-link portal-accent-link sg-inline-link no-underline" data-accent={card.accent}>
                                            Open section <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
                                        </Link>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </div>
            </section>

        </>
    );
}
