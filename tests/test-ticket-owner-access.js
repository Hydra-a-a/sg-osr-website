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

const ticketsSource = read(path.join('lib', 'tickets.ts'));
assert(ticketsSource.includes('export async function lookupTicketByIdForOwner'), 'Owner-aware ticket lookup helper should be exported.');
assert(ticketsSource.includes('export async function listTicketsByOwnerEmail(ownerEmail: string)'), 'Owner email ticket listing helper should be exported.');
assert(ticketsSource.includes('const ownerMatch = Boolean(normalizedOwnerEmail)'), 'Owner-aware lookup should detect owner email matches.');
assert(ticketsSource.includes('detailsRedacted: !allowSensitiveFields'), 'Owner-aware lookup should redact sensitive fields when neither token nor owner matches.');

const ticketLookupRouteSource = read(path.join('app', 'api', 'tickets', '[id]', 'route.ts'));
assert(ticketLookupRouteSource.includes("import { auth } from '@/lib/auth';"), 'Ticket lookup route should load session auth for owner access checks.');
assert(ticketLookupRouteSource.includes('const ownerEmail = session?.user?.email || \'\';'), 'Ticket lookup route should resolve owner email from session.');
assert(ticketLookupRouteSource.includes('lookupTicketByIdForOwner(rawId, {'), 'Ticket lookup route should call owner-aware lookup helper.');
assert(ticketLookupRouteSource.includes('trackingToken,'), 'Ticket lookup route should pass tracking token into owner-aware lookup options.');
assert(ticketLookupRouteSource.includes('ownerEmail,'), 'Ticket lookup route should pass owner email into owner-aware lookup options.');

const mineRouteSource = read(path.join('app', 'api', 'tickets', 'mine', 'route.ts'));
assert(mineRouteSource.includes('listTicketsByOwnerEmail(ownerEmail)'), 'My tickets route should query ticket list by owner email.');
assert(mineRouteSource.includes('new ApiError(401, \'UNAUTHORIZED\', \'Unauthorized\')'), 'My tickets route should reject unauthenticated requests.');
assert(mineRouteSource.includes('ticket_mine_${ownerEmail}_${ip}'), 'My tickets route should rate-limit using owner+IP key.');

const trackPageSource = read(path.join('app', 'services', 'track', 'page.tsx'));
assert(trackPageSource.includes("fetch('/api/tickets/mine'"), 'Track page should request authenticated my-ticket history.');
assert(trackPageSource.includes('mergeTicketHistory(serverTickets, current)'), 'Track page should merge server history with local ticket history.');

console.log('test-ticket-owner-access: PASS');
