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
assert(ticketsSource.includes('LAST_NOTIFIED_SIGNATURE'), 'Ticket columns should include last notification signature column.');
assert(ticketsSource.includes('LAST_NOTIFIED_AT'), 'Ticket columns should include last notification timestamp column.');
assert(ticketsSource.includes('TICKET_DATA_RANGE = `${TICKET_SHEET_TAB}!A2:P`'), 'Ticket data range should include notification columns O:P.');
assert(ticketsSource.includes('TICKET_SYNC_DATA_RANGE = `${TICKET_SHEET_TAB}!A2:AF`'), 'Ticket sync should read officer + optional update columns through AF.');
assert(ticketsSource.includes('export async function syncTicketUpdateNotifications'), 'Ticket library should expose update notification sync function.');
assert(ticketsSource.includes('buildTicketUpdateEmail'), 'Ticket update sync should send the ticket update email template.');
assert(ticketsSource.includes('batchUpdateSheetData'), 'Ticket update sync should batch-persist notification signatures.');
assert(ticketsSource.includes('anonymous@rtu.edu.ph'), 'Ticket update sync should skip anonymous placeholder emails.');
assert(ticketsSource.includes('resolveTicketUpdateControlMode'), 'Ticket update sync should support configurable control mode.');
assert(ticketsSource.includes("'auto' | 'officer' | 'hybrid'"), 'Ticket update sync should expose auto/officer/hybrid control modes.');
assert(ticketsSource.includes('awaitingOfficerPublish'), 'Ticket update sync should report rows awaiting officer publish approval.');
assert(ticketsSource.includes('migratedLegacySignatures'), 'Ticket update sync should support legacy signature migration without duplicate sends.');
assert(ticketsSource.includes('OPTIONAL_UPDATE_DESTINATION'), 'Ticket columns should include optional update destination support.');
assert(ticketsSource.includes('resolveOptionalUpdateRecipient'), 'Ticket sync should resolve verified optional update recipients.');
assert(ticketsSource.includes('skippedUnverifiedOptionalChannel'), 'Ticket sync should report unverified optional channels that are skipped.');
assert(ticketsSource.includes('optionalChannelUsed'), 'Ticket sync should report when optional channels are used for delivery.');
assert(ticketsSource.includes('enqueueTicketNotificationEvent'), 'Ticket library should expose queue enqueue helper.');
assert(ticketsSource.includes('processTicketNotificationQueue'), 'Ticket library should expose queue processor helper.');
assert(ticketsSource.includes('TICKET_NOTIFICATION_QUEUE_SHEET_TAB'), 'Ticket library should define a notification queue sheet tab.');

const sheetsSource = read(path.join('lib', 'sheets.ts'));
assert(sheetsSource.includes('export async function batchUpdateSheetData'), 'Sheets helper should include batch update support for sync writes.');

const emailTemplatesSource = read(path.join('lib', 'email-templates.ts'));
assert(emailTemplatesSource.includes('export function buildTicketUpdateEmail'), 'Email templates should include ticket update email rendering.');

const syncRouteSource = read(path.join('app', 'api', 'tickets', 'sync-updates', 'route.ts'));
assert(syncRouteSource.includes('syncTicketUpdateNotifications'), 'Ticket update sync route should call syncTicketUpdateNotifications.');
assert(syncRouteSource.includes('TICKET_STATUS_SYNC_SECRET') || syncRouteSource.includes('CRON_SECRET'), 'Ticket update sync route should validate a server-side secret.');
assert(syncRouteSource.includes('timingSafeEqual'), 'Ticket update sync route should compare secrets with timing-safe equality.');

const queueEnqueueRouteSource = read(path.join('app', 'api', 'tickets', 'queue', 'enqueue', 'route.ts'));
assert(queueEnqueueRouteSource.includes('enqueueTicketNotificationEvent'), 'Queue enqueue route should call enqueueTicketNotificationEvent.');
assert(queueEnqueueRouteSource.includes('TICKET_STATUS_SYNC_SECRET') || queueEnqueueRouteSource.includes('CRON_SECRET'), 'Queue enqueue route should validate a server-side secret.');

const queueProcessRouteSource = read(path.join('app', 'api', 'tickets', 'queue', 'process', 'route.ts'));
assert(queueProcessRouteSource.includes('processTicketNotificationQueue'), 'Queue process route should call processTicketNotificationQueue.');
assert(queueProcessRouteSource.includes('timingSafeEqual'), 'Queue process route should compare secrets with timing-safe equality.');

const vercelConfigSource = read('vercel.json');
assert(vercelConfigSource.includes('/api/tickets/sync-updates'), 'Vercel cron should invoke the ticket update sync endpoint.');
assert(vercelConfigSource.includes('/api/tickets/queue/process'), 'Vercel cron should invoke the ticket notification queue processor endpoint.');

console.log('test-ticket-update-notification-sync: PASS');
