import Link from 'next/link';
import Image from 'next/image';
import { Scale, Megaphone, Heart, Users, ArrowRight } from 'lucide-react';
import BackLink from '@/components/BackLink';
import OSRAnnouncementsSection from '@/components/OSRAnnouncementsSection';
import { getOSRAnnouncementSlides } from '@/lib/osr-announcements';

const pillars = [
    {
        icon: Megaphone,
        title: 'Advocacy',
        desc: 'Championing student welfare through policy recommendations to the Board of Regents.',
    },
    {
        icon: Scale,
        title: 'Representation',
        desc: 'Serving as the official voice of more than 20,000 Rizalians in university governance.',
    },
    {
        icon: Heart,
        title: 'Inclusivity',
        desc: 'Ensuring every Rizaliano is represented through inclusive programs, accessible services, and student-centered governance.',
    },
];

export async function OSRLanding() {
    const contentSlides = await getOSRAnnouncementSlides();

    return (
        <>
            <section className="osr-hero-section">
                <div className="osr-hero-photo" aria-hidden="true" />
                <div className="osr-hero-texture" aria-hidden="true" />
                <div className="absolute inset-0 pointer-events-none">
                    <div className="hero-dot-grid" />
                </div>
                <div className="container-main relative z-10 py-20 md:py-28">
                    <BackLink href="/student-government" label="Back to Student Government" className="mb-8 text-white/80 hover:text-white transition-colors" />
                    <div className="osr-hero-shell">
                        <div className="osr-hero-copy text-center md:text-left">
                            <div
                                className="badge-accent-gold inline-block rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest mb-6"
                            >
                                Office of the Student Regent
                            </div>
                            <h1 className="mb-5 text-4xl font-bold leading-tight text-white md:text-5xl">
                                The Voice of <span className="text-gradient-gold">Every Rizaliano</span>
                            </h1>
                            <p className="mb-8 max-w-xl text-lg text-white/70">
                                The OSR represents the student body in the Board of Regents, advocating for student rights, welfare,
                                and academic interests at the highest level of university governance.
                            </p>
                            <div className="flex flex-wrap justify-center gap-4 md:justify-start">
                                <Link href="/student-government" className="btn-primary text-base no-underline">
                                    Student Government Hub
                                </Link>
                                <Link href="/directory" className="btn-secondary text-base no-underline">
                                    Meet the Team
                                </Link>
                                <Link href="/services" className="btn-secondary text-base no-underline">
                                    File a Concern
                                </Link>
                            </div>
                        </div>
                        <div className="osr-hero-logo-wrap">
                            <div className="relative h-44 w-44 md:h-56 md:w-56">
                                <div className="osr-logo-glow absolute inset-[-6px] rounded-full opacity-25 blur-xl pointer-events-none" />
                                <Image
                                    src="/images/OSR_LOGO.jpg"
                                    alt="Office of the Student Regent Logo"
                                    fill
                                    sizes="(max-width: 768px) 176px, 224px"
                                    className="object-contain rounded-full osr-logo-shadow"
                                    priority
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="osr-divider-gradient h-1" />
            </section>

            <section className="portal-section-dark section">
                <div className="portal-noise-overlay" aria-hidden="true" />
                <div className="container-main relative z-10">
                    <div className="osr-principle-grid">
                        <article className="osr-principle-card" data-tone="gold">
                            <span className="portal-kicker">Mission</span>
                            <h2 className="osr-principle-title">Advocate student interests at the regent level.</h2>
                            <p className="osr-principle-copy">
                                The office brings student concerns into university governance, turns campus sentiment into formal policy input,
                                and keeps representation connected to real student needs.
                            </p>
                        </article>
                        <article className="osr-principle-card" data-tone="sky">
                            <span className="portal-kicker">Vision</span>
                            <h2 className="osr-principle-title">A responsive and accountable governance channel.</h2>
                            <p className="osr-principle-copy">
                                The goal is practical representation: visible advocacy, transparent updates, and a direct line between the
                                student body and the university&apos;s highest governing board.
                            </p>
                        </article>
                    </div>
                </div>
            </section>

            <section className="portal-section-slate section">
                <div className="portal-noise-overlay" aria-hidden="true" />
                <div className="container-main relative z-10">
                    <div className="max-w-2xl">
                        <span className="portal-kicker">Core Mandate</span>
                        <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">What the office is expected to do</h2>
                    </div>
                    <div className="osr-mandate-grid">
                        {pillars.map((pillar) => (
                            <article key={pillar.title} className="osr-mandate-card">
                                <div className="osr-mandate-icon">
                                    <pillar.icon size={30} />
                                </div>
                                <h3 className="osr-mandate-title">{pillar.title}</h3>
                                <p className="osr-mandate-copy">{pillar.desc}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="portal-section-dark section">
                <div className="portal-noise-overlay" aria-hidden="true" />
                <div className="container-main relative z-10 text-center">
                    <span className="portal-kicker">Directory</span>
                    <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">Meet the officers behind the office</h2>
                    <div className="osr-directory-card mx-auto">
                        <Users size={48} className="osr-directory-icon" />
                        <p className="osr-directory-title">OSR Officers</p>
                        <p className="osr-directory-copy">
                            View the current roster serving under the Office of the Student Regent.
                        </p>
                        <Link href="/directory" className="btn-primary osr-directory-link no-underline inline-flex items-center gap-2">
                            View Directory <ArrowRight size={16} />
                        </Link>
                    </div>
                </div>
            </section>

            <OSRAnnouncementsSection slides={contentSlides} />
        </>
    );
}
