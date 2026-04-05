const fs = require('fs');
const path = require('path');

const routePath = path.join(__dirname, '..', 'app', 'api', 'forms', 'route.ts');
const source = fs.readFileSync(routePath, 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(source.includes('if (!session?.user?.email)'), 'Missing session auth guard in forms route.');
assert(/ApiError\(401,\s*'UNAUTHORIZED'/.test(source), 'Missing 401 unauthorized response for unauthenticated users.');
assert(source.includes("sessionEmail.endsWith('@rtu.edu.ph')"), 'Missing @rtu.edu.ph email-domain enforcement.');
assert(source.includes('function withNoStore(response: NextResponse): NextResponse'), 'Missing no-store response wrapper.');
assert(source.includes("response.headers.set('Cache-Control', 'no-store')"), 'Missing Cache-Control no-store header on forms responses.');

console.log('test-forms-auth-guard: PASS');
