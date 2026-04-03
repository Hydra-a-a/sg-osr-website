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

assert(proxySource.includes("script-src 'self' 'unsafe-inline'; script-src-elem 'self';"), 'Compatibility-safe script CSP is missing in proxy.');
assert(!proxySource.includes("'strict-dynamic'"), 'strict-dynamic should remain disabled because it breaks Next.js parser-inserted chunks in production.');
assert(proxySource.includes("style-src 'self' 'unsafe-inline';"), 'Compatibility-safe style CSP is missing in proxy.');
assert(proxySource.includes("style-src-attr 'unsafe-inline'"), 'CSP should allow inline style attributes used by React inline style props.');
assert(proxySource.includes("response.headers.set('Content-Security-Policy', cspHeader)"), 'Proxy does not set CSP header on responses.');
assert(proxySource.includes("response.headers.set('Content-Security-Policy-Report-Only'"), 'Proxy does not set CSP report-only header on responses.');
assert(proxySource.includes("script-src 'self' 'nonce-${nonce}'"), 'Strict nonce-based script policy is missing from CSP report-only header.');
assert(proxySource.includes("response.headers.set('Strict-Transport-Security'"), 'Strict-Transport-Security header should be set in production.');
assert(proxySource.includes("'Permissions-Policy'"), 'Permissions-Policy hardening header should be set.');

console.log('test-csp-policy: PASS');
