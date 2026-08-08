const fs = require('fs');
const path = require('path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const hubPageSource = read(path.join('app', 'hub', 'page.tsx'));

assert(hubPageSource.includes('Campus wayfinding'), 'Hub page should expose a campus wayfinding shortcut.');
assert(hubPageSource.includes('openLockedFeatureNotice'), 'Hub page should support opening a locked-feature notice.');
assert(hubPageSource.includes('Campus wayfinding is temporarily unavailable'), 'Hub page should explain why campus wayfinding is locked.');
assert(hubPageSource.includes('renovation') || hubPageSource.includes('construction'), 'Hub page should mention construction or renovation in the lock notice.');
assert(hubPageSource.includes('Later feature') || hubPageSource.includes('Temporarily locked'), 'Hub page should visually badge the locked shortcut.');

console.log('test-hub-campus-wayfinding-lock: PASS');
