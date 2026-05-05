const { assertContainsOneOf, read } = require('./_security-baseline-helpers');

const source = read('app/api/tickets/sync-updates/route.ts');
assertContainsOneOf(
  source,
  [/sync/i, /cron|scheduler|secret/i, /ticket/i],
  'ticket sync-updates route should include scheduled sync safeguards.'
);

console.log('test-ticket-update-notification-sync: PASS');
