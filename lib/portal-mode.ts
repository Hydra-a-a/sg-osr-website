export const PORTAL_MODE_COOKIE = 'osr_portal_mode';
export const LEADER_ATTEMPT_COOKIE = 'osr_leader_attempt';

export type PortalRole = 'student' | 'leader';

export function normalizePortalRole(value: unknown): PortalRole {
    const normalized = String(value ?? '').trim().toLowerCase();
    return normalized === 'leader' ? 'leader' : 'student';
}

export function deriveEffectivePortalRole(userRole: unknown, portalMode: unknown): PortalRole {
    const normalizedUserRole = normalizePortalRole(userRole);
    if (normalizedUserRole !== 'leader') {
        return 'student';
    }

    const normalizedPortalMode = String(portalMode ?? '').trim().toLowerCase();
    if (normalizedPortalMode === 'student') {
        return 'student';
    }

    return 'leader';
}

export function shouldShowLeaderAccessDeniedNotice(userRole: unknown, attemptedLeaderAccess: unknown): boolean {
    const attempted = String(attemptedLeaderAccess ?? '').trim() === '1';
    return attempted && normalizePortalRole(userRole) !== 'leader';
}
