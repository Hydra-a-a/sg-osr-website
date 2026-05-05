const { assertContainsOneOf, read } = require('./_security-baseline-helpers');

const source = read('app/api/tickets/[id]/route.ts');
assertContainsOneOf(
  source,
  [/ownerEmail/, /detailsRedacted/, /trackingToken/i],
  'ticket owner access path should be represented in lookup route logic.'
);

console.log('test-ticket-owner-access: PASS');
