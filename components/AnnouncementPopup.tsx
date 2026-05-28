'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertTriangle, X } from 'lucide-react';
import { dismissForSession, emitAnnouncementEvent, isDismissed, isSnoozed, snoozeForSession } from '@/lib/announcements-client';
import { shouldPopup, type Announcement } from '@/lib/announcements';

interface AnnouncementResponse {
    data?: Announcement[];
}

const PAGE_SWITCH_COUNTER_KEY = 'ann_v2_page_switch_count';
const POPUP_CADENCE = 3;
const FORCE_SHOW_IN_DEV = process.env.NODE_ENV !== 'production';

function pickAnnouncements(items: Announcement[]): Announcement[] {
    return items.filter((item) => shouldPopup(item)).slice(0, 3);
}

export default function AnnouncementPopup() {
    const pathname = usePathname();
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [open, setOpen] = useState(false);
    const [closing, setClosing] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    const isBlockedRoute = useMemo(
        () => pathname === '/' || pathname === '/osr' || pathname.startsWith('/hub'),
        [pathname]
    );

    useEffect(() => {
        if (isBlockedRoute) return;
        if (!FORCE_SHOW_IN_DEV) {
            const pageSwitchCount = Number.parseInt(sessionStorage.getItem(PAGE_SWITCH_COUNTER_KEY) || '0', 10) || 0;
            const nextCount = pageSwitchCount + 1;
            sessionStorage.setItem(PAGE_SWITCH_COUNTER_KEY, String(nextCount));
            if (nextCount % POPUP_CADENCE !== 0) return;
        }

        let cancelled = false;
        fetch('/api/announcements')
            .then((res) => res.json())
            .then((payload: AnnouncementResponse) => {
                if (cancelled) return;
                const candidates = pickAnnouncements(payload.data || []).filter((item) => {
                    if (FORCE_SHOW_IN_DEV) return true;
                    return !isDismissed(item.id) && !isSnoozed(item.id);
                });
                if (!candidates.length) return;

                setAnnouncements(candidates);
                setOpen(true);
                candidates.forEach((item) => {
                    void emitAnnouncementEvent('announcement.view', item.id);
                });
            })
            .catch(() => {
                // no-op fallback
            });

        return () => {
            cancelled = true;
        };
    }, [pathname, isBlockedRoute]);

    useEffect(() => {
        if (!open || !panelRef.current) return;
        panelRef.current.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setClosing(true);
                window.setTimeout(() => {
                    setOpen(false);
                    setClosing(false);
                }, 180);
                return;
            }

            if (event.key === 'Tab' && panelRef.current) {
                const focusable = panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])');
                if (focusable.length === 0) return;

                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                const active = document.activeElement as HTMLElement | null;

                if (!event.shiftKey && active === last) {
                    event.preventDefault();
                    first.focus();
                } else if (event.shiftKey && active === first) {
                    event.preventDefault();
                    last.focus();
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open]);

    if (!announcements.length || !open || isBlockedRoute) return null;

    const first = announcements[0];
    const descriptionId = `announcement-popup-desc-${first.id}`;
    const titleId = `announcement-popup-title-${first.id}`;

    const closePopup = () => {
        setClosing(true);
        window.setTimeout(() => {
            setOpen(false);
            setClosing(false);
        }, 180);
    };

    return (
        <div className="announcement-popup-wrap" aria-live="polite">
            <div
                ref={panelRef}
                className={`announcement-popup ${closing ? 'announcement-popup-exit' : ''}`}
                role="dialog"
                aria-modal="false"
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
                tabIndex={-1}
            >
                <button
                    type="button"
                    className="announcement-popup-close"
                    aria-label="Dismiss announcements for this session"
                    onClick={() => {
                        announcements.forEach((item) => {
                            dismissForSession(item.id);
                            void emitAnnouncementEvent('announcement.dismiss', item.id);
                        });
                        closePopup();
                    }}
                >
                    <X size={16} />
                </button>
                <div className="announcement-popup-icon"><AlertTriangle size={16} /></div>
                <h2 id={titleId} className="announcement-popup-title">Latest SSC and News Updates</h2>
                <p id={descriptionId} className="announcement-popup-summary">Showing the 3 most recent announcements.</p>
                <ul className="announcement-popup-list">
                    {announcements.map((item) => (
                        <li key={item.id} className="announcement-popup-item">
                            <p className="announcement-popup-item-title">{item.title}</p>
                            <Link href={item.href || '/#announcements'} className="announcement-popup-inline-link no-underline">View</Link>
                        </li>
                    ))}
                </ul>
                <div className="announcement-popup-actions">
                    <button
                        type="button"
                        className="announcement-popup-snooze"
                        onClick={() => {
                            announcements.forEach((item) => {
                                snoozeForSession(item.id);
                                void emitAnnouncementEvent('announcement.snooze', item.id);
                            });
                            closePopup();
                        }}
                    >
                        Acknowledged, please ignore
                    </button>
                </div>
            </div>
        </div>
    );
}
