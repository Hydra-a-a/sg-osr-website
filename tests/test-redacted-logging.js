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

const securitySource = read(path.join('lib', 'security.ts'));
assert(securitySource.includes('export function redactErrorForLog(error: unknown)'), 'redactErrorForLog helper is missing from lib/security.ts.');
assert(securitySource.includes('SENSITIVE_KEY_REGEX'), 'Sensitive key redaction pattern is missing from lib/security.ts.');

const filesThatMustUseRedaction = [
  path.join('app', 'api', 'forms', 'route.ts'),
  path.join('app', 'api', 'news', 'route.ts'),
  path.join('app', 'api', 'config', 'links', 'route.ts'),
  path.join('app', 'api', 'directory', 'route.ts'),
  path.join('app', 'api', 'classroom', 'submissions', 'route.ts'),
  path.join('app', 'api', 'classroom', 'courses', 'route.ts'),
  path.join('app', 'api', 'classroom', 'courses', '[courseId]', 'coursework', 'route.ts'),
  path.join('app', 'api', 'webhooks', 'make', 'route.ts'),
  path.join('lib', 'sheets.ts'),
  path.join('lib', 'auth.ts'),
  path.join('lib', 'google.ts'),
];

for (const filePath of filesThatMustUseRedaction) {
  const source = read(filePath);
  assert(source.includes('redactErrorForLog('), `Expected redacted logging usage in ${filePath}`);
}

console.log('test-redacted-logging: PASS');
