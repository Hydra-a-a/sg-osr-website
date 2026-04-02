'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, ExternalLink } from 'lucide-react';

/* ── Council Data ── */
const councils = [
    {
        id: 'ssc',
        name: 'Supreme Student Council',
        abbr: 'SSC',
        src: '/images/RTU_SSC.jpg',
        glow: 'rgba(212, 168, 67, 0.45)',
        gradientFrom: '#d4a843',
        gradientTo: '#f5d98a',
        description: 'The highest governing body of RTU student government, representing all students across all campuses and colleges. The SSC coordinates policies, oversees constitutional commissions, and serves as the primary voice of the student body to administration.',
    },
    {
        id: 'cengsc',
        name: 'College of Engineering Student Council',
        abbr: 'CEngSC',
        src: '/images/RTU_CEngSC.jpg',
        glow: 'rgba(220, 110, 30, 0.45)',
        gradientFrom: '#e07020',
        gradientTo: '#fbb040',
        description: 'Represents the College of Engineering students and addresses college-specific concerns. Works on academic advocacy, student affairs, and professional development initiatives tailored to engineering programs.',
    },
    {
        id: 'cbeasc',
        name: 'CBEA Student Council',
        abbr: 'CBEASC',
        src: '/images/RTU_CBEASC.jpg',
        glow: 'rgba(204, 207, 36, 0.87)',
        gradientFrom: '#dad73eff',
        gradientTo: '#dee080ff',
        description: 'Serves the College of Business, Entrepeneurship, and Accountancy. Focuses on business student concerns, career development, and industry connections for accounting and business programs.',
    },
    {
        id: 'mccsc',
        name: 'Mandaluyong Campus Central Student Council',
        abbr: 'MCCSC',
        src: '/images/MCCSC.png',
        glow: 'rgba(126, 34, 206, 0.5)',
        gradientFrom: '#7e22ce',
        gradientTo: '#fbbf24',
        description: 'The central coordinating body for the Mandaluyong campus. Manages campus-specific events, facilities, and concerns for all Mandaluyong-based students.',
    },
    {
        id: 'cassc',
        name: 'College of Arts and Sciences Student Council',
        abbr: 'CASSC',
        src: '/images/RTU_CASSC.jpg',
        glow: 'rgba(22, 163, 74, 0.5)',
        gradientFrom: '#15803d',
        gradientTo: '#4ade80',
        description: 'Represents the diverse student body of the College of Arts and Sciences. Advocates for humanities and science programs and promotes interdisciplinary collaboration.',
    },
    {
        id: 'cedsc',
        name: 'College of Education Student Council',
        abbr: 'CEDSC',
        src: '/images/RTU_CEDSC.jpg',
        glow: 'rgba(37, 99, 235, 0.45)',
        gradientFrom: '#1d4ed8',
        gradientTo: '#f59e0b',
        description: 'Serves future educators and education majors. Focuses on teaching excellence, student teacher advocacy, and professional development in education.',
    },
    {
        id: 'iasc',
        name: 'Institute of Architecture Student Council',
        abbr: 'IASC',
        src: '/images/RTU_IASC.jpg',
        glow: 'rgba(220, 38, 38, 0.45)',
        gradientFrom: '#b91c1c',
        gradientTo: '#ef4444',
        description: 'Represents architecture students with focus on professional development, design competitions, and industry engagement. Advocates for architecture-specific academic needs.',
    },
    {
        id: 'icssc',
        name: 'Institute of Computer Studies Student Council',
        abbr: 'ICSSC',
        src: '/images/RTU_ICSSC.jpg',
        glow: 'rgba(37, 99, 235, 0.45)',
        gradientFrom: '#2563eb',
        gradientTo: '#a855f7',
        description: 'Dedicated to computer science and IT students. Promotes tech initiatives, coding competitions, and career advancement in the tech industry.',
    },
    {
        id: 'ihksc',
        name: 'Institute of Human Kinetics Student Council',
        abbr: 'IHKSC',
        src: '/images/RTU_IHKSC.jpg',
        glow: 'rgba(217, 70, 239, 0.45)',
        gradientFrom: '#d946ef',
        gradientTo: '#f0abfc',
        description: 'Represents physical education and human kinetics students. Focuses on sports advocacy, athletic events, and wellness initiatives.',
    },
    {
        id: 'pccsc',
        name: 'Pasig Campus Central Student Council',
        abbr: 'PCCSC',
        src: '/images/RTU_PCCSC.jpg',
        glow: 'rgba(185, 28, 28, 0.5)',
        gradientFrom: '#b91c1c',
        gradientTo: '#f59e0b',
        description: 'The central coordinating body for the Pasig campus. Manages campus-specific programs, student services, and community engagement for all Pasig-based students.',
    },
];

const fadeInUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
};

export default function AboutPage() {
    const [selectedCouncil, setSelectedCouncil] = useState(0);
    const active = councils[selectedCouncil];

    return (
        <>
            {/* Hero Section */}
            <section className="bg-gradient-rtu relative overflow-hidden min-h-[60vh] flex items-center pt-20">
                <div className="absolute inset-0 pointer-events-none z-0">
                    <div className="hero-dot-grid opacity-50" />
                </div>

                <div className="container-main relative z-10 py-16 md:py-24">
                    <motion.div
                        initial="hidden"
                        animate="visible"
                        transition={{ duration: 0.6 }}
                        variants={fadeInUp}
                        className="text-center"
                    >
                        <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
                            Student Government Bodies
                        </h1>
                        <p className="text-lg md:text-xl text-white/80 max-w-3xl mx-auto">
                            Meet the councils and institutes leading RTU student governance across all campuses and colleges.
                            Each body represents the voices and interests of our Rizalian community.
                        </p>
                    </motion.div>
                </div>
            </section>

            {/* Featured Council Section */}
            <section className="section bg-surface-base">
                <div className="container-main">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
                        {/* Featured Council Card */}
                        <motion.div
                            key={active.id}
                            initial="hidden"
                            animate="visible"
                            transition={{ duration: 0.5 }}
                            variants={fadeInUp}
                            className="relative"
                        >
                            <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-surface-soft">
                                <motion.div
                                    className="absolute inset-0 rounded-full blur-[60px] z-0"
                                    animate={{ background: active.glow }}
                                    transition={{ duration: 0.5 }}
                                    style={{ opacity: 0.6 }}
                                />
                                <Image
                                    src={active.src}
                                    alt={active.name}
                                    fill
                                    sizes="(max-width: 1024px) 100vw, 50vw"
                                    className="object-contain relative z-10 p-8 md:p-12"
                                    priority
                                />
                            </div>
                        </motion.div>

                        {/* Featured Council Info */}
                        <motion.div
                            key={`info-${active.id}`}
                            initial="hidden"
                            animate="visible"
                            transition={{ duration: 0.5, delay: 0.1 }}
                            variants={fadeInUp}
                        >
                            <div className="mb-2">
                                <span
                                    className="inline-block text-sm font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-4"
                                    style={{
                                        background: `linear-gradient(135deg, ${active.gradientFrom}, ${active.gradientTo})`,
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        backgroundClip: 'text',
                                    }}
                                >
                                    {active.abbr}
                                </span>
                            </div>
                            <h2 className="text-3xl md:text-4xl font-bold mb-6">{active.name}</h2>
                            <p className="text-lg text-body mb-10 leading-relaxed">
                                {active.description}
                            </p>

                            {/* CTA Buttons */}
                            <div className="flex flex-col sm:flex-row gap-4">
                                <Link
                                    href="/directory"
                                    className="btn-primary text-base no-underline text-center flex items-center justify-center gap-2"
                                >
                                    View Contact Information <ExternalLink size={18} />
                                </Link>
                                <button
                                    className="btn-secondary text-base flex items-center justify-center gap-2"
                                >
                                    Share <Share2 size={18} />
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* Councils Grid Section */}
            <section className="section bg-surface-soft">
                <div className="container-main">
                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: '-60px' }}
                        transition={{ duration: 0.5 }}
                        variants={fadeInUp}
                        className="text-center mb-12 md:mb-16"
                    >
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">All Councils & Institutes</h2>
                        <p className="text-lg text-body max-w-2xl mx-auto">
                            Select a council to learn more about their representation scope, governance role, and leadership.
                        </p>
                    </motion.div>

                    {/* Responsive Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
                        {councils.map((council, idx) => (
                            <motion.button
                                key={council.id}
                                onClick={() => setSelectedCouncil(idx)}
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true, margin: '-40px' }}
                                transition={{ duration: 0.4, delay: idx * 0.05 }}
                                variants={fadeInUp}
                                className={`relative group flex flex-col items-center justify-center p-4 md:p-6 rounded-xl transition-all duration-300 ${
                                    selectedCouncil === idx
                                        ? 'ring-2 md:ring-4 scale-105'
                                        : 'hover:scale-105'
                                }`}
                                style={{
                                    background:
                                        selectedCouncil === idx
                                            ? `${council.gradientFrom}15`
                                            : 'var(--surface-base)',
                                    borderColor: council.gradientFrom,
                                    borderWidth: selectedCouncil === idx ? '2px' : '1px',
                                    border: `1px solid ${selectedCouncil === idx ? council.gradientFrom : 'var(--border-color)'}`,
                                }}
                            >
                                {/* Logo */}
                                <div className="relative w-16 h-16 md:w-20 md:h-20 mb-3 flex-shrink-0">
                                    <motion.div
                                        className="absolute inset-0 rounded-full blur-2xl z-0"
                                        animate={selectedCouncil === idx ? { background: council.glow } : { background: 'rgba(0,0,0,0)' }}
                                        transition={{ duration: 0.3 }}
                                    />
                                    <Image
                                        src={council.src}
                                        alt={council.abbr}
                                        fill
                                        sizes="(max-width: 768px) 64px, 80px"
                                        className="object-contain relative z-10"
                                    />
                                </div>

                                {/* Label */}
                                <span className="text-xs md:text-sm font-bold uppercase tracking-widest text-center leading-tight line-clamp-2">
                                    {council.abbr}
                                </span>
                            </motion.button>
                        ))}
                    </div>
                </div>
            </section>

            {/* Info Section */}
            <section className="section bg-surface-base">
                <div className="container-main">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
                        {[
                            {
                                title: 'Campus Representation',
                                desc: 'Our councils span multiple campuses including Mandaluyong and Pasig, ensuring students across all locations have representation.',
                            },
                            {
                                title: 'College-Specific Bodies',
                                desc: 'Specialized councils for Engineering, Business, Arts & Sciences, Education, Architecture, Computer Studies, and Human Kinetics.',
                            },
                            {
                                title: 'Unified Governance',
                                desc: 'All councils coordinate through the Supreme Student Council to ensure cohesive, university-wide policy and representation.',
                            },
                        ].map((item, i) => (
                            <motion.div
                                key={item.title}
                                initial="hidden"
                                whileInView="visible"
                                viewport={{ once: true, margin: '-40px' }}
                                transition={{ duration: 0.4, delay: i * 0.1 }}
                                variants={fadeInUp}
                                className="card p-8"
                            >
                                <h3 className="text-xl font-bold mb-4">{item.title}</h3>
                                <p className="text-body leading-relaxed">{item.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section
                className="section py-12 md:py-16 relative overflow-hidden"
                style={{ background: 'var(--rtu-blue)' }}
            >
                <div className="absolute top-0 right-0 p-8 opacity-10">
                    <ExternalLink size={200} color="white" />
                </div>
                <div className="container-main relative z-10">
                    <motion.div
                        initial="hidden"
                        whileInView="visible"
                        viewport={{ once: true, margin: '-60px' }}
                        transition={{ duration: 0.5 }}
                        variants={fadeInUp}
                        className="text-center text-white"
                    >
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Connect With Your Council</h2>
                        <p className="text-lg opacity-90 max-w-2xl mx-auto mb-8">
                            Find contact information, view current officers, and get involved with your student government.
                        </p>
                        <Link href="/directory" className="btn-light text-base no-underline text-center inline-flex">
                            View Full Directory
                        </Link>
                    </motion.div>
                </div>
            </section>
        </>
    );
}
