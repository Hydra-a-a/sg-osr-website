const { assert, assertContainsOneOf, read } = require('./_security-baseline-helpers');

const source = read('app/api/directory/logos/[fileId]/route.ts');
const manager = read('lib/directory-logo-manager.ts');
const adminRoute = read('app/api/admin/directory/route.ts');
const exportRoute = read('app/api/admin/directory/export/route.ts');
const cronRoute = read('app/api/cron/directory-export/route.ts');
assertContainsOneOf(
  source,
  [/fileId/i, /directory/i, /rate|cache|content-type/i],
  'directory logo pipeline route should include file handling safeguards.'
);
assert(source.includes('ALLOWED_LOGO_MIME_TYPES') && source.includes('matchesLogoSignature'), 'logo proxy should enforce raster MIME and signature checks.');
assert(source.includes('expectedFolderId') && source.includes('file.parents'), 'logo proxy should enforce the restricted Drive folder.');
assert(source.includes("uploadedBy !== 'sheets-import'"), 'legacy Sheet-imported logos should remain compatible during fallback mode.');
assert(manager.includes('DIRECTORY_LOGO_MAX_BYTES = 5 * 1024 * 1024'), 'logo manager should enforce the 5 MB limit.');
assert(manager.includes('MIME_SIGNATURES'), 'logo manager should validate file signatures server-side.');
assert(manager.includes('prisma.$transaction'), 'logo mutations should update Neon transactionally.');
assert(manager.includes('trashDriveFileById(uploaded.fileId'), 'failed DB writes should compensate by trashing the new Drive file.');
assert(manager.includes("status: 'pending'"), 'logo mutations should mark Sheets export pending.');
assert(adminRoute.includes('requireActiveDatabaseOfficer'), 'logo API should require an active Neon officer.');
assert(adminRoute.includes('requireSameOriginRequest(request)'), 'logo mutations should enforce same-origin requests.');
assert(adminRoute.includes('formData()') && adminRoute.includes('request.json()'), 'logo API should expose multipart upload and JSON removal handling.');
assert(adminRoute.includes('withNoStore'), 'logo API responses should be no-store.');
assert(exportRoute.includes('exportDirectoryToSheets'), 'officers should have a protected manual export action.');
assert(cronRoute.includes('CRON_SECRET') && cronRoute.includes('timingSafeEqual'), 'cron export should use a timing-safe CRON_SECRET check.');

console.log('test-directory-logo-pipeline: PASS');
