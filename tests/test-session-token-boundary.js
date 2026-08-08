const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const authConfig = read('lib/auth.config.ts');
const auth = read('lib/auth.ts');
const sessionTypes = read('types/next-auth.d.ts');

assert(
  authConfig.includes('return applySessionFields(session, token);'),
  'public session callback should use the token-free session projection.'
);

assert(
  !authConfig.includes('session.accessToken'),
  'public session callback must not expose the OAuth access token.'
);

const publicSessionType = sessionTypes.split("declare module 'next-auth/jwt'")[0];
assert(
  !publicSessionType.includes('accessToken'),
  'browser Session type must not declare an accessToken field.'
);

const jwtType = sessionTypes.split("declare module 'next-auth/jwt'")[1] || '';
assert(
  jwtType.includes('accessToken?: string;') && jwtType.includes('refreshToken?: string;'),
  'server JWT type must retain access and refresh token claims.'
);

assert(
  auth.includes('const { auth: serverAuth } = NextAuth')
    && auth.includes('export async function authWithGoogleToken()')
    && auth.includes('accessToken: token.accessToken'),
  'server-only Auth.js projection should retain the provider token for route handlers.'
);

const classroomRoutes = [
  'app/api/classroom/courses/route.ts',
  'app/api/classroom/courses/[courseId]/coursework/route.ts',
  'app/api/classroom/courses/[courseId]/coursework/[courseWorkId]/route.ts',
  'app/api/classroom/submissions/route.ts',
];

classroomRoutes.forEach((relativePath) => {
  const source = read(relativePath);
  assert(
    source.includes("import { authWithGoogleToken } from '@/lib/auth';")
      && source.includes('await authWithGoogleToken()')
      && source.includes('session.accessToken'),
    `${relativePath} should use the server-only Auth.js projection.`
  );
  assert(
    !source.includes("import { auth } from '@/lib/auth';"),
    `${relativePath} must not use the browser-session projection for Classroom tokens.`
  );
});

function walk(relativeDirectory) {
  const directory = path.join(root, relativeDirectory);
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return walk(relativePath);
    return [relativePath];
  });
}

const clientSurface = [...walk('components'), ...walk('app')]
  .filter((relativePath) => !relativePath.split(path.sep).includes('api'))
  .filter((relativePath) => /\.(tsx?|jsx?)$/.test(relativePath));

clientSurface.forEach((relativePath) => {
  assert(
    !read(relativePath).includes('session.accessToken'),
    `${relativePath} must not read the server-only OAuth token.`
  );
});

console.log('test-session-token-boundary: PASS');
