import Link from 'next/link';
import type { Announcement } from '@/lib/announcements';

function formatDate(value?: string): string {
    if (!value) return 'Recently';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Recently';
    return date.toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

interface Props {
    announcements: Announcement[];
}

export default function AnnouncementsPanel({ announcements }: Props) {
    if (!announcements.length) return null;

    return (
        <section id="announcements" className="portal-section-slate section">
            <div className="portal-noise-overlay" aria-hidden="true" />
            <div className="container-main relative z-10">
                <div className="mb-8">
                    <span className="portal-eyebrow">Announcements</span>
                    <h2 className="home-section-title mt-4">Current Advisory Notices</h2>
                </div>
                <div className="announcement-grid">
                    {announcements.map((item) => {
                        const summaryId = `announcement-summary-${item.id}`;
                        return (
                            <article key={item.id} className="announcement-card">
                                <p className="announcement-date">{formatDate(item.publishedAt)}</p>
                                <h3 className="announcement-title">{item.title}</h3>
                                <p id={summaryId} className="announcement-summary">{item.summary}</p>
                                <Link href="/news" className="announcement-link no-underline" aria-describedby={summaryId}>
                                    Read more
                                </Link>
                            </article>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
