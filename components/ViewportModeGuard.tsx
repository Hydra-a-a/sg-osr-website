'use client';

import { useEffect } from 'react';

const VIEWPORT_MODE_EVENT = 'viewport-mode-change';

function detectMobileDesktopMode(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    const userAgent = navigator.userAgent || '';
    const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|BlackBerry|Opera Mini/i.test(userAgent);
    const isIPadOS = /Macintosh/i.test(userAgent) && (navigator.maxTouchPoints || 0) > 1;

    // Desktop operating systems (Windows, macOS, Linux) without mobile UA or iPadOS touch signals
    // must never be classified as mobile desktop mode.
    if (!mobileUserAgent && !isIPadOS) {
        return false;
    }

    const touchPoints = navigator.maxTouchPoints || 0;
    const coarsePointer = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const shortestEdge = Math.min(window.screen.width || window.innerWidth, window.screen.height || window.innerHeight);
    const viewportMismatch = shortestEdge > 0 ? window.innerWidth / shortestEdge : 1;

    return (
        (touchPoints > 0 || coarsePointer || mobileUserAgent)
        && shortestEdge <= 1024
        && window.innerWidth >= 900
        && viewportMismatch >= 1.4
    );
}

function syncViewportMode() {
    const mobileDesktopMode = detectMobileDesktopMode();
    const root = document.documentElement;

    if (mobileDesktopMode) {
        root.dataset.mobileDesktopMode = 'true';
    } else {
        delete root.dataset.mobileDesktopMode;
    }

    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
        viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
    }

    window.dispatchEvent(new CustomEvent(VIEWPORT_MODE_EVENT, {
        detail: { mobileDesktopMode },
    }));
}

export default function ViewportModeGuard() {
    useEffect(() => {
        syncViewportMode();

        const handleViewportChange = () => {
            syncViewportMode();
        };

        window.addEventListener('resize', handleViewportChange, { passive: true });
        window.addEventListener('orientationchange', handleViewportChange);

        return () => {
            window.removeEventListener('resize', handleViewportChange);
            window.removeEventListener('orientationchange', handleViewportChange);
        };
    }, []);

    return null;
}
