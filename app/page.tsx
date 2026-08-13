import Hero from '@/components/Hero';
import AnnouncementsPanel from '@/components/AnnouncementsPanel';
import HomeCoreActions from '@/components/HomeCoreActions';
import LeaderAccessNoticeBanner from '@/components/LeaderAccessNoticeBanner';
import { fetchActiveAnnouncements } from '@/lib/announcements-server';
import { fetchQuickLinks } from '@/lib/quick-links';

export default async function Home() {
    const [announcements, quickLinks] = await Promise.all([
        fetchActiveAnnouncements(4).catch(() => []),
        fetchQuickLinks().catch(() => []),
    ]);

    return (
        <>
            <Hero links={quickLinks} />
            <LeaderAccessNoticeBanner />
            <HomeCoreActions />
            <AnnouncementsPanel announcements={announcements} />
        </>
    );
}
