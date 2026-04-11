const fs = require('fs');
const path = require('path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const grievanceSource = read(path.join('lib', 'grievance-notifications.ts'));
[
  'grievance.submitted.v1',
  'grievance.status.changed.v1',
  'grievance.resolution.updated.v1',
  'grievance.published.v1',
  'grievance.appeal.submitted.v1',
  'grievance.comment.added.v1',
].forEach((eventName) => {
  assert(grievanceSource.includes(eventName), `Grievance notifications should support ${eventName}.`);
});

const proposalSource = read(path.join('lib', 'proposal-notifications.ts'));
[
  'proposal.submitted.v1',
  'proposal.status.changed.v1',
  'proposal.review.note.added.v1',
  'proposal.comment.added.v1',
].forEach((eventName) => {
  assert(proposalSource.includes(eventName), `Proposal notifications should support ${eventName}.`);
});

const queueSource = read(path.join('lib', 'notification-queue.ts'));
[
  'dedupeKey',
  'dead_letter',
  'MAX_ATTEMPTS = 5',
  'RETRY_BACKOFF_MS = [0, 60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000]',
  'NOTIFICATION_ENQUEUED',
  'NOTIFICATION_SENT',
  'NOTIFICATION_DEAD_LETTER',
].forEach((marker) => {
  assert(queueSource.includes(marker), `Notification queue should include marker: ${marker}`);
});

const ticketRouteSource = read(path.join('app', 'api', 'tickets', 'route.ts'));
assert(ticketRouteSource.includes('emitGrievanceSubmissionNotifications'), 'Ticket submit route should enqueue grievance submission events.');

const adminTicketRouteSource = read(path.join('app', 'api', 'admin', 'tickets', 'route.ts'));
assert(adminTicketRouteSource.includes('emitGrievanceAdminUpdateNotifications'), 'Admin ticket route should enqueue grievance admin update events.');

const ticketCommentsRouteSource = read(path.join('app', 'api', 'tickets', '[id]', 'comments', 'route.ts'));
assert(ticketCommentsRouteSource.includes('emitGrievanceCommentNotifications'), 'Ticket comments route should enqueue grievance comment and appeal events.');

const proposalRouteSource = read(path.join('app', 'api', 'proposals', 'route.ts'));
assert(proposalRouteSource.includes('emitProposalSubmissionNotifications'), 'Proposal submit route should enqueue proposal submission events.');

const adminProposalRouteSource = read(path.join('app', 'api', 'admin', 'proposals', 'route.ts'));
assert(adminProposalRouteSource.includes('emitProposalAdminUpdateNotifications'), 'Admin proposal route should enqueue proposal admin update events.');

const proposalCommentsRouteSource = read(path.join('app', 'api', 'proposals', '[id]', 'comments', 'route.ts'));
assert(proposalCommentsRouteSource.includes('emitProposalCommentNotifications'), 'Proposal comments route should enqueue proposal comment events.');

console.log('test-unified-notification-system: PASS');
