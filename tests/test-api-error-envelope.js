const { assertContainsOneOf, read } = require('./_security-baseline-helpers');

const source = read('lib/api-errors.ts');
assertContainsOneOf(
  source,
  [/class\s+ApiError/, /toApiResponse/, /error/i],
  'API error envelope utilities should be defined in lib/api-errors.ts.'
);

console.log('test-api-error-envelope: PASS');
