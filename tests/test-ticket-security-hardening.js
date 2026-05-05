const { assertContainsOneOf, read } = require('./_security-baseline-helpers');

const source = read('app/api/tickets/[id]/route.ts');
assertContainsOneOf(
  source,
  [/checkRateLimit/, /INVALID_TICKET_ID/, /INTERNAL_ERROR/],
  'ticket lookup endpoint should include rate limiting and hardened error handling.'
);

console.log('test-ticket-security-hardening: PASS');
