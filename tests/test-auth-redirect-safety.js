const { assert, read } = require('./_security-baseline-helpers');

const authConfig = read('lib/auth.config.ts');
const loginPage = read('app/login/page.tsx');
const proxy = read('proxy.ts');

assert(
  authConfig.includes('async redirect({ url, baseUrl })'),
  'NextAuth should define an explicit redirect callback.'
);

assert(
  authConfig.includes("if (url.startsWith('/'))") && authConfig.includes('return `${baseUrl}${url}`'),
  'NextAuth redirect callback should allow relative paths by resolving them against baseUrl.'
);

assert(
  authConfig.includes('const callbackUrl = new URL(url)') && authConfig.includes('callbackUrl.origin === baseUrl'),
  'NextAuth redirect callback should only allow absolute URLs that match the auth base origin.'
);

assert(
  authConfig.includes('return baseUrl;'),
  'NextAuth redirect callback should fall back to baseUrl for unsafe redirect targets.'
);

assert(
  loginPage.includes("requestedCallbackUrl?.startsWith('/')") && loginPage.includes("!requestedCallbackUrl.startsWith('//')"),
  'login page should reject protocol-relative callbackUrl values before calling signIn.'
);

assert(
  loginPage.includes("const callbackUrl =") && loginPage.includes(": '/';"),
  'login page should fall back to / when callbackUrl is not a safe relative path.'
);

assert(
  proxy.includes("loginUrl.searchParams.set('callbackUrl', pathname)"),
  'proxy should create login callbackUrl values from the internal pathname, not a user-controlled absolute URL.'
);

assert(
  proxy.includes('buildInternalRedirectUrl') && proxy.includes('isLocalRequestHost'),
  'proxy should continue using the local-aware internal redirect helper.'
);

console.log('test-auth-redirect-safety: PASS');
