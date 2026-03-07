'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FileText, Users, Newspaper, ExternalLink } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { QuickLink } from '@/schemas/links';

// hardcoded icons because barrel imports made vercel cry
const iconMap: Record<string, LucideIcon> = {
    FileText, Users, Newspaper, ExternalLink,
};

export default function Hero() {
    const [links, setLinks] = useState<QuickLink[]>([]);

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

    // cap at 3 because mobile layout breaks otherwise
    const heroLinks = links.length > 0 ? links.slice(0, 3) : [
        { id: '1', label: 'Services & Forms', desc: 'Need student assistance?', href: '/services', icon: 'FileText' },
        { id: '2', label: 'Officer Directory', desc: 'Meet our student leaders', href: '/directory', icon: 'Users' },
        { id: '3', label: 'Latest News', desc: 'Stay updated with OSR', href: '/news', icon: 'Newspaper' },
    ];

    return (
        <section className="bg-gradient-rtu relative overflow-hidden min-h-[90vh] flex items-center">

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
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                    >
                        <p
                            className="text-sm font-semibold tracking-widest uppercase mb-4"
                            style={{ color: 'var(--rtu-gold-light)' }}
                        >
                            Rizal Technological University
                        </p>
                        <h1 className="text-4xl md:text-6xl font-bold text-white leading-tight mb-6">
                            Office of the{' '}
                            <span className="text-gradient-gold-shimmer">Student Regent</span>
                        </h1>
                        <p className="text-lg text-white/70 max-w-xl mb-8">
                            Serving as the voice of the student body in the Board of Regents.
                            We champion student rights, transparency, and welfare across
                            all campuses.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                            <Link href="/services" className="btn-primary text-base no-underline text-center">
                                File a Request
                            </Link>
                            <Link href="/directory" className="btn-secondary text-base no-underline text-center">
                                Meet the Team
                            </Link>
                        </div>
                    </motion.div>


                    <motion.div
                        className="flex-shrink-0"
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
                    >
                        <div className="relative w-56 h-56 md:w-72 md:h-72 animate-float">
                            <Image
                                src="/images/OSR_LOGO.jpg"
                                alt="Rizal Technological University - Office of the Student Regent Logo"
                                fill
                                className="object-contain rounded-full"
                                style={{
                                    filter: 'drop-shadow(0 8px 32px rgba(212, 168, 67, 0.3))',
                                }}
                                priority
                            />
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
                                className="card p-6 flex items-start gap-4 no-underline group"
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
        </section>
    );
}
