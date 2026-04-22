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

const directoryPageSource = read(path.join('app', 'directory', 'page.tsx'));

assert(
  directoryPageSource.includes("import BackLink from '@/components/BackLink';"),
  'Directory page should import the shared BackLink component.'
);
assert(
  directoryPageSource.includes('portal-section-slate'),
  'Directory page should use a slate portal hero section.'
);
assert(
  directoryPageSource.includes('portal-section-dark'),
  'Directory page should use a dark portal results section.'
);
assert(
  directoryPageSource.includes('portal-noise-overlay'),
  'Directory page should render the shared portal noise overlay.'
);
assert(
  directoryPageSource.includes('portal-eyebrow'),
  'Directory page should use the portal eyebrow treatment.'
);
assert(
  directoryPageSource.includes('portal-title'),
  'Directory page should use the portal title treatment.'
);
assert(
  directoryPageSource.includes('portal-lead'),
  'Directory page should use the portal lead treatment.'
);
assert(
  directoryPageSource.includes('portal-panel'),
  'Directory page should render portal panels for its control or result surfaces.'
);
assert(
  directoryPageSource.includes('sg-hover-card'),
  'Directory page should reuse the shared hover-card treatment for directory results.'
);
assert(
  directoryPageSource.includes('directory-hero-shell'),
  'Directory page should use a balanced hero shell layout.'
);
assert(
  directoryPageSource.includes('directory-hero-meta-card'),
  'Directory page should use a compact hero meta card to balance the layout.'
);
assert(
  directoryPageSource.includes('directory-controls-panel'),
  'Directory page should use a dedicated controls panel class for tighter composition.'
);
assert(
  directoryPageSource.includes("grid grid-cols-1 gap-8 md:grid-cols-2 2xl:grid-cols-3"),
  'Directory page should keep grid results at two columns until very wide screens.'
);
assert(
  directoryPageSource.includes('directory-result-card'),
  'Directory page should use a dedicated result card class for roomier grid spacing.'
);

console.log('test-directory-portal-theme: PASS');
