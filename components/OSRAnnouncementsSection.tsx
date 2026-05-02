import Link from 'next/link';
import SlideParser from '@/components/SlideParser';
import type { SlideData } from '@/lib/google';

interface Props {
    slides: SlideData[];
    compact?: boolean;
}

export default function OSRAnnouncementsSection({ slides, compact = false }: Props) {
    if (!slides.length) return null;

    return (
        <section id="osr-announcements" className="portal-section-dark section-tight">
            <div className="portal-noise-overlay" aria-hidden="true" />
            <div className="container-main relative z-10">
                <div className="ssc-announcements-header flex flex-wrap items-end justify-between gap-4 mb-6">
                    <div>
                        <span className="portal-eyebrow">SSC Announcements</span>
                        <h2 className="ssc-announcements-title mt-3">Recent postings from the Supreme Student Council</h2>
                    </div>
                    {compact && (
                        <Link href="/student-government/osr#osr-announcements" className="btn-secondary no-underline">
                            View SSC Feed
                        </Link>
                    )}
                </div>
                <div className="ssc-announcements-body">
                    <SlideParser slides={compact ? slides.slice(0, 3) : slides} variant="dark" layout="horizontal" />
                </div>
            </div>
        </section>
    );
}
