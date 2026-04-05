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

const portalModeSource = read(path.join('lib', 'portal-mode.ts'));
assert(portalModeSource.includes("export const PORTAL_MODE_COOKIE = 'osr_portal_mode'"), 'Portal mode cookie constant is missing.');
assert(portalModeSource.includes("export const LEADER_ATTEMPT_COOKIE = 'osr_leader_attempt'"), 'Leader-attempt cookie constant is missing.');
assert(portalModeSource.includes('export function deriveEffectivePortalRole(userRole: unknown, portalMode: unknown): PortalRole'), 'Effective role helper is missing.');
assert(portalModeSource.includes("if (normalizedPortalMode === 'student')"), 'Portal mode downscope to student is missing.');
assert(portalModeSource.includes('export function shouldShowLeaderAccessDeniedNotice(userRole: unknown, attemptedLeaderAccess: unknown): boolean'), 'Leader access denied notice helper is missing.');

const loginPageSource = read(path.join('app', 'login', 'page.tsx'));
assert(loginPageSource.includes('writePortalSelectionCookies(portal)'), 'Login flow should set portal-mode cookies before Google sign-in.');
assert(loginPageSource.includes('document.cookie = `${PORTAL_MODE_COOKIE}=${portal}; Path=/; Max-Age=1209600; SameSite=Lax${secure}`;'), 'Portal mode cookie write is missing in login page.');
assert(loginPageSource.includes('document.cookie = `${LEADER_ATTEMPT_COOKIE}=1; Path=/; Max-Age=1200; SameSite=Lax${secure}`;'), 'Leader-attempt cookie write is missing for leader portal attempts.');

const navbarSource = read(path.join('components', 'NavbarClient.tsx'));
assert(navbarSource.includes('const isLeader = deriveEffectivePortalRole(session?.user?.role, portalMode) === \'leader\';'), 'Navbar should derive effective role from portal mode.');
assert(navbarSource.includes('shouldShowLeaderAccessDeniedNotice(session?.user?.role, leaderAttempt)'), 'Navbar should compute leader-access denied notice from helper.');
assert(navbarSource.includes('does not have Student Leader Access. You are now in Student Access mode.'), 'Navbar should display post-login denied-access notice text.');
assert(navbarSource.includes('const switchPortalMode = (mode: \'student\' | \'leader\') => {'), 'Navbar should expose a portal-mode switch helper.');
assert(navbarSource.includes('document.cookie = `${PORTAL_MODE_COOKIE}=${mode}; Path=/; Max-Age=1209600; SameSite=Lax${secure}`;'), 'Navbar should write portal-mode cookie when switching mode in-session.');
assert(navbarSource.includes('window.location.reload();'), 'Navbar should reload after mode switch to keep UI and API mode state consistent.');
assert(navbarSource.includes('const handleSignOut = () => {'), 'Navbar should expose a sign-out helper to clear portal cookies.');
assert(navbarSource.includes('document.cookie = `${PORTAL_MODE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;'), 'Navbar should clear portal-mode cookie on sign-out.');

const classroomRoutes = [
  path.join('app', 'api', 'classroom', 'courses', 'route.ts'),
  path.join('app', 'api', 'classroom', 'courses', '[courseId]', 'coursework', 'route.ts'),
  path.join('app', 'api', 'classroom', 'submissions', 'route.ts'),
];

const classroomFormSource = read(path.join('components', 'ClassroomSubmissionForm.tsx'));
assert(classroomFormSource.includes('normalizePortalRole(session?.user?.role) === \'leader\' && !isLeader'), 'Classroom form should use normalized raw role for student-mode leader messaging.');

for (const routePath of classroomRoutes) {
  const source = read(routePath);
  assert(source.includes('deriveEffectivePortalRole(session.user.role, cookieStore.get(PORTAL_MODE_COOKIE)?.value)'), `Expected effective role derivation in ${routePath}.`);
  assert(source.includes("if (effectiveRole !== 'leader')"), `Expected effective-role leader guard in ${routePath}.`);
}

console.log('test-portal-mode-auth: PASS');
