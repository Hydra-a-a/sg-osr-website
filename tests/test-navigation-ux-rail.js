const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = process.cwd();

const layoutPath = path.join(root, 'app', 'layout.js');
const componentPath = path.join(root, 'components', 'SectionNavigationRail.tsx');

const layoutSource = fs.readFileSync(layoutPath, 'utf8');

assert.match(
  layoutSource,
  /SectionNavigationRail/,
  'Expected the root layout to wire in the shared section navigation rail.',
);

assert.ok(
  fs.existsSync(componentPath),
  'Expected a shared SectionNavigationRail component for cross-site wayfinding.',
);

assert.ok(
  fs.existsSync(componentPath),
  'Expected a shared SectionNavigationRail component for cross-site wayfinding.',
);

const componentSource = fs.existsSync(componentPath) ? fs.readFileSync(componentPath, 'utf8') : '';

assert.match(
  componentSource,
  /<ol className="flex min-w-max items-center(?: justify-center)? gap-1\.5 text-sm text-body/,
  'Expected breadcrumb links to use body text contrast on the light rail background.',
);

console.log('Navigation rail wiring and breadcrumb rail are present.');
