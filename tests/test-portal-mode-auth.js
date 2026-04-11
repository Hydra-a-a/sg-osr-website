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
assert(portalModeSource.includes("export const OFFICER_ATTEMPT_COOKIE = 'osr_officer_attempt'"), 'Officer-attempt cookie constant is missing.');
assert(portalModeSource.includes('export function deriveEffectivePortalRole(userRole: unknown, portalMode: unknown): PortalRole'), 'Effective role helper is missing.');
assert(portalModeSource.includes('ROLE_HIERARCHY'), 'Role hierarchy definition is missing.');
assert(portalModeSource.includes("if (actualRole === 'student')"), 'Student-role fail-safe guard is missing.');
assert(portalModeSource.includes('if (ROLE_HIERARCHY[requestedRole] < ROLE_HIERARCHY[actualRole])'), 'Portal mode downscope-to-lower-role rule is missing.');
assert(portalModeSource.includes('export function hasLeaderPrivilege(userRole: unknown): boolean'), 'Leader privilege helper is missing.');
assert(portalModeSource.includes('export function hasOfficerPrivilege(userRole: unknown): boolean'), 'Officer privilege helper is missing.');
assert(portalModeSource.includes('export function shouldShowLeaderAccessDeniedNotice(userRole: unknown, attemptedLeaderAccess: unknown): boolean'), 'Leader access denied notice helper is missing.');
assert(portalModeSource.includes('export function shouldShowOfficerAccessNotice(userRole: unknown, effectiveRole: PortalRole, attemptedOfficerAccess: unknown): boolean'), 'Officer access notice helper is missing.');

const loginPageSource = read(path.join('app', 'login', 'page.tsx'));
assert(loginPageSource.includes('writePortalSelectionCookies(portalCookieMode)'), 'Login flow should set portal-mode cookies before local dev sign-in.');
assert(loginPageSource.includes('document.cookie = `${PORTAL_MODE_COOKIE}=${portal}; Path=/; Max-Age=1209600; SameSite=Lax${secure}`;'), 'Portal mode cookie write is missing in login page.');
assert(loginPageSource.includes('document.cookie = `${LEADER_ATTEMPT_COOKIE}=1; Path=/; Max-Age=1200; SameSite=Lax${secure}`;'), 'Leader-attempt cookie write is missing for leader portal attempts.');
assert(loginPageSource.includes('<option value="officer">Officer (Admin)</option>'), 'Login page should expose an officer local simulation option.');

const authSource = read(path.join('lib', 'auth.ts'));
assert(authSource.includes("normalized.includes('officer')"), 'Auth role parsing should recognize officer labels more broadly.');
assert(authSource.includes("normalized.includes('student leader')"), 'Auth role parsing should recognize student leader labels more broadly.');
assert(authSource.includes("'access_level', 'access', 'permission', 'designation', 'position'"), 'Auth sheet header detection should cover broader role column names.');

const navbarSource = read(path.join('components', 'NavbarClient.tsx'));
assert(navbarSource.includes('const effectiveRole = deriveEffectivePortalRole(session?.user?.role, portalMode);'), 'Navbar should derive effective role from portal mode.');
assert(navbarSource.includes("const isLeader = effectiveRole === 'leader' || effectiveRole === 'officer';"), 'Navbar should treat officer mode as leader-capable.');
assert(navbarSource.includes('shouldShowLeaderAccessDeniedNotice(session?.user?.role, leaderAttempt)'), 'Navbar should compute leader-access denied notice from helper.');
assert(navbarSource.includes('shouldShowOfficerAccessNotice(session?.user?.role, effectiveRole, officerAttempt)'), 'Navbar should compute officer-access notice from helper.');
assert(navbarSource.includes('currently in Student Mode. Switch modes to access leadership tools.'), 'Navbar should display leader-mode reminder text for privileged users in student mode.');
assert(navbarSource.includes('const switchPortalMode = (mode: \'student\' | \'leader\' | \'officer\') => {'), 'Navbar should expose a student/leader/officer mode switch helper.');
assert(navbarSource.includes('document.cookie = `${PORTAL_MODE_COOKIE}=${mode}; Path=/; Max-Age=1209600; SameSite=Lax${secure}`;'), 'Navbar should write portal-mode cookie when switching mode in-session.');
assert(navbarSource.includes('window.location.reload();'), 'Navbar should reload after mode switch to keep UI and API mode state consistent.');
assert(navbarSource.includes('const clearPortalCookies = (resetPortalMode: boolean) => {'), 'Navbar should expose a helper to clear portal-attempt cookies.');
assert(navbarSource.includes('document.cookie = `${PORTAL_MODE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;'), 'Navbar should clear portal-mode cookie on sign-out.');
assert(navbarSource.includes('document.cookie = `${OFFICER_ATTEMPT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;'), 'Navbar should clear officer-attempt cookie when dismissing notices or signing out.');

const classroomRoutes = [
  path.join('app', 'api', 'classroom', 'courses', 'route.ts'),
  path.join('app', 'api', 'classroom', 'courses', '[courseId]', 'coursework', 'route.ts'),
  path.join('app', 'api', 'classroom', 'submissions', 'route.ts'),
];

const classroomFormSource = read(path.join('components', 'ClassroomSubmissionForm.tsx'));
assert(classroomFormSource.includes('hasLeaderPrivilege(session?.user?.role) && !isLeader'), 'Classroom form should use hierarchical leader privilege check for student-mode leader messaging.');

for (const routePath of classroomRoutes) {
  const source = read(routePath);
  assert(source.includes('deriveEffectivePortalRole(session.user.role, cookieStore.get(PORTAL_MODE_COOKIE)?.value)'), `Expected effective role derivation in ${routePath}.`);
  assert(source.includes('if (!hasLeaderPrivilege(effectiveRole))'), `Expected effective-role leader privilege guard in ${routePath}.`);
}

console.log('test-portal-mode-auth: PASS');
