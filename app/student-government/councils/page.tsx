'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import BackLink from '@/components/BackLink';
import {
    isRuntimeLogoSource,
    studentGovernmentCouncils,
} from '@/lib/student-government';

const fadeInUp = {
    hidden: { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0 },
};

const swapIn = {
    hidden: { opacity: 0, y: 14, scale: 0.985 },
    visible: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -8, scale: 0.99 },
};

export default function StudentGovernmentCouncilsPage() {
    const resolvedCouncils = useMemo(() => studentGovernmentCouncils, []);
    const [selectedCouncil, setSelectedCouncil] = useState(0);
    const [scrollRequestId, setScrollRequestId] = useState(0);
    const featuredCouncilRef = useRef<HTMLElement | null>(null);

    const selectedCouncilIndex = resolvedCouncils.length > 0 ? selectedCouncil % resolvedCouncils.length : 0;
    const activeCouncil = resolvedCouncils[selectedCouncilIndex];

    useEffect(() => {
        if (!scrollRequestId || !featuredCouncilRef.current) {
            return;
        }

        const prefersReducedMotion = typeof window !== 'undefined'
            && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        featuredCouncilRef.current.scrollIntoView({
            behavior: prefersReducedMotion ? 'auto' : 'smooth',
            block: 'start',
        });
    }, [selectedCouncilIndex, scrollRequestId]);

    if (!activeCouncil) {
        return null;
    }

    return (
        <>
            <section className="portal-section-slate section">
                <div className="portal-noise-overlay" aria-hidden="true" />
                <div className="container-main relative z-10">
                    <motion.div
                        className="max-w-4xl"
                        initial="hidden"
                        animate="visible"
                        variants={fadeInUp}
                        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <div className="mb-8 flex flex-col items-start gap-3">
                            <BackLink href="/student-government" label="Back to Student Government" className="text-slate-200 hover:text-white transition-colors" />
                            <span className="portal-eyebrow">Councils and Institutes</span>
                        </div>
                        <h1 className="mt-6 portal-title">
                            Representation across campuses, colleges, and institutes.
                        </h1>
                        <p className="mt-6 portal-lead">
                            Browse the councils currently represented in the portal, review their governance scope, and jump to the live
                            directory when you need contacts and officers.
                        </p>
                    </motion.div>
                </div>
            </section>

            <section ref={featuredCouncilRef} className="portal-section-dark section scroll-mt-32">
                <div className="portal-noise-overlay" aria-hidden="true" />
                <div className="container-main relative z-10">
                    <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={`council-logo-${activeCouncil.id}`}
                                className="portal-panel sg-hover-card overflow-hidden p-6 md:p-8"
                                data-council={activeCouncil.id}
                                variants={swapIn}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
                            >
                                <div
                                    className="sg-council-glow-layer sg-council-glow-layer-soft pointer-events-none absolute inset-0 blur-[60px]"
                                />
                                <div className="relative aspect-square w-full overflow-hidden rounded-[1.75rem] bg-white/5">
                                    <Image
                                        src={activeCouncil.src}
                                        alt={activeCouncil.name}
                                        fill
                                        sizes="(max-width: 1024px) 100vw, 50vw"
                                        unoptimized={isRuntimeLogoSource(activeCouncil.src)}
                                        className="object-contain p-8 md:p-12"
                                        priority
                                    />
                                </div>
                            </motion.div>
                        </AnimatePresence>

                        <AnimatePresence mode="wait">
                            <motion.div
                                key={`council-copy-${activeCouncil.id}`}
                                className="portal-panel sg-hover-card p-7 md:p-10"
                                data-council={activeCouncil.id}
                                variants={swapIn}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1], delay: 0.03 }}
                            >
                                <span
                                    className="sg-council-badge inline-flex rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-[0.22em]"
                                >
                                    {activeCouncil.abbr}
                                </span>
                                <h2 className="mt-5 text-3xl font-bold text-white md:text-4xl">{activeCouncil.name}</h2>
                                <p className="mt-5 text-base leading-8 text-slate-300 md:text-lg">{activeCouncil.description}</p>
                                <div className="mt-8 flex flex-wrap gap-4">
                                    <Link href="/directory" className="btn-primary no-underline inline-flex items-center gap-2">
                                        Open Directory <ExternalLink size={16} />
                                    </Link>
                                    <Link href="/student-government" className="btn-secondary no-underline">
                                        Back to Student Government
                                    </Link>
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </section>

            <section className="portal-section-slate section">
                <div className="portal-noise-overlay" aria-hidden="true" />
                <div className="container-main relative z-10">
                    <div className="max-w-2xl">
                        <span className="portal-kicker">Council Selector</span>
                        <h2 className="mt-4 text-3xl font-bold text-white">All councils in the current governance map</h2>
                        <p className="mt-4 portal-lead">
                            Select a card to swap the featured council. Logos use the curated image set from the public directory assets.
                        </p>
                    </div>
                    <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                        {resolvedCouncils.map((council, index) => {
                            const isActive = selectedCouncilIndex === index;

                            return (
                                <motion.button
                                    key={council.id}
                                    type="button"
                                    onClick={() => {
                                        setSelectedCouncil(index);
                                        setScrollRequestId((current) => current + 1);
                                    }}
                                    className="portal-panel sg-hover-card sg-selector-card p-4 text-left"
                                    data-council={council.id}
                                    data-active={isActive}
                                    whileHover={{ y: -5, scale: 1.01 }}
                                    whileTap={{ scale: 0.985 }}
                                    transition={{ type: 'spring', stiffness: 280, damping: 24 }}
                                >
                                    <div className="relative mx-auto h-16 w-16 overflow-hidden rounded-full bg-white/10 md:h-20 md:w-20">
                                        <Image
                                            src={council.src}
                                            alt={council.abbr}
                                            fill
                                            sizes="(max-width: 768px) 64px, 80px"
                                            unoptimized={isRuntimeLogoSource(council.src)}
                                            className="object-contain p-1.5"
                                        />
                                    </div>
                                    <p className="mt-4 text-center text-xs font-bold uppercase tracking-[0.16em] text-white md:text-sm">
                                        {council.abbr}
                                    </p>
                                </motion.button>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="portal-section-dark section">
                <div className="portal-noise-overlay" aria-hidden="true" />
                <div className="container-main relative z-10 grid gap-6 md:grid-cols-3">
                    <motion.article
                        className="portal-panel sg-hover-card p-6 md:p-7"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, amount: 0.35 }}
                        variants={fadeInUp}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <h3 className="text-xl font-bold text-white">Campus representation</h3>
                        <p className="mt-3 text-sm leading-7 text-slate-300">Central councils cover Mandaluyong and Pasig so branch-level issues are not routed through the wrong office.</p>
                    </motion.article>
                    <motion.article
                        className="portal-panel sg-hover-card p-6 md:p-7"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, amount: 0.35 }}
                        variants={fadeInUp}
                        transition={{ duration: 0.42, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <h3 className="text-xl font-bold text-white">Academic representation</h3>
                        <p className="mt-3 text-sm leading-7 text-slate-300">College and institute councils give each academic community its own leadership and advocacy path.</p>
                    </motion.article>
                    <motion.article
                        className="portal-panel sg-hover-card p-6 md:p-7"
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, amount: 0.35 }}
                        variants={fadeInUp}
                        transition={{ duration: 0.44, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <h3 className="text-xl font-bold text-white">Unified coordination</h3>
                        <p className="mt-3 text-sm leading-7 text-slate-300">All of these councils still roll up into the wider student-government structure represented by the SSC and OSR.</p>
                    </motion.article>
                </div>
            </section>
        </>
    );
}
