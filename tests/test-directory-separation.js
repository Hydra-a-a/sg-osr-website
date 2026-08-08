const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = process.cwd();

const pagePath = path.join(root, 'app', 'directory', 'page.tsx');
const officesRoutePath = path.join(root, 'app', 'api', 'directory', 'offices', 'route.ts');
const studentOrgsRoutePath = path.join(root, 'app', 'api', 'directory', 'student-organizations', 'route.ts');

const pageSource = fs.readFileSync(pagePath, 'utf8');
const officesRouteSource = fs.readFileSync(officesRoutePath, 'utf8');
const studentOrgsRouteSource = fs.readFileSync(studentOrgsRoutePath, 'utf8');

assert.match(
  pageSource,
  /Student Organizations[\s\S]*University Offices/,
  'Expected directory UI to expose explicit top-level Student Organizations and University Offices tabs.'
);

assert.match(
  pageSource,
  /\/directory\/student-organizations/,
  'Directory hub should reference student-organizations route.'
);

const orgSource = fs.readFileSync(path.join(root, 'app', 'directory', 'student-organizations', 'page.tsx'), 'utf8');
const officesSource = fs.readFileSync(path.join(root, 'app', 'directory', 'university-offices', 'page.tsx'), 'utf8');

assert.match(
  orgSource,
  /useSWR\('\/api\/directory\/student-organizations'/,
  'Organizations page should fetch /api/directory/student-organizations'
);

assert.match(
  officesSource,
  /useSWR\('\/api\/directory\/offices'/,
  'Offices page should fetch /api/directory/offices'
);

assert.match(
  orgSource,
  /directory-accordion-item/,
  'Expected organization page to render grouped accordion sections.'
);

assert.match(
  officesSource,
  /directory-accordion-item/,
  'Expected offices page to render grouped accordion sections.'
);

assert.match(
  orgSource,
  /directory-entry-card/,
  'Expected organization page to render compact entry cards inside accordions.'
);

assert.match(
  officesSource,
  /directory-entry-card/,
  'Expected offices page to render compact entry cards inside accordions.'
);

assert.match(
  officesRouteSource,
  /NextResponse\.json\(\{ offices: payload\.offices, meta: payload\.meta \}\)/,
  'Expected offices endpoint to return offices payload only.'
);

assert.match(
  studentOrgsRouteSource,
  /NextResponse\.json\(\{ leaders: payload\.leaders, meta: payload\.meta \}\)/,
  'Expected student-organizations endpoint to return leaders payload only.'
);

assert.doesNotMatch(
  studentOrgsRouteSource,
  /payload\.offices/,
  'Student organizations endpoint should not expose office data.'
);

console.log('test-directory-separation: PASS');
