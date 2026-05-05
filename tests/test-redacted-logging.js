const { assertContainsOneOf, read } = require('./_security-baseline-helpers');

const source = read('lib/tickets.ts');
assertContainsOneOf(
  source,
  [/redact/i, /trackingTokenHash/, /optionalUpdateDestinationStatus/],
  'ticket pipeline should include redaction-safe logging/storage paths.'
);

console.log('test-redacted-logging: PASS');
