const { assert, read } = require('./_security-baseline-helpers');

const routeSource = read('app/api/tickets/route.ts');

assert.ok(
  routeSource.includes("@/features/tickets/server/create-ticket"),
  'tickets route should import create-ticket feature module.'
);

assert.ok(
  !routeSource.includes('const TicketSubmissionSchema = z.object('),
  'TicketSubmissionSchema should no longer be defined directly in app/api/tickets/route.ts.'
);

assert.ok(routeSource.includes('auth('), 'tickets route should retain auth() handling.');
assert.ok(
  routeSource.includes('requireSameOriginRequest(request)'),
  'tickets route should retain same-origin guard.'
);
assert.ok(routeSource.includes('checkRateLimit'), 'tickets route should retain rate limiting checks.');
assert.ok(routeSource.includes("@/lib/api-responses"), 'tickets route should use shared no-store response helpers.');

const createTicketSource = read('features/tickets/server/create-ticket.ts');
assert.ok(
  createTicketSource.includes('uploadTicketAttachmentToDrive'),
  'create-ticket module should own attachment upload.'
);
assert.ok(
  createTicketSource.includes('writeTicketToSheet'),
  'create-ticket module should own ticket sheet writes.'
);
assert.ok(
  createTicketSource.includes('emitGrievanceSubmissionNotifications'),
  'create-ticket module should own submission notification emission.'
);
assert.ok(
  createTicketSource.includes('safeProcessImmediateNotifications'),
  'create-ticket module should own immediate queue processing fallback.'
);
assert.ok(
  createTicketSource.includes("logAuditAction('TICKET_SUBMITTED'"),
  'create-ticket module should own success audit logging.'
);

const schemaSource = read('features/tickets/schema.ts');
assert.ok(
  schemaSource.includes('export const TicketSubmissionSchema'),
  'ticket schema module should export TicketSubmissionSchema.'
);

console.log('test-ticket-feature-boundaries: PASS');
