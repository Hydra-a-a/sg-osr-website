const { assertContainsOneOf, read } = require('./_security-baseline-helpers');

const source = read('app/api/tickets/[id]/comments/route.ts');
assertContainsOneOf(
  source,
  [/comments/i, /trackingToken/i, /unauthorized|forbidden/i],
  'ticket comments route should enforce guarded follow-up access.'
);

console.log('test-ticket-comments-appeals: PASS');
