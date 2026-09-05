const { assert, assertContainsOneOf, read } = require('./_security-baseline-helpers');

const source = read('app/api/hub/guides/preview/[fileId]/route.ts');
const content = read('lib/admin-content.ts');
const drive = read('lib/google-drive.ts');
const publicSource = read('lib/public-content-source.ts');
assertContainsOneOf(
  source,
  [/preview/i, /fileId/i, /cache|auth|access/i],
  'hub guide preview route should include gated preview handling.'
);
assert(source.includes('getHubGuidesFolderId') && drive.includes('expectedParentId'), 'hub guide preview should restrict Drive files to the configured Hub Guides folder before media is streamed.');
assert(source.includes("download') === '1'") && source.includes('Content-Disposition'), 'hub guide preview should support a safe download response.');
assert(content.includes('HUB_GUIDE_PDF_MAX_BYTES') && content.includes("toString('ascii') !== '%PDF-'"), 'Hub Guide uploads should validate PDF size and signature.');
assert(content.includes('trashManagedHubGuidePdf(uploaded.fileId)') && content.includes('previousHubGuideFileId'), 'Hub Guide staging should compensate failed writes and retire replaced managed files.');
assert(drive.includes('uploadHubGuidePdfToDrive') && drive.includes('GOOGLE_DRIVE_HUB_GUIDES_FOLDER_ID'), 'Hub Guide uploads should use the dedicated Drive folder setting.');
assert(publicSource.includes('download=1') || publicSource.includes("downloadParams.set('download', '1')"), 'managed Hub Guides should use the same-origin preview and download routes.');

console.log('test-hub-guides-pdf-gating: PASS');
