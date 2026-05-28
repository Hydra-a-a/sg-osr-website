import {
    deriveEffectivePortalRole,
    hasLeaderPrivilege,
    hasOfficerPrivilege,
    normalizePortalRole,
    shouldShowLeaderAccessDeniedNotice,
    type PortalRole,
} from '@/lib/portal-mode';

export type AccessVisibilityState = {
    actualRole: PortalRole;
    effectiveRole: PortalRole;
    canSeeLeaderFeatures: boolean;
    canSeeOfficerFeatures: boolean;
    showLeaderAttemptNotice: boolean;
    canSwitchToLeaderMode: boolean;
};

export function getAccessVisibilityState(
    userRole: unknown,
    portalMode: unknown,
    attemptedLeaderAccess: unknown
): AccessVisibilityState {
    const actualRole = normalizePortalRole(userRole);
    const effectiveRole = deriveEffectivePortalRole(userRole, portalMode);
    const canSeeLeaderFeatures = hasLeaderPrivilege(effectiveRole);
    const canSeeOfficerFeatures = hasOfficerPrivilege(effectiveRole);
    const showLeaderAttemptNotice = shouldShowLeaderAccessDeniedNotice(userRole, attemptedLeaderAccess);
    const canSwitchToLeaderMode = hasLeaderPrivilege(userRole) && !canSeeLeaderFeatures;

    return {
        actualRole,
        effectiveRole,
        canSeeLeaderFeatures,
        canSeeOfficerFeatures,
        showLeaderAttemptNotice,
        canSwitchToLeaderMode,
    };
}
