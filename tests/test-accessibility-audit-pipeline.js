const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const auditSource = fs.readFileSync(
  path.join(root, 'scripts', 'audit-accessibility.mjs'),
  'utf8'
);
const readmeSource = fs.readFileSync(path.join(root, 'README.md'), 'utf8');

assert.strictEqual(
  packageJson.scripts['audit:quality'],
  'node scripts/audit-accessibility.mjs',
  'package.json should expose audit:quality as the preferred local audit command.'
);

assert.strictEqual(
  packageJson.scripts['audit:a11y'],
  'node scripts/audit-accessibility.mjs',
  'package.json should keep audit:a11y as a compatibility alias.'
);

for (const routeGroup of ['core', 'services', 'hub', 'government', 'all']) {
  assert.match(
    auditSource,
    new RegExp(`${routeGroup}:\\s*\\[`),
    `audit script should define the ${routeGroup} route group.`
  );
}

for (const route of [
  '/',
  '/services',
  '/services/grievance',
  '/services/proposals',
  '/transparency',
  '/hub',
  '/directory',
  '/student-government',
]) {
  assert.ok(
    auditSource.includes(`'${route}'`) || auditSource.includes(`"${route}"`),
    `audit script should include ${route} in route group coverage.`
  );
}

assert.match(
  auditSource,
  /AUDIT_ROUTES[\s\S]*AUDIT_ROUTE_GROUP/,
  'AUDIT_ROUTES should be parsed before AUDIT_ROUTE_GROUP so explicit routes override groups.'
);

assert.match(
  auditSource,
  /AUDIT_STRICT/,
  'audit script should support AUDIT_STRICT.'
);

assert.match(
  auditSource,
  /strictMode[\s\S]*accessibilityFailures/,
  'strict mode should be wired to fail on threshold-matching accessibility findings.'
);

assert.match(
  auditSource,
  /pageLoadFailures[\s\S]*process\.exit\(1\)/,
  'page-load failures should fail the command even outside strict mode.'
);

assert.ok(
  auditSource.includes('axe-results.json'),
  'audit script should keep the JSON artifact filename stable.'
);

assert.match(
  auditSource,
  /finalUrl/,
  'audit results should include the final URL after redirects.'
);

assert.ok(
  auditSource.includes('axe-summary.md'),
  'audit script should keep the Markdown artifact filename stable.'
);

for (const expectedReportSection of [
  'Accessibility findings',
  'Page-load failures',
  'Console and page errors',
  'Next steps',
]) {
  assert.ok(
    auditSource.includes(expectedReportSection),
    `axe-summary.md should include a "${expectedReportSection}" section.`
  );
}

assert.match(
  readmeSource,
  /npm run audit:quality/,
  'README should document the audit:quality command.'
);

assert.match(
  readmeSource,
  /start the dev server first/i,
  'README should tell developers to start the dev server before running the audit.'
);

console.log('test-accessibility-audit-pipeline: PASS');
