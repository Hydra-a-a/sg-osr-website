import Hero from '@/components/Hero';
import AnnouncementsPanel from '@/components/AnnouncementsPanel';
import HomeCoreActions from '@/components/HomeCoreActions';
import LeaderAccessNoticeBanner from '@/components/LeaderAccessNoticeBanner';
import { fetchActiveAnnouncements } from '@/lib/announcements-server';

export default async function Home() {
    const announcements = await fetchActiveAnnouncements(4).catch(() => []);

    return (
        <>
            <Hero />
            <LeaderAccessNoticeBanner />
            <HomeCoreActions />
            <AnnouncementsPanel announcements={announcements} />
        </>
    );
}
