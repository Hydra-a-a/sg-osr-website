const { assert, read } = require('./_security-baseline-helpers');

const schema = read('prisma/schema.prisma');
const migration = read('prisma/migrations/20260805000000_lost_found/migration.sql');
const repository = read('lib/lost-found.ts');
const publicRoute = read('app/api/hub/lost-found/route.ts');
const commentsRoute = read('app/api/hub/lost-found/[itemId]/comments/route.ts');
const mediaRoute = read('app/api/hub/lost-found/media/[attachmentId]/route.ts');
const adminRoute = read('app/api/admin/lost-found/route.ts');
const adminCommentsRoute = read('app/api/admin/lost-found/comments/route.ts');
const adminMediaRoute = read('app/api/admin/lost-found/media/[attachmentId]/route.ts');

assert(schema.includes('enum LostFoundSource') && schema.includes('enum LostFoundStatus'), 'lost-and-found source and lifecycle enums should be modeled in Prisma.');
assert(schema.includes('model LostFoundItem') && schema.includes('model LostFoundAttachment') && schema.includes('model LostFoundComment'), 'lost-and-found records, media, and comments should have separate Prisma models.');
assert(migration.includes('FOREIGN KEY ("itemId")') && migration.includes('ON DELETE CASCADE'), 'lost-and-found child records should cascade with their parent item.');

assert(repository.includes("status: { in: [LostFoundStatus.PUBLISHED, LostFoundStatus.RESOLVED] }"), 'public repository reads should exclude pending, rejected, and archived items.');
assert(repository.includes('LOST_FOUND_VIDEO_UPLOADS_ENABLED = false') && repository.includes('IMAGE_SIGNATURES'), 'lost-and-found uploads should use an explicit image-only beta policy and content signatures.');
assert(repository.includes('file.arrayBuffer()') && repository.includes('ATTACHMENT_SIGNATURE_INVALID'), 'lost-and-found uploads should validate file bytes instead of trusting browser MIME metadata.');
assert(repository.includes('trashLostFoundAttachmentById') && repository.includes('lostFoundItem.delete'), 'lost-and-found creation should compensate partial Drive and database writes.');
const publicProjection = repository.slice(repository.indexOf('function toPublicItem'), repository.indexOf('export async function listPublicLostFoundItems'));
assert(repository.includes('submitterEmail') && !publicProjection.includes('submitterEmail'), 'public item projections should not expose submitter email addresses.');
assert(repository.includes('attachmentId') && repository.includes('getLostFoundAttachment'), 'media access should be attachment-scoped rather than raw Drive URL-scoped.');
assert(publicRoute.includes('requireSameOriginRequest(request)') && publicRoute.includes("LostFoundSource.STUDENT") && publicRoute.includes('validateLostFoundAttachments'), 'student submissions should be same-origin, authenticated, and attachment-validated.');
assert(commentsRoute.includes('requireSameOriginRequest(request)') && commentsRoute.includes('LostFoundCommentSchema'), 'public comment writes should use same-origin and Zod validation.');
const publicComments = repository.slice(repository.indexOf('export async function listPublicLostFoundComments'), repository.indexOf('export async function createLostFoundComment'));
assert(!publicComments.includes('authorEmail'), 'public comment projections should not expose author email addresses.');
assert(mediaRoute.includes('getLostFoundAttachment') && mediaRoute.includes('getDriveMediaStreamById') && mediaRoute.includes('getLostFoundFolderId') && mediaRoute.includes('sizeBytes') && mediaRoute.includes('status: 200'), 'media route should verify the DB attachment, configured Drive folder, and stored size before streaming media.');
assert(adminRoute.includes('requireActiveDatabaseOfficer') && adminRoute.includes('requireSameOriginRequest(request)') && adminRoute.includes('checkRateLimit'), 'lost-and-found moderation should use the database officer gate, same-origin writes, and rate limits.');
assert(adminCommentsRoute.includes('requireActiveDatabaseOfficer') && adminCommentsRoute.includes('requireSameOriginRequest(request)'), 'comment moderation should use the database officer gate and same-origin writes.');
assert(adminMediaRoute.includes('requireActiveDatabaseOfficer') && adminMediaRoute.includes('getLostFoundFolderId') && adminMediaRoute.includes('sizeBytes') && adminMediaRoute.includes('Cache-Control'), 'pending media inspection should use a protected, no-store officer proxy with folder and size checks.');

console.log('test-lost-found-boundaries: PASS');
