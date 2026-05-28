import { auth } from '@/lib/auth';
import type { Session } from 'next-auth';
import { getAuthorizedUsers } from '@/lib/auth';
import { ApiError } from '@/lib/api-errors';
import { deriveEffectivePortalRole, hasOfficerPrivilege } from '@/lib/portal-mode';
import { redactErrorForLog } from '@/lib/security';
import {
  listProposalsBySubmitterEmail as listProposalsBySubmitterEmailFromLib,
  lookupProposalByIdForOwner as lookupProposalByIdForOwnerFromLib,
} from '@/lib/proposals';

export async function requireLeaderOrOfficerSession(portalModeCookie: string | undefined) {
  const session = await auth();
  if (!session?.user?.email) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required.');
  }

  const effectiveRole = deriveEffectivePortalRole((session.user as { role?: unknown }).role, portalModeCookie);
  if (effectiveRole !== 'leader' && effectiveRole !== 'officer') {
    throw new ApiError(403, 'FORBIDDEN', 'Leader or officer mode is required.');
  }

  return session;
}

export function listProposalsBySubmitterEmail(submitterEmail: string) {
  return listProposalsBySubmitterEmailFromLib(submitterEmail);
}

export function lookupProposalByIdForOwner(
  proposalId: string,
  options?: {
    ownerEmail?: string | null;
    trackingToken?: string | null;
    allowPrivileged?: boolean;
    effectiveRole?: string | null;
  },
) {
  return lookupProposalByIdForOwnerFromLib(proposalId, options);
}

export async function resolveOfficerDisplayName(authorEmail: string, fallbackName = 'OSR Officer'): Promise<string> {
  const normalizedEmail = String(authorEmail || '').trim().toLowerCase();
  if (!normalizedEmail) {
    return fallbackName;
  }

  try {
    const authorizedUsers = await getAuthorizedUsers();
    const userRecord = authorizedUsers.get(normalizedEmail);
    if (userRecord?.name?.trim()) {
      return userRecord.name.trim();
    }
    if (userRecord?.council?.trim()) {
      return userRecord.council.trim();
    }
  } catch (error) {
    console.warn('[Proposal Comments API] Failed to resolve officer display name:', redactErrorForLog(error));
  }

  return fallbackName;
}

export async function resolveProposalAccess(input: {
  proposalId: string;
  trackingToken?: string;
  session: Session | null;
  portalModeCookie: string | undefined;
}) {
  const { proposalId, trackingToken = '', session, portalModeCookie } = input;
  const effectiveRole = session?.user
    ? deriveEffectivePortalRole((session.user as { role?: unknown }).role, portalModeCookie)
    : null;
  const isOfficer = hasOfficerPrivilege((session?.user as { role?: unknown } | undefined)?.role);

  const proposal = await lookupProposalByIdForOwnerFromLib(proposalId, {
    ownerEmail: session?.user?.email,
    trackingToken,
    allowPrivileged: isOfficer,
    effectiveRole,
  });

  return {
    session,
    effectiveRole,
    isOfficer,
    proposal,
  };
}
