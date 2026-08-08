const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const proxySource = fs.readFileSync(path.join(root, 'proxy.ts'), 'utf8');

assert.match(
  proxySource,
  /function isLocalRequestHost/,
  'proxy.ts should detect localhost-style request hosts before building auth redirects.'
);

assert.match(
  proxySource,
  /function buildInternalRedirectUrl/,
  'proxy.ts should centralize internal redirect URL construction.'
);

assert.match(
  proxySource,
  /host === 'localhost'[\s\S]*host === '127\.0\.0\.1'/,
  'local redirect detection should include localhost and 127.0.0.1.'
);

assert.match(
  proxySource,
  /new URL\(path,\s*requestOrigin\)/,
  'local internal redirects should use the current request origin instead of the NextAuth env origin.'
);

assert.match(
  proxySource,
  /buildInternalRedirectUrl\('\/login', req\)/,
  'unauthenticated users should be redirected to a login URL built from the local-aware helper.'
);

assert.doesNotMatch(
  proxySource,
  /new URL\('\/login', nextUrl\)/,
  'proxy.ts should not build login redirects from nextUrl because NextAuth may rewrite it to NEXTAUTH_URL.'
);

console.log('test-proxy-local-auth-redirect: PASS');
