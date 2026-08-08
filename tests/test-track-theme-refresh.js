const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = process.cwd();
const files = [
  path.join(root, 'app', 'services', 'track', 'page.tsx'),
  path.join(root, 'components', 'track', 'TrackEntryRail.tsx'),
  path.join(root, 'components', 'track', 'TrackCaseSummary.tsx'),
  path.join(root, 'components', 'track', 'TrackProgressPanel.tsx'),
  path.join(root, 'components', 'track', 'TrackCaseDetails.tsx'),
  path.join(root, 'components', 'track', 'TrackRedactedShell.tsx'),
  path.join(root, 'components', 'track', 'TrackActionWorkspace.tsx'),
  path.join(root, 'components', 'track', 'TrackStatusBadge.tsx'),
];

const source = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');

assert.match(source, /bg-surface-elevated/, 'Expected track theme refresh to use elevated surface tokens.');
assert.match(source, /bg-surface-base|from-\[var\(--surface-base\)\]/, 'Expected track page to use the shared light surface base.');
assert.match(source, /text-strong/, 'Expected stronger typography tokens in the refreshed track UI.');
assert.match(source, /border-soft/, 'Expected softened shared border tokens in the refreshed track UI.');

console.log('Track theme refresh uses shared surface and typography tokens.');
