const fs = require('fs');
const path = require('path');

const nextConfigPath = path.join(__dirname, '..', 'next.config.mjs');
const proxyPath = path.join(__dirname, '..', 'proxy.ts');

const nextConfig = fs.readFileSync(nextConfigPath, 'utf8');
const proxySource = fs.readFileSync(proxyPath, 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(!nextConfig.includes("'unsafe-inline'"), 'Unsafe inline CSP directive still present in next.config.mjs.');
assert(!nextConfig.includes('Content-Security-Policy'), 'Static CSP header should not be set in next.config.mjs after nonce migration.');

assert(proxySource.includes("script-src 'self' 'nonce-${nonce}' 'unsafe-inline'"), 'Nonce-first script CSP with legacy inline fallback is missing in proxy.');
assert(!proxySource.includes("script-src 'self' 'unsafe-inline';"), 'Production CSP should not rely on unsafe-inline alone.');
assert(!proxySource.includes("'strict-dynamic'"), 'strict-dynamic should remain disabled because it breaks Next.js parser-inserted chunks in production.');
assert(proxySource.includes("style-src 'self' 'nonce-${nonce}'"), 'Nonce-based style CSP is missing in proxy.');
assert(proxySource.includes("style-src-attr 'unsafe-inline'"), 'CSP should allow inline style attributes used by React inline style props.');
assert(proxySource.includes("response.headers.set('Content-Security-Policy', cspHeader)"), 'Proxy does not set CSP header on responses.');
assert(proxySource.includes("response.headers.set('Strict-Transport-Security'"), 'Strict-Transport-Security header should be set in production.');
assert(proxySource.includes("'Permissions-Policy'"), 'Permissions-Policy hardening header should be set.');

console.log('test-csp-policy: PASS');
