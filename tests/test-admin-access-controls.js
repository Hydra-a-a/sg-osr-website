const { assert, read } = require('./_security-baseline-helpers');

const route = read('app/api/admin/access/route.ts');
const repository = read('lib/admin-access.ts');
const auth = read('lib/auth.ts');

assert(route.includes("import { requireSameOriginRequest } from '@/lib/request-guards'"), 'access mutations should use the shared same-origin guard.');
assert(route.includes('requireSameOriginRequest(request)'), 'access mutations should enforce same-origin before writing.');
assert(route.includes('checkRateLimit'), 'access management should be rate limited.');
assert(route.includes("z.enum(['student', 'leader', 'officer'])"), 'access updates should validate the supported portal roles.');
assert(route.includes("value.endsWith('@rtu.edu.ph')"), 'access updates should require RTU institutional email addresses.');
assert(route.includes('requireActiveDatabaseOfficer'), 'access management should use the shared active-officer guard.');
assert(repository.includes('isActiveOfficer(actor)'), 'the shared access guard should check the current officer record in Neon.');
assert(route.includes('SELF_ACCESS_LOCKOUT'), 'access management should prevent self-lockout.');
assert(route.includes('invalidateAuthorizedUsersCache()'), 'access mutations should invalidate the local authorized-user cache.');
assert(route.includes('AUTH_ACCESS_UPDATED') && route.includes('AUTH_ACCESS_REVOKED'), 'access mutations should emit redacted audit events.');
assert(!route.includes("from '@/lib/sheets'"), 'access management should not write to Google Sheets.');

assert(repository.includes("import 'server-only'"), 'access repository must be server-only.');
assert(repository.includes("await import('@/lib/prisma')"), 'access repository should lazy-load Prisma.');
assert(repository.includes('prisma.$transaction'), 'access updates should be transactional.');
assert(repository.includes('sessionVersion: { increment: 1 }'), 'access updates should invalidate stale DB-backed sessions.');
assert(repository.includes('revokedAfter: input.accessEnabled ? null : now'), 'revocations should record a revocation timestamp.');
assert(repository.includes('authorizedUser.findMany'), 'access management should list authorized users from Neon.');
assert(repository.includes('isDevSim') && repository.includes("process.env.NODE_ENV !== 'production'"), 'local officer simulation should be explicitly development-only.');
assert(repository.includes('local-dev-simulation'), 'local officer simulation should use a synthetic actor instead of a production DB bypass.');

assert(auth.includes('export function invalidateAuthorizedUsersCache'), 'auth should expose a scoped cache invalidation hook for access mutations.');

console.log('test-admin-access-controls: PASS');
