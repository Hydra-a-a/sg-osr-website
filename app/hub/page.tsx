import HubClient from '@/components/hub/HubClient';
import LeaderAccessNoticeBanner from '@/components/LeaderAccessNoticeBanner';
import { loadHubGuides } from '@/lib/hub-guides';

export const revalidate = 3600;
export const dynamic = 'force-dynamic';

export default async function HubPage() {
    const guides = await loadHubGuides({ fallbackOnError: true });
    return (
        <>
            <LeaderAccessNoticeBanner />
            <HubClient initialGuides={guides} />
        </>
    );
}
