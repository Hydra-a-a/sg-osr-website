import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import LeaderAccessNoticeClient from '@/components/LeaderAccessNoticeClient';
import { LEADER_ATTEMPT_COOKIE, PORTAL_MODE_COOKIE } from '@/lib/portal-mode';
import { getAccessVisibilityState } from '@/lib/access-visibility';

export default async function LeaderAccessNoticeBanner() {
    const [session, cookieStore] = await Promise.all([auth(), cookies()]);
    const visibility = getAccessVisibilityState(
        session?.user?.role,
        cookieStore.get(PORTAL_MODE_COOKIE)?.value || '',
        cookieStore.get(LEADER_ATTEMPT_COOKIE)?.value || '',
    );

    if (!session?.user || !visibility.showLeaderAttemptNotice) return null;

    return <LeaderAccessNoticeClient canSwitchToLeaderMode={visibility.canSwitchToLeaderMode} />;
}
