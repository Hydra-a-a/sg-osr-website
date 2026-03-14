import { getSlidesData } from '../../lib/google';
import SlideParser from '../../components/SlideParser';
import Link from 'next/link';
import Image from 'next/image';
import { Scale, Megaphone, Eye, Users, ArrowRight } from 'lucide-react';

export const revalidate = 24;

const pillars = [
    {
        icon: Megaphone,
        title: 'Advocacy',
        desc: 'Championing student welfare through policy recommendations to the Board of Regents.',
    },
    {
        icon: Scale,
        title: 'Representation',
        desc: 'Serving as the official voice of over 20,000 Rizalians in university governance.',
    },
    {
        icon: Eye,
        title: 'Transparency',
        desc: 'Publishing financial reports, resolutions, and meeting minutes for full accountability.',
    },
];

export default async function OSRHome() {
    const allSlides = await getSlidesData();

    const contentSlides = allSlides.filter(slide => {
        let isStructural = false;
        slide.pageElements?.forEach(element => {
            element.shape?.text?.textElements?.forEach(t => {
                const content = t.textRun?.content?.trim() || "";
                if (content.startsWith('CONFIG:') ||
                    content.startsWith('NEWS:') ||
                    content.startsWith('GALLERY:') ||
                    content.startsWith('LINK:')) {
                    isStructural = true;
                }
            });
        });
        return !isStructural;
    });

    return (
        <>
            {/* OSR Dedicated Header */}
            <section className="bg-gradient-rtu relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="hero-dot-grid" />
                </div>
                <div className="container-main relative z-10 py-20 md:py-28">
                    <div className="flex flex-col md:flex-row items-center gap-10">
                        <div className="flex-1 text-center md:text-left">
                            <div
                                className="inline-block px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-6"
                                style={{ background: 'rgba(212, 168, 67, 0.2)', color: 'var(--rtu-gold-light)' }}
                            >
                                Office of the Student Regent
                            </div>
                            <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-5">
                                The Voice of{' '}
                                <span className="text-gradient-gold">Every Rizaliano</span>
                            </h1>
                            <p className="text-lg text-white/70 max-w-xl mb-8">
                                The OSR represents the student body in the Board of Regents — advocating
                                for your rights, welfare, and academic interests at the highest level of
                                university governance.
                            </p>
                            <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                                <Link href="/directory" className="btn-primary text-base no-underline">
                                    Meet the Team
                                </Link>
                                <Link href="/services" className="btn-secondary text-base no-underline">
                                    File a Concern
                                </Link>
                            </div>
                        </div>
                        <div className="flex-shrink-0">
                            <div className="relative w-44 h-44 md:w-56 md:h-56 animate-float">
                                <div className="absolute inset-[-6px] rounded-full opacity-25 blur-xl" style={{ background: 'var(--rtu-gold)' }} />
                                <Image
                                    src="/images/OSR_LOGO.jpg"
                                    alt="Office of the Student Regent Logo"
                                    fill
                                    className="object-contain rounded-full"
                                    style={{ filter: 'drop-shadow(0 8px 24px rgba(212, 168, 67, 0.3))' }}
                                    priority
                                />
                            </div>
                        </div>
                    </div>
                </div>
                {/* Gold accent bar */}
                <div className="h-1" style={{ background: 'linear-gradient(90deg, var(--rtu-gold-dark), var(--rtu-gold), var(--rtu-gold-light))' }} />
            </section>

            {/* Mission & Vision */}
            <section className="section" style={{ background: 'var(--bg-primary)' }}>
                <div className="container-main">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="card p-10">
                            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--rtu-blue)' }}>
                                Our Mission
                            </h2>
                            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                                Placeholder
                            </p>
                        </div>
                        <div className="card p-10">
                            <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--rtu-blue)' }}>
                                Our Vision
                            </h2>
                            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                                Placeholder
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* What We Do */}
            <section className="section" style={{ background: '#F2F1EE' }}>
                <div className="container-main">
                    <h2 className="text-3xl font-bold mb-2 text-center section-heading" style={{ color: 'var(--rtu-blue)' }}>
                        What We Do
                    </h2>
                    <p className="text-center mb-12" style={{ color: 'var(--text-muted)' }}>
                        The three pillars of the Office of the Student Regent
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {pillars.map((pillar) => (
                            <div key={pillar.title} className="feature-card card p-8 text-center flex flex-col items-center">
                                <div
                                    className="feature-icon w-16 h-16 rounded-2xl flex items-center justify-center mb-6"
                                    style={{ background: 'rgba(212, 168, 67, 0.1)', color: 'var(--rtu-gold-dark)' }}
                                >
                                    <pillar.icon size={32} />
                                </div>
                                <h3 className="text-xl font-bold mb-3">{pillar.title}</h3>
                                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                    {pillar.desc}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* OSR Team Preview */}
            <section className="section" style={{ background: 'var(--bg-primary)' }}>
                <div className="container-main text-center">
                    <h2 className="text-3xl font-bold mb-2 section-heading" style={{ color: 'var(--rtu-blue)' }}>
                        Our Team
                    </h2>
                    <p className="mb-10" style={{ color: 'var(--text-muted)' }}>
                        The people behind the office
                    </p>
                    <div className="card p-10 flex flex-col items-center">
                        <Users size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                        <p className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                            Meet the OSR Officers
                        </p>
                        <p className="text-sm mb-6 max-w-md" style={{ color: 'var(--text-muted)' }}>
                            View the full roster of officers serving under the Office of the Student Regent.
                        </p>
                        <Link href="/directory" className="btn-primary no-underline flex items-center gap-2">
                            View Directory <ArrowRight size={16} />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Announcements from Google Slides */}
            <section className="section" style={{ background: '#F2F1EE' }}>
                <div className="container-main">
                    <h2
                        className="text-3xl font-bold mb-2 text-center section-heading"
                        style={{ color: 'var(--rtu-blue)' }}
                    >
                        OSR Announcements
                    </h2>
                    <p className="text-center mb-10" style={{ color: 'var(--text-muted)' }}>
                        Official updates from the Office of the Student Regent
                    </p>
                    <SlideParser slides={contentSlides} />
                </div>
            </section>
        </>
    );
}
