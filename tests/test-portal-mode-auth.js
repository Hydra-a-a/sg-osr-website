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
const authConfigSource = read(path.join('lib', 'auth.config.ts'));
const portalModeSource = read(path.join('lib', 'portal-mode.ts'));

assert(loginPageSource.includes('writePortalSelectionCookies'), 'Login page should persist the selected portal intent before sign-in.');
assert(loginPageSource.includes('PORTAL_MODE_COOKIE'), 'Login page should continue writing the portal mode cookie.');
assert(loginPageSource.includes('LEADER_ATTEMPT_COOKIE'), 'Login page should continue writing the leader attempt cookie.');
assert(loginPageSource.includes("const callbackUrl = requestedCallbackUrl?.startsWith('/') && !requestedCallbackUrl.startsWith('//')"), 'Login page should sanitize callback URLs.');

assert(authConfigSource.includes("signIn: '/login'"), 'NextAuth should keep /login as the sign-in page.');
assert(authConfigSource.includes("error: '/login'"), 'NextAuth should keep /login as the error page.');
assert(authConfigSource.includes('if (url.startsWith(\'/\'))'), 'NextAuth redirect callback should allow same-origin relative URLs.');
assert(authConfigSource.includes('if (callbackUrl.origin === baseUrl)'), 'NextAuth redirect callback should reject foreign origins.');
assert(authConfigSource.includes("return baseUrl;"), 'NextAuth redirect callback should fall back to the base URL.');
assert(authConfigSource.includes("process.env.NODE_ENV !== 'production'"), 'Auth config should keep production-specific safety checks.');
assert(authConfigSource.includes("process.env.ENABLE_LOCAL_LOGIN_SIMULATION === 'true'"), 'Auth config should gate local login simulation behind env flags.');

assert(portalModeSource.includes("export type PortalRole = 'student' | 'leader' | 'officer';"), 'Portal mode should preserve the existing role hierarchy.');
assert(portalModeSource.includes('Only allow downgrading, never escalation'), 'Portal mode should keep downgrade-only semantics.');

console.log('test-portal-mode-auth: PASS');
