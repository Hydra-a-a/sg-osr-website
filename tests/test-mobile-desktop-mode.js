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

const layoutSource = read(path.join('app', 'layout.js'));
assert(
  layoutSource.includes('export const viewport'),
  'Root layout should define explicit viewport metadata for mobile browsers.'
);
assert(
  layoutSource.includes('ViewportModeGuard'),
  'Root layout should render a viewport mode guard component.'
);

const guardSource = read(path.join('components', 'ViewportModeGuard.tsx'));
assert(
  guardSource.includes('mobileDesktopMode'),
  'Viewport mode guard should detect mobile desktop-mode sessions.'
);
assert(
  guardSource.includes('viewport-mode-change'),
  'Viewport mode guard should dispatch viewport mode updates.'
);

const navbarSource = read(path.join('components', 'NavbarClient.tsx'));
assert(
  navbarSource.includes('forceMobileLayout'),
  'Navbar should support forcing the mobile navigation layout.'
);
assert(
  navbarSource.includes("document.documentElement.dataset.mobileDesktopMode === 'true'"),
  'Navbar should read the mobile desktop-mode document flag.'
);

const globalsSource = read(path.join('app', 'globals.css'));
assert(
  globalsSource.includes("html[data-mobile-desktop-mode='true']"),
  'Global styles should include overrides for mobile browsers in desktop mode.'
);
assert(
  globalsSource.includes("[class*=\"lg:grid-cols-\"]"),
  'Global overrides should collapse grid-heavy desktop layouts for mobile desktop mode.'
);

console.log('test-mobile-desktop-mode: PASS');
