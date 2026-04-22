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

const loginPageSource = read(path.join('app', 'login', 'page.tsx'));

assert(loginPageSource.includes('portal-section-dark'), 'Login page should render inside the portal dark section shell.');
assert(loginPageSource.includes('portal-noise-overlay'), 'Login page should include the shared portal noise overlay.');
assert(loginPageSource.includes('portal-panel'), 'Login page should use a portal panel instead of the legacy white card.');
assert(loginPageSource.includes('portal-title'), 'Login page should use portal title typography.');
assert(loginPageSource.includes('portal-lead'), 'Login page should use portal lead copy styling.');
assert(loginPageSource.includes('Google verifies your identity, and access is granted in accordance with your authorized RTU role and permissions.'), 'Login page should clarify that access level is determined after authentication.');
assert(loginPageSource.includes('For councils, committees, and other recognized student leadership accounts with authorized access.'), 'Leader gateway copy should describe intended access without promising elevation.');
assert(loginPageSource.includes("requestedCallbackUrl?.startsWith('/') && !requestedCallbackUrl.startsWith('//')"), 'Login page should continue sanitizing callbackUrl to relative same-origin paths.');
assert(loginPageSource.includes("await signIn('google', { callbackUrl })"), 'Login page should preserve Google sign-in callback usage.');
assert(loginPageSource.includes("await signIn('dev-sim',"), 'Login page should preserve localhost dev simulation sign-in.');

console.log('test-login-portal-theme: PASS');
