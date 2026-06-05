'use client';

import { useSyncExternalStore } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { NoncedStyle } from '@/components/CspNonceProvider';
import BackLink from '@/components/BackLink';
import LeaderAccessNoticeBanner from '@/components/LeaderAccessNoticeBanner';
import {
    FileText,
    Search,
    Lightbulb,
    ShieldCheck,
    ArrowRight,
    Star,
} from 'lucide-react';
import { getAccessVisibilityState } from '@/lib/access-visibility';
import { PORTAL_MODE_COOKIE } from '@/lib/portal-mode';



function getPortalModeCookie(): string {
    if (typeof document === 'undefined') return '';
    return document.cookie
        .split('; ')
        .find(row => row.startsWith(`${PORTAL_MODE_COOKIE}=`))
        ?.split('=')[1] ?? '';
}

function subscribeNoop(): () => void {
    return () => {};
}

export default function ServicesPage() {
    const { data: session, status } = useSession();
    const portalMode = useSyncExternalStore(subscribeNoop, getPortalModeCookie, () => '');

    const visibility = getAccessVisibilityState(session?.user?.role, portalMode, '');
    const { effectiveRole, canSeeLeaderFeatures, canSeeOfficerFeatures } = visibility;
    const isLoading = status === 'loading';

    const modeLabel = effectiveRole === 'officer'
        ? 'Officer Console'
        : effectiveRole === 'leader'
            ? 'Leadership Console'
            : 'Student Console';

    const cards = [
        {
            id: 'grievance',
            href: '/services/grievance',
            icon: FileText,
            label: 'Student Grievances',
            description:
                'Formally report academic, administrative, or disciplinary concerns to the Student Council. Your submission is handled with confidentiality and due process.',
            tone: 'blue',
            visible: true,
        },
        {
            id: 'proposals',
            href: '/services/proposals',
            icon: Lightbulb,
            label: 'Project Proposals',
            description:
                'Submit project and program proposals for consideration by the Student Council. For Student Leaders and Officers only.',
            tone: 'amber',
            visible: canSeeLeaderFeatures,
        },
        {
            id: 'admin',
            href: '/services/admin',
            icon: ShieldCheck,
            label: 'Admin Hub',
            description:
                'Access the central dashboard to manage grievances, review project proposals, and oversee portal operations.',
            tone: 'green',
            visible: canSeeOfficerFeatures,
        },
    ] as const;

    const visibleCards = cards.filter(c => c.visible);
    const visibleCardCount = visibleCards.length;

    return (
        <div className={`services-shell relative overflow-hidden`}>
            <div className="services-noise" aria-hidden="true" />
            <LeaderAccessNoticeBanner />

            <section className="relative z-10 pt-20 pb-10 md:pt-28 md:pb-14">
                <div className="container-main">
                    <BackLink href="/" label="Back to Home" className="mb-8 text-slate-200 hover:text-white transition-colors" />
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.55 }}
                        className="grid gap-8 md:grid-cols-[1.1fr_0.9fr] items-end"
                    >
                        <div>
                            <span className="services-eyebrow inline-flex items-center gap-2 px-4 py-1.5 rounded-full shadow-sm mb-4">
                                <Star size={14} className="text-rtu-gold" /> RTU Student Government Services
                            </span>
                            <h1 className={`services-display mt-3`}>
                                Dedicated to <span className="services-display-accent">Student Support</span>
                            </h1>
                            <p className="services-lead mt-5 max-w-2xl">
                                Access official channels for grievances, project proposals, and transparent updates. 
                                Designed to be simple, accessible, and highly secure.
                            </p>
                        </div>

                        <div className="services-status-panel self-start md:self-end">
                            <p className="services-status-label">Your Current Role</p>
                            <p className={`services-status-mode`}>{modeLabel}</p>
                            <p className="services-status-caption">
                                Certain administrative actions require elevated access to be visible.
                            </p>
                        </div>
                    </motion.div>
                </div>
            </section>

            <section className="relative z-10 pb-16 md:pb-20">
                <div className="container-main max-w-6xl">
                    <div className="mb-8 flex justify-end">
                        <div className="flex flex-wrap justify-end gap-3">
                            {canSeeLeaderFeatures ? (
                                <Link href="/services/proposals/track" className="services-track-link group inline-flex items-center gap-2 px-5 py-3 rounded-xl">
                                    <Lightbulb size={16} />
                                    <span>Track Submitted Proposals</span>
                                    <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
                                </Link>
                            ) : null}
                            <Link href="/services/track" className="services-track-link group inline-flex items-center gap-2 px-5 py-3 rounded-xl">
                                <Search size={16} />
                                <span>Open Tracking Console</span>
                                <ArrowRight size={14} className="transition-transform duration-300 group-hover:translate-x-1" />
                            </Link>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className={`services-card-grid gap-6 ${visibleCardCount <= 2 ? 'services-card-grid-compact' : ''} ${visibleCardCount === 1 ? 'services-card-grid-single' : ''}`}>
                            {[0, 1].map((item) => (
                                <div key={item} className="services-card services-card-skeleton p-7 md:p-8">
                                    <div className="h-20 w-20 rounded-[1.15rem] bg-white/20 mb-8" />
                                    <div className="h-7 w-2/3 bg-white/20 rounded mb-3" />
                                    <div className="h-4 w-full bg-white/15 rounded mb-2" />
                                    <div className="h-4 w-5/6 bg-white/15 rounded" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="services-card-grid gap-6">
                            {visibleCards.map((card, index) => {
                                const Icon = card.icon;

                                return (
                                    <motion.div
                                        key={card.id}
                                        initial={{ opacity: 0, y: 28 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.45, delay: 0.08 * index }}
                                    >
                                        <Link href={card.href} className={`services-card services-card-${card.tone} group h-full block no-underline p-7 md:p-8`}>
                                    <div className="services-icon-box mb-8 relative">
                                        <div className="services-icon-tile">
                                            <Icon size={34} />
                                        </div>
                                    </div>

                                    <h2 className={`services-card-title`}>{card.label}</h2>
                                    <p className="services-card-description mt-3">{card.description}</p>

                                    <div className="services-card-cta mt-8 inline-flex items-center gap-2">
                                        Access Module
                                        <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
                                    </div>
                                        </Link>
                                    </motion.div>
                                );
                            })}

                        </div>
                    )}

                    <p className="services-footnote mt-10 text-center">
                        Every submission path here is governed by the Student Government data security baseline, with role-aware visibility and auditable updates.
                    </p>
                </div>
            </section>

                          <NoncedStyle css={`
                .services-shell {
                    background: linear-gradient(130deg, #1a3352 0%, #234874 48%, #3e6596 100%);
                    background-image:
                        radial-gradient(130% 120% at 8% 12%, rgba(232, 207, 146, 0.18) 0%, rgba(232, 207, 146, 0) 52%),
                        radial-gradient(140% 120% at 92% 8%, rgba(87, 131, 186, 0.28) 0%, rgba(87, 131, 186, 0) 58%),
                        linear-gradient(130deg, #1a3352 0%, #234874 48%, #3e6596 100%); 
                    color: #e2e8f0;
                    min-height: 100vh;
                }

                .services-shell::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(circle at top, rgba(255,255,255,0.02) 0%, transparent 100%);
                    pointer-events: none;
                    z-index: 1;
                }

                .services-noise {
                    position: absolute;
                    inset: 0;
                    background-image: radial-gradient(rgba(255,255,255,0.03) 1px, transparent 1px);
                    background-size: 32px 32px;
                    opacity: 0.2;
                    mask-image: linear-gradient(to bottom, black 40%, transparent 100%);
                    pointer-events: none;
                    z-index: 2;
                }

                .services-eyebrow {
                    background: rgba(212, 168, 67, 0.1);
                    border: 1px solid rgba(212, 168, 67, 0.2);
                    color: #f7d996;
                    font-size: 0.8rem;
                    font-weight: 600;
                    backdrop-filter: blur(8px);
                }

                .services-display {
                    font-size: clamp(2.2rem, 5vw, 4.2rem);
                    line-height: 1.1;
                    color: #ffffff;
                    max-width: 20ch;
                    text-wrap: pretty;
                    font-weight: 700;
                }

                .services-display-accent {
                    color: transparent;
                    background: linear-gradient(135deg, #f7d996 0%, #d4a843 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .services-lead {
                    color: #94a3b8;
                    font-size: clamp(1rem, 1.15vw + 0.5rem, 1.15rem);
                    line-height: 1.6;
                    max-width: 65ch;
                }

                .services-card {
                    position: relative;
                    border-radius: 1.5rem;
                    background: linear-gradient(145deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01));
                    border: 1px solid rgba(255, 255, 255, 0.05);
                    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s cubic-bezier(0.16, 1, 0.3, 1), background 0.4s ease, border-color 0.4s ease;
                    overflow: hidden;
                }

                .services-card-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                }

                .services-card-grid-compact {
                    justify-content: center;
                }

                .services-card-grid-single {
                    grid-template-columns: minmax(280px, 520px);
                }

                .services-card::before {
                    content: '';
                    position: absolute;
                    inset: 0;
                    background: radial-gradient(800px circle at var(--mouse-x) var(--mouse-y), rgba(255,255,255,0.06), transparent 40%);
                    opacity: 0;
                    pointer-events: none;
                    transition: opacity 0.5s ease;
                }

                .services-card:hover {
                    transform: translateY(-2px);
                    background: linear-gradient(145deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02));
                    border-color: rgba(255, 255, 255, 0.1);
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
                }

                .services-card:hover::before {
                    opacity: 1;
                }
                
                .services-card-locked {
                    background: repeating-linear-gradient(-45deg, rgba(255, 255, 255, 0.01), rgba(255, 255, 255, 0.01) 8px, rgba(0, 0, 0, 0.1) 8px, rgba(0, 0, 0, 0.1) 16px),
                                linear-gradient(160deg, rgba(15, 25, 45, 0.8) 0%, rgba(8, 15, 25, 0.9) 100%);
                    border-color: rgba(255, 255, 255, 0.03);
                    opacity: 0.85;
                }

                .services-icon-box {
                    font-size: 2.8rem;
                }

                .services-icon-tile {
                    width: 5rem;
                    height: 5rem;
                    display: grid;
                    place-items: center;
                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.02));
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    border-radius: 1.15rem;
                    color: #ffffff;
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), 0 14px 30px rgba(0,0,0,0.22);
                }

                .services-card-blue .services-icon-tile { color: #93c5fd; background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.05)); border-color: rgba(59, 130, 246, 0.2); }
                .services-card-amber .services-icon-tile { color: #fde047; background: linear-gradient(135deg, rgba(234, 179, 8, 0.15), rgba(234, 179, 8, 0.05)); border-color: rgba(234, 179, 8, 0.2); }
                .services-card-green .services-icon-tile { color: #86efac; background: linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05)); border-color: rgba(34, 197, 94, 0.2); }
                .services-card-gray .services-icon-tile { color: #cbd5e1; background: linear-gradient(135deg, rgba(100, 116, 139, 0.15), rgba(100, 116, 139, 0.05)); border-color: rgba(100, 116, 139, 0.2); }
                
                .services-card-locked .services-icon-tile {
                    background: linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05));
                    color: #fca5a5;
                    border-color: rgba(239, 68, 68, 0.2);
                }

                .services-badge-locked {
                    margin: 0;
                    border-radius: 0.5rem;
                    font-size: 0.65rem;
                    font-weight: 600;
                    letter-spacing: 0.03em;
                    padding: 0.4rem 0.75rem;
                    background: rgba(239, 68, 68, 0.12);
                    color: #fca5a5;
                    border: 1px solid rgba(239, 68, 68, 0.25);
                    backdrop-filter: blur(4px);
                }

                .services-card-title {
                    font-size: clamp(1.4rem, 2vw, 1.8rem);
                    margin: 0;
                    color: #ffffff;
                    line-height: 1.15;
                    font-weight: 500;
                    letter-spacing: -0.01em;
                }

                .services-card-description {
                    font-size: 0.95rem;
                    color: #cbd5e1;
                    line-height: 1.65;
                }

                .services-card-cta {
                    color: #7dd3fc;
                    font-size: 0.85rem;
                    font-weight: 600;
                    letter-spacing: 0.01em;
                    transition: color 0.3s ease;
                }

                .services-card:hover .services-card-cta {
                    color: #fca5a5;
                }

                .services-status-panel {
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    background: linear-gradient(145deg, rgba(20, 35, 60, 0.4), rgba(10, 20, 36, 0.6));
                    backdrop-filter: blur(12px);
                    border-radius: 1rem;
                    padding: 1.5rem 1.75rem;
                    box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
                }

                .services-status-label {
                    margin: 0;
                    color: #7dd3fc;
                    font-size: 0.72rem;
                    letter-spacing: 0.05em;
                    font-weight: 700;
                    text-transform: uppercase;
                }

                .services-status-mode {
                    margin: 0.35rem 0 0;
                    font-size: clamp(1.5rem, 2.5vw, 2rem);
                    color: #f7d996;
                    font-weight: 500;
                    line-height: 1.1;
                }

                .services-status-caption {
                    margin: 0.5rem 0 0;
                    color: #64748b;
                    font-size: 0.85rem;
                    line-height: 1.5;
                }

                .services-track-link {
                    color: #ffffff;
                    font-weight: 600;
                    font-size: 0.9rem;
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    background: linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02));
                    backdrop-filter: blur(8px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }

                .services-track-link:hover {
                    box-shadow: 0 8px 24px rgba(247, 217, 150, 0.15);
                    transform: translateY(-2px);
                    border-color: rgba(247, 217, 150, 0.4);
                    background: linear-gradient(145deg, rgba(247, 217, 150, 0.1), rgba(255, 255, 255, 0.02));
                }
            `} />
        </div>
    );
}













