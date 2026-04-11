export const PORTAL_MODE_COOKIE = 'osr_portal_mode';
export const LEADER_ATTEMPT_COOKIE = 'osr_leader_attempt';
export const OFFICER_ATTEMPT_COOKIE = 'osr_officer_attempt';

export type PortalRole = 'student' | 'leader' | 'officer';

/**
 * Role hierarchy: officer > leader > student
 * Officers inherit all leader privileges.
 */
const ROLE_HIERARCHY: Record<PortalRole, number> = {
    student: 0,
    leader: 1,
    officer: 2,
};

export function normalizePortalRole(value: unknown): PortalRole {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (normalized === 'officer') return 'officer';
    if (normalized === 'leader') return 'leader';
    return 'student';
}

/**
 * Derives the effective portal role, supporting hierarchical downgrading.
 * An officer can switch to leader or student mode.
 * A leader can switch to student mode.
 * A student cannot escalate.
 */
export function deriveEffectivePortalRole(userRole: unknown, portalMode: unknown): PortalRole {
    const actualRole = normalizePortalRole(userRole);
    if (actualRole === 'student') {
        return 'student';
    }

    const requestedMode = String(portalMode ?? '').trim().toLowerCase();

    // No explicit mode override
    if (!requestedMode) {
        // Gating: Officers default to 'leader' mode to keep admin access hidden by default.
        if (actualRole === 'officer') return 'leader';
        return actualRole;
    }

    if (requestedMode === actualRole) {
        return actualRole;
    }

    const requestedRole = normalizePortalRole(requestedMode);

    // Only allow downgrading, never escalation
    if (ROLE_HIERARCHY[requestedRole] < ROLE_HIERARCHY[actualRole]) {
        return requestedRole;
    }

    return actualRole;
}

/** Returns true if the actual account role has at least leader-level privileges. */
export function hasLeaderPrivilege(userRole: unknown): boolean {
    return ROLE_HIERARCHY[normalizePortalRole(userRole)] >= ROLE_HIERARCHY.leader;
}

/** Returns true if the actual account role has officer-level privileges. */
export function hasOfficerPrivilege(userRole: unknown): boolean {
    return normalizePortalRole(userRole) === 'officer';
}

export function shouldShowLeaderAccessDeniedNotice(userRole: unknown, attemptedLeaderAccess: unknown): boolean {
    const attempted = String(attemptedLeaderAccess ?? '').trim() === '1';
    return attempted && !hasLeaderPrivilege(userRole);
}

/** 
 * Returns true if the user is an officer but currently operating in a lower-privilege mode,
 * and they've tried to access an officer-only feature.
 */
export function shouldShowOfficerAccessNotice(userRole: unknown, effectiveRole: PortalRole, attemptedOfficerAccess: unknown): boolean {
    const isActuallyOfficer = hasOfficerPrivilege(userRole);
    const inLowerMode = effectiveRole !== 'officer';
    const attempted = String(attemptedOfficerAccess ?? '').trim() === '1';
    return isActuallyOfficer && inLowerMode && attempted;
}
