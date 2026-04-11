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

const commentsRouteSource = read(path.join('app', 'api', 'tickets', '[id]', 'comments', 'route.ts'));
assert(commentsRouteSource.includes('const COMMENTS_RANGE = `${COMMENTS_TAB}!A2:H`;'), 'Comments route should read full A:H comments schema.');
assert(commentsRouteSource.includes('const COMMENTS_APPEND_RANGE = `${COMMENTS_TAB}!A1`;'), 'Comments route should append comments using tab A1 append range.');
assert(commentsRouteSource.includes('lookupTicketByIdForOwner'), 'Comments route should validate ticket access via owner-aware lookup.');
assert(commentsRouteSource.includes('checkRateLimit'), 'Comments route should enforce rate limits.');
assert(commentsRouteSource.includes('withNoStore'), 'Comments route should disable caching for sensitive responses.');
assert(commentsRouteSource.includes('TicketCommentSchema = z.object'), 'Comments route should validate request payload with zod.');
assert(commentsRouteSource.includes('uploadTicketAttachmentToDrive'), 'Comments route should upload optional follow-up attachments to Drive.');
assert(commentsRouteSource.includes('transitionTicketToAppealedIfNeeded'), 'Comments route should support appeal-driven status transition checks.');
assert(commentsRouteSource.includes("updateSheetCell(spreadsheetId, `Tickets!C${sheetRowNumber}`, [['Appealed']]);"), 'Comments route should set ticket status to Appealed when appeal conditions are met.');
assert(commentsRouteSource.includes("comment.isAppeal ? 'TRUE' : 'FALSE'"), 'Comments route should persist Is_Appeal marker in sheet rows.');

const trackPageSource = read(path.join('app', 'services', 'track', 'page.tsx'));
assert(trackPageSource.includes('Follow-up Documents (Optional)'), 'Track page should include optional follow-up documents section.');
assert(trackPageSource.includes('window.confirm('), 'Track page should warn before submitting follow-up without documentation.');
assert(trackPageSource.includes("payload.set('attachment', attachment);"), 'Track page should send follow-up attachment in FormData when provided.');
assert(trackPageSource.includes("payload.set('isAppeal', String(isAppeal));"), 'Track page should allow posting as formal appeal.');
assert(trackPageSource.includes('View Follow-up Document'), 'Track page should render links to uploaded follow-up documents.');

const ticketConstantsSource = read(path.join('lib', 'ticket-constants.ts'));
assert(ticketConstantsSource.includes("'Appealed'"), 'Ticket status constants should include Appealed state.');

console.log('test-ticket-comments-appeals: PASS');
