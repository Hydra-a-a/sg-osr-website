'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import useSWR from 'swr';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, ChevronLeft, ChevronRight, ExternalLink, FileText, Landmark, Newspaper } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { QuickLink } from '@/schemas/links';
import { applyCouncilLogoOverrides, type DirectoryLogoSource } from '@/lib/council-logos';
import { isRuntimeLogoSource, studentGovernmentCouncils } from '@/lib/student-government';

const iconMap: Record<string, LucideIcon> = {
    FileText,
    Landmark,
    Newspaper,
    ExternalLink,
};

const fallbackLinks: QuickLink[] = [
    {
        id: 'hero-grievance',
        label: 'Student Grievances',
        desc: 'Submit concerns, follow updates, and continue the feedback loop securely.',
        href: '/services/grievance',
        icon: 'FileText',
    },
    {
        id: 'hero-governance',
        label: 'Student Government',
        desc: 'Browse councils, commissions, and the Office of the Student Regent.',
        href: '/student-government',
        icon: 'Landmark',
    },
    {
        id: 'hero-news',
        label: 'Transparency and News',
        desc: 'Open records, resolutions, and official updates from the portal.',
        href: '/transparency',
        icon: 'Newspaper',
    },
];

function subscribeNoop(): () => void {
    return () => {};
}

function useClientReady(): boolean {
    return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

function usePrefersReducedMotion(): boolean {
    return useSyncExternalStore((onStoreChange) => {
        if (typeof window === 'undefined') {
            return () => {};
        }

        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        mediaQuery.addEventListener('change', onStoreChange);
        return () => mediaQuery.removeEventListener('change', onStoreChange);
    }, () => {
        if (typeof window === 'undefined') {
            return true;
        }

        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }, () => true);
}

function usePageVisibility(): boolean {
    return useSyncExternalStore((onStoreChange) => {
        if (typeof document === 'undefined') {
            return () => {};
        }

        document.addEventListener('visibilitychange', onStoreChange);
        return () => document.removeEventListener('visibilitychange', onStoreChange);
    }, () => {
        if (typeof document === 'undefined') {
            return true;
        }

        return document.visibilityState === 'visible';
    }, () => true);
}

export default function Hero() {
    const { data: linksResponse } = useSWR('/api/config/links', (url: string) => fetch(url).then((response) => response.json()));
    const { data: directoryResponse } = useSWR('/api/directory', (url: string) => fetch(url).then((response) => response.json()));
    const hasMounted = useClientReady();
    const prefersReducedMotion = usePrefersReducedMotion();
    const [isHeroInView, setIsHeroInView] = useState(true);
    const isPageVisible = usePageVisibility();
    const [activeIndex, setActiveIndex] = useState(0);
    const lastInteraction = useRef(0);
    const sectionRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        lastInteraction.current = Date.now();
    }, []);

    useEffect(() => {
        if (!hasMounted || !sectionRef.current) {
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsHeroInView(entry.isIntersecting);
            },
            { threshold: 0.1 }
        );

        observer.observe(sectionRef.current);
        return () => observer.disconnect();
    }, [hasMounted]);

    const links: QuickLink[] = linksResponse?.data || fallbackLinks;
    const resolvedCouncils = useMemo(
        () => applyCouncilLogoOverrides(studentGovernmentCouncils, (directoryResponse?.leaders || []) as DirectoryLogoSource[]),
        [directoryResponse?.leaders]
    );
    const councilCount = resolvedCouncils.length;
    const isMotionConservative = useMemo(() => {
        if (!hasMounted) {
            return true;
        }

        const nav = navigator as Navigator & { deviceMemory?: number };
        const mobileViewport = window.matchMedia('(max-width: 900px)').matches;
        const noHoverInput = window.matchMedia('(hover: none)').matches;
        const lowCpu = typeof navigator.hardwareConcurrency === 'number' && navigator.hardwareConcurrency <= 6;
        const lowMemory = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4;

        return mobileViewport && (noHoverInput || lowCpu || lowMemory);
    }, [hasMounted]);
    const enableCarouselMotion = false;
    const safeIndex = councilCount === 0 ? 0 : enableCarouselMotion ? activeIndex % councilCount : 0;
    const activeCouncil = resolvedCouncils[safeIndex];

    const next = useCallback(() => {
        if (!enableCarouselMotion) {
            return;
        }

        setActiveIndex((value) => (value + 1) % councilCount);
        lastInteraction.current = Date.now();
    }, [councilCount, enableCarouselMotion]);

    const previous = useCallback(() => {
        if (!enableCarouselMotion) {
            return;
        }

        setActiveIndex((value) => (value - 1 + councilCount) % councilCount);
        lastInteraction.current = Date.now();
    }, [councilCount, enableCarouselMotion]);

    const jumpTo = useCallback((index: number) => {
        if (!enableCarouselMotion) {
            return;
        }

        setActiveIndex(index);
        lastInteraction.current = Date.now();
    }, [enableCarouselMotion]);

    useEffect(() => {
        if (!enableCarouselMotion || !isHeroInView || !isPageVisible) {
            return;
        }

        const interval = window.setInterval(() => {
            if (Date.now() - lastInteraction.current < 10000) {
                return;
            }

            setActiveIndex((value) => (value + 1) % councilCount);
        }, 5000);

        return () => window.clearInterval(interval);
    }, [councilCount, enableCarouselMotion, isHeroInView, isPageVisible]);

    if (!activeCouncil) {
        return null;
    }

    const heroLinks = links.length > 0 ? links.slice(0, 3) : fallbackLinks;

    return (
        <section ref={sectionRef} className="hero-banner bg-gradient-rtu relative overflow-hidden min-h-[84vh] flex items-center md:min-h-[90vh]">
            <div className="absolute inset-0 pointer-events-none z-0">
                <div className="hero-dot-grid" />
            </div>
            <div
                className="hero-ambient-orb hero-ambient-orb-gold absolute -right-40 -top-40 h-96 w-96 max-w-[50vw] rounded-full opacity-10"
            />
            <div
                className="hero-ambient-orb hero-ambient-orb-gold-light absolute -bottom-20 -left-20 h-72 w-72 max-w-[40vw] rounded-full opacity-10"
            />

            <div className="container-main relative z-10 py-16 md:py-24 lg:py-28">
                <div className="flex flex-col items-center gap-10 md:flex-row lg:gap-14">
                    <div className="flex-1 text-center md:text-left">
                        <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-[var(--rtu-gold-light)]">
                            Rizal Technological University
                        </p>
                        <h1 className="mb-5 text-4xl font-bold leading-tight text-white md:text-6xl">
                            RTU Student <span className="text-gradient-gold">Government Portal</span>
                        </h1>
                        <p className="mb-7 max-w-xl text-base text-white/70 md:mb-8 md:text-lg">
                            Empowering Rizalianos through transparent, responsive, and inclusive student governance.
                            The unified digital home of the Supreme Student Council, its constitutional commissions,
                            and the Office of the Student Regent.
                        </p>
                        <div className="flex flex-col justify-center gap-4 sm:flex-row md:justify-start">
                            <Link href="/services" className="btn-primary text-base no-underline text-center">
                                Access Services
                            </Link>
                            <Link href="/student-government" className="btn-secondary text-base no-underline text-center">
                                Student Government
                            </Link>
                        </div>
                    </div>
                </div>

                <div className="mt-12 grid grid-cols-1 gap-4 md:mt-16 md:grid-cols-3 md:gap-6">
                    {heroLinks.map((item) => {
                        const IconComponent = iconMap[item.icon || 'ExternalLink'] || ExternalLink;

                        return (
                            <Link
                                key={item.label}
                                href={item.href}
                                className="hero-quick-card hero-quick-card-shell card p-6 flex items-start gap-4 no-underline group"
                            >
                                <IconComponent className="mt-1 text-white/80 transition-colors group-hover:text-white" size={24} />
                                <div>
                                    <h3 className="mb-1 text-base font-semibold text-white">{item.label}</h3>
                                    <p className="text-sm text-white/55">{item.desc}</p>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            </div>

            <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-1 md:bottom-8">
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/30">Explore</span>
                <div className={enableCarouselMotion ? 'animate-float' : ''}>
                    <ChevronDown className="text-white/30" size={20} />
                </div>
            </div>
        </section>
    );
}
