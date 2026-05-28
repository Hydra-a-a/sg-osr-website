'use client';

import { useState, useSyncExternalStore } from 'react';
import { useSession } from 'next-auth/react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { LEADER_ATTEMPT_COOKIE, PORTAL_MODE_COOKIE } from '@/lib/portal-mode';
import { getAccessVisibilityState } from '@/lib/access-visibility';

function getCookieSnapshot(): string {
    if (typeof document === 'undefined') {
        return '';
    }
    return document.cookie;
}

function subscribeNoop(): () => void {
    return () => {};
}

function readCookieValueFromSnapshot(cookieSnapshot: string, name: string): string {
    const cookie = cookieSnapshot
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${name}=`));
    return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : '';
}

function clearLeaderAttemptCookie() {
    if (typeof window === 'undefined') return;
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${LEADER_ATTEMPT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

function setPortalModeLeader() {
    if (typeof window === 'undefined') return;
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${PORTAL_MODE_COOKIE}=leader; Path=/; Max-Age=1209600; SameSite=Lax${secure}`;
}

export default function LeaderAccessNoticeBanner() {
    const { data: session, status } = useSession();
    const [dismissed, setDismissed] = useState(false);
    const cookieSnapshot = useSyncExternalStore(subscribeNoop, getCookieSnapshot, () => '');
    const portalMode = readCookieValueFromSnapshot(cookieSnapshot, PORTAL_MODE_COOKIE);
    const leaderAttempt = readCookieValueFromSnapshot(cookieSnapshot, LEADER_ATTEMPT_COOKIE);
    const visibility = getAccessVisibilityState(session?.user?.role, portalMode, leaderAttempt);

    if (status !== 'authenticated' || !session?.user || dismissed || !visibility.showLeaderAttemptNotice) {
        return null;
    }

    const handleDismiss = () => {
        clearLeaderAttemptCookie();
        setDismissed(true);
    };

    const handleSwitch = () => {
        setPortalModeLeader();
        clearLeaderAttemptCookie();
        window.location.reload();
    };

    return (
        <section className="container-main relative z-20 mb-6 mt-6">
            <div className="rounded-2xl border border-amber-300/35 bg-amber-500/14 p-4 text-amber-50 shadow-[0_16px_44px_rgba(120,53,15,0.22)]">
                <div className="flex items-start gap-3">
                    <ExclamationTriangleIcon className="mt-0.5 h-[18px] w-[18px] shrink-0 text-amber-200" aria-hidden="true" />
                    <div className="flex-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-200/90">Access Notice</p>
                        <p className="mt-1 text-sm leading-relaxed">
                            {visibility.canSwitchToLeaderMode
                                ? 'You signed in through Student Leader Access, but your active mode is Student. Switch modes to open leader tools.'
                                : 'You signed in through Student Leader Access, but this account does not have leader privileges. You can continue in Student Mode.'}
                        </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                        {visibility.canSwitchToLeaderMode && (
                            <button
                                type="button"
                                onClick={handleSwitch}
                                className="rounded-xl bg-amber-300 px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-amber-200"
                            >
                                Switch to Leader Mode
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleDismiss}
                            className="rounded-xl border border-amber-200/40 px-3 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/20"
                        >
                            {visibility.canSwitchToLeaderMode ? 'Dismiss' : 'Continue in Student Mode'}
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
}
