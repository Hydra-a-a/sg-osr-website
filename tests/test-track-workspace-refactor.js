const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = process.cwd();
const pagePath = path.join(root, 'app', 'services', 'track', 'page.tsx');
const componentDir = path.join(root, 'components', 'track');

const requiredComponents = [
  'TrackEntryRail.tsx',
  'TrackCaseSummary.tsx',
  'TrackRedactedShell.tsx',
  'TrackProgressPanel.tsx',
  'TrackCaseDetails.tsx',
  'TrackActionWorkspace.tsx',
];

for (const file of requiredComponents) {
  const target = path.join(componentDir, file);
  assert.ok(fs.existsSync(target), `Missing required track workspace component: ${file}`);
}

const pageSource = fs.readFileSync(pagePath, 'utf8');
const componentSource = requiredComponents
  .map((file) => fs.readFileSync(path.join(componentDir, file), 'utf8'))
  .join('\n');
const fullSource = `${pageSource}\n${componentSource}`;

for (const componentName of [
  'TrackEntryRail',
  'TrackCaseSummary',
  'TrackRedactedShell',
  'TrackProgressPanel',
  'TrackCaseDetails',
  'TrackActionWorkspace',
]) {
  assert.match(
    pageSource,
    new RegExp(`<${componentName}[\\s>]`),
    `Expected /services/track to render ${componentName}.`
  );
}

assert.match(fullSource, /My cases/i, 'Expected owner-first history copy.');
assert.match(fullSource, /Latest official update/i, 'Expected a summary update label.');
assert.match(fullSource, /privacy protected/i, 'Expected redacted shell privacy copy.');
assert.match(fullSource, /couldn.*find that ticket/i, 'Expected explicit no-result recovery state.');

console.log('Track workspace refactor guardrails are present.');
