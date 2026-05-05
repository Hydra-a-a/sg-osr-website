const { assertContainsOneOf, read } = require('./_security-baseline-helpers');

const source = read('proxy.ts');
assertContainsOneOf(
  source,
  [/Content-Security-Policy/, /buildCspHeader/, /CSP/i],
  'proxy.ts should apply CSP headers.'
);

console.log('test-csp-policy: PASS');
