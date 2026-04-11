'use client';

import React from 'react';
import { ShieldCheck, Ticket, Lightbulb, Users, Settings, ArrowRight, AlertCircle, Shield } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import BackLink from '@/components/BackLink';
import { NoncedStyle } from '@/components/CspNonceProvider';



export default function AdminHubPage() {
    const adminCards = [
        {
            id: 'grievances',
            label: 'Grievance Tickets',
            kicker: 'Case Management',
            description: 'Review, respond to, and manage student grievances and complaints.',
            icon: Ticket,
            href: '/services/admin/grievances',
            tone: 'blue',
            badge: '5 Pending',
            badgeType: 'warning'
        },
        {
            id: 'proposals',
            label: 'Project Proposals',
            kicker: 'Program Pipeline',
            description: 'Evaluate and approve project programs submitted by Student Leaders.',
            icon: Lightbulb,
            href: '/services/admin/proposals',
            tone: 'amber',
            badge: '2 Under Review',
            badgeType: 'warning'
        },
        {
            id: 'users',
            label: 'User Management',
            kicker: 'Access Control',
            description: 'Manage users, adjust roles, and revoke administrative access.',
            icon: Users,
            href: '/services/admin/users',
            tone: 'green',
        },
        {
            id: 'settings',
            label: 'System Settings',
            kicker: 'Configuration',
            description: 'Configure global portal settings and environment variables.',
            icon: Settings,
            href: '/services/admin/settings',
            tone: 'gray',
        }
    ];

    return (
        <div className={`services-shell relative overflow-hidden`}>
            <div className="services-noise" aria-hidden="true" />

            <section className="relative z-10 pt-20 pb-10 md:pt-28 md:pb-14">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <BackLink href="/services" label="Back to Services" className="mb-8 text-slate-200 hover:text-white transition-colors" />
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
                        <div className="max-w-2xl">
                            <span className="services-eyebrow inline-flex items-center gap-2 px-4 py-1.5 rounded-full shadow-sm mb-4">
                                <Shield size={14} className="text-red-400" />
                                Officer Access
                            </span>
                            <h1 className={`services-display mt-3`}>
                                Operations <span className="services-display-accent">Deck</span>
                            </h1>
                            <p className="services-lead mt-5 max-w-2xl">
                                Central dashboard for administrative tasks. Manage portal activity, review submissions, and control system configuration securely.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {adminCards.map((card, index) => {
                            const Icon = card.icon;

                            return (
                                <motion.div
                                    key={card.id}
                                    initial={{ opacity: 0, y: 28 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.45, delay: 0.08 * index }}
                                >
                                    <Link href={card.href} className={`services-card services-card-${card.tone} group h-full block no-underline p-7 md:p-8`}>
                                        <div className="flex items-start justify-between gap-4 mb-2">
                                            <p className="services-card-kicker">{card.kicker}</p>
                                        </div>

                                        <div className="services-icon-box mb-6 relative">
                                            <div className="services-icon-tile">
                                                <Icon size={24} />
                                            </div>
                                        </div>

                                        {card.badge && (
                                            <span className={`services-badge services-badge-${card.badgeType || 'default'} mb-4 inline-flex items-center gap-1.5`}>
                                                <AlertCircle size={12} /> {card.badge}
                                            </span>
                                        )}

                                        <h2 className={`services-card-title`}>{card.label}</h2>
                                        <p className="services-card-description mt-3">{card.description}</p>

                                        <div className="services-card-cta mt-8 inline-flex items-center gap-2">
                                            Manage Module
                                            <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
                                        </div>
                                    </Link>
                                </motion.div>
                            );
                        })}
                    </div>
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
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.2);
                    color: #fca5a5;
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
                    background: linear-gradient(135deg, #fca5a5 0%, #ef4444 100%);
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

                .services-card-kicker {
                    margin: 0;
                    color: rgba(255, 255, 255, 0.5);
                    font-size: 0.72rem;
                    font-weight: 500;
                    letter-spacing: 0.02em;
                }

                .services-icon-box {
                    font-size: 2.2rem;
                }

                .services-icon-tile {
                    width: 3.5rem;
                    height: 3.5rem;
                    display: grid;
                    place-items: center;
                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.02));
                    border: 1px solid rgba(255, 255, 255, 0.15);
                    border-radius: 1rem;
                    color: #ffffff;
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 12px rgba(0,0,0,0.2);
                }

                .services-card-blue .services-icon-tile { color: #93c5fd; background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(59, 130, 246, 0.05)); border-color: rgba(59, 130, 246, 0.2); }
                .services-card-amber .services-icon-tile { color: #fde047; background: linear-gradient(135deg, rgba(234, 179, 8, 0.15), rgba(234, 179, 8, 0.05)); border-color: rgba(234, 179, 8, 0.2); }
                .services-card-green .services-icon-tile { color: #86efac; background: linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05)); border-color: rgba(34, 197, 94, 0.2); }
                .services-card-gray .services-icon-tile { color: #cbd5e1; background: linear-gradient(135deg, rgba(100, 116, 139, 0.15), rgba(100, 116, 139, 0.05)); border-color: rgba(100, 116, 139, 0.2); }

                .services-badge {
                    margin: 0;
                    border-radius: 0.5rem;
                    font-size: 0.65rem;
                    font-weight: 600;
                    letter-spacing: 0.03em;
                    padding: 0.4rem 0.75rem;
                    background: rgba(247, 217, 150, 0.12);
                    color: #f7d996;
                    border: 1px solid rgba(247, 217, 150, 0.3);
                    backdrop-filter: blur(4px);
                }

                .services-badge-warning {
                    background: rgba(239, 68, 68, 0.12);
                    color: #fca5a5;
                    border: 1px solid rgba(239, 68, 68, 0.25);
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
            `} />
        </div>
    );
}










