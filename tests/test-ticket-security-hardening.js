const fs = require('fs');
const path = require('path');

const ticketsPath = path.join(__dirname, '..', 'lib', 'tickets.ts');
const ticketCreateRoutePath = path.join(__dirname, '..', 'app', 'api', 'tickets', 'route.ts');
const ticketLookupRoutePath = path.join(__dirname, '..', 'app', 'api', 'tickets', '[id]', 'route.ts');
const emailTemplatesPath = path.join(__dirname, '..', 'lib', 'email-templates.ts');
const driveUploadPath = path.join(__dirname, '..', 'lib', 'google-drive.ts');

const ticketsSource = fs.readFileSync(ticketsPath, 'utf8');
const ticketCreateRouteSource = fs.readFileSync(ticketCreateRoutePath, 'utf8');
const ticketLookupRouteSource = fs.readFileSync(ticketLookupRoutePath, 'utf8');
const emailTemplatesSource = fs.readFileSync(emailTemplatesPath, 'utf8');
const driveUploadSource = fs.readFileSync(driveUploadPath, 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(ticketsSource.includes('randomBytes'), 'Ticket IDs/tokens should use cryptographically secure random bytes.');
assert(!ticketsSource.includes('Math.random('), 'Math.random-based ticket ID generation is still present.');
assert(ticketsSource.includes('TRACKING_TOKEN_HASH'), 'Ticket storage is missing tracking token hash column support.');
assert(ticketsSource.includes('detailsRedacted: !allowSensitiveFields'), 'Ticket lookup should redact sensitive fields when access token is missing/invalid.');
assert(ticketsSource.includes('A2:N'), 'Ticket data range should include expanded grievance fields (A2:N).');
assert(ticketsSource.includes('COMPLAINT'), 'Ticket columns should include complaint narrative mapping.');
assert(ticketsSource.includes('ATTACHMENT_URL'), 'Ticket columns should include attachment URL mapping.');

assert(ticketCreateRouteSource.includes('hashTicketTrackingToken(trackingToken)'), 'Ticket submission route must hash tracking token before storage.');
assert(ticketCreateRouteSource.includes('normalizedContact !== sessionEmail'), 'Ticket submission route should reject arbitrary outbound contact emails.');
assert(ticketCreateRouteSource.includes('trackingAccessToken: trackingToken'), 'Ticket submission route should return tracking token to requester.');
assert(ticketCreateRouteSource.includes('multipart/form-data'), 'Ticket submission route should support multipart form uploads.');
assert(ticketCreateRouteSource.includes('uploadTicketAttachmentToDrive'), 'Ticket submission route should call Google Drive upload helper for attachments.');
assert(ticketCreateRouteSource.includes('MAX_ATTACHMENT_BYTES'), 'Ticket submission route should enforce server-side attachment size limits.');

assert(ticketLookupRouteSource.includes("url.searchParams.get('access')"), 'Ticket lookup route should read secure access token from query string.');
assert(ticketLookupRouteSource.includes('lookupTicketById(rawId, trackingToken)'), 'Ticket lookup route should pass access token into lookup function.');

assert(emailTemplatesSource.includes("import { escapeHtml, sanitizeRichText } from '@/lib/security';"), 'Email templates should use security escaping helpers.');
assert(!emailTemplatesSource.includes('${props.message}</blockquote>'), 'Regent alert template still interpolates raw message HTML.');
assert(!emailTemplatesSource.includes('props.message.substring(0, 500)'), 'Student confirmation template should sanitize message preview before interpolation.');
assert(emailTemplatesSource.includes('Complaint Narrative'), 'Email templates should use complaint narrative terminology.');

assert(driveUploadSource.includes('GOOGLE_DRIVE_GRIEVANCE_FOLDER_ID'), 'Drive upload helper should support configurable folder ID env var.');
assert(driveUploadSource.includes('drive.files.create'), 'Drive upload helper should upload files using Google Drive API.');

console.log('test-ticket-security-hardening: PASS');
