const { assert, read } = require('./_security-baseline-helpers');

const tickets = read('lib/tickets.ts');
const proposals = read('lib/proposals.ts');
const proposalAccessModule = read('features/proposals/server/access.ts');
const ticketCommentsRoute = read('app/api/tickets/[id]/comments/route.ts');
const ticketCommentsModule = read('features/tickets/server/comments.ts');
const proposalLookupRoute = read('app/api/proposals/[id]/route.ts');
const proposalCommentsRoute = read('app/api/proposals/[id]/comments/route.ts');

assert(
  tickets.includes('function isDeliverableOwnerEmail') &&
    tickets.includes("value === 'anonymous@rtu.edu.ph'") &&
    tickets.includes('return /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value);'),
  'ticket ownership should reject anonymous/non-deliverable owner emails.'
);

assert(
  tickets.includes('const ownerMatch = Boolean(normalizedOwnerEmail)') &&
    tickets.includes('&& isDeliverableOwnerEmail(rowEmail)') &&
    tickets.includes('&& rowEmail === normalizedOwnerEmail'),
  'ticket lookup should require a normalized deliverable owner-email match.'
);

assert(
  tickets.includes('const tokenMatch = hasTrackingHash') &&
    tickets.includes('&& hasProvidedToken') &&
    tickets.includes('&& verifyTicketTrackingToken(normalizedToken, trackingHash)'),
  'ticket lookup should require a stored hash and provided token before token access is allowed.'
);

assert(
  tickets.includes('const allowSensitiveFields = ownerMatch || tokenMatch') &&
    tickets.includes('detailsRedacted: !allowSensitiveFields') &&
    tickets.includes('complaintNarrative: allowSensitiveFields'),
  'ticket detail fields should only be unredacted for owner or valid tracking-token access.'
);

assert(
  ticketCommentsRoute.includes("@/features/tickets/server/comments") &&
    ticketCommentsModule.includes('ownerAllowed: Boolean(ticket && !ticket.detailsRedacted)'),
  'ticket comments should only allow non-privileged access when ticket details are unredacted.'
);

assert(
  ticketCommentsModule.includes('const privileged = hasLeaderPrivilege(effectiveRole)'),
  'ticket comments should base privileged discussion access on effective portal role.'
);

assert(
  proposals.includes('const canBypassOwnership = Boolean(options?.allowPrivileged)') &&
    proposals.includes("String(options?.effectiveRole || '').trim().toLowerCase() === 'officer'"),
  'proposal lookup should require both actual officer privilege and effective officer mode to bypass ownership.'
);

assert(
  proposals.includes('const ownerMatch = proposal.submitterEmail === normalizedOwnerEmail') &&
    proposals.includes('verifyProposalTrackingToken(normalizedTrackingToken, proposal.trackingTokenHash)') &&
    proposals.includes('return ownerMatch || tokenMatch ? mapProposalRow(row, rowNumber) : null'),
  'proposal lookup should return data only for owner, valid tracking token, or officer bypass.'
);

assert(
  proposalAccessModule.includes('allowPrivileged: isOfficer') &&
    proposalAccessModule.includes('effectiveRole'),
  'proposal access module should pass both actual officer privilege and effective role into ownership lookup.'
);

assert(
  proposalLookupRoute.includes('resolveProposalAccess') &&
    proposalCommentsRoute.includes('appendProposalCommentOrchestration') &&
    proposalCommentsRoute.includes('listProposalCommentsForResponse'),
  'proposal routes should delegate ownership checks through proposal feature modules.'
);

console.log('test-object-access-contracts: PASS');
