const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const schema = read('prisma/schema.prisma');
assert.match(schema, /model AdminContentDraft\s*\{/);
assert.match(schema, /model AdminContentRevision\s*\{/);
for (const model of ['NewsPost', 'DirectoryEntry', 'QuickLink', 'HubGuide']) {
    const block = schema.slice(schema.indexOf(`model ${model}`), schema.indexOf('\nmodel ', schema.indexOf(`model ${model}`) + 6));
    assert.match(block, /version\s+Int/);
}

const content = read('lib/admin-content.ts');
for (const type of ['directory', 'news', 'hub-guide', 'quick-link']) assert.match(content, new RegExp(`['"]?${type}['"]?`));
assert.match(content, /CONTENT_VERSION_CONFLICT/);
assert.match(content, /AdminContentRevision/);
assert.match(content, /createAdminContentDraft/);
assert.match(content, /stageHubGuideFileDraft/);
assert.match(content, /HUB_GUIDE_PDF_MAX_BYTES/);
assert.match(content, /baseVersion === 0/);
assert.match(content, /version: 1/);

const api = read('app/api/admin/content/[contentType]/[id]/publish/route.ts');
assert.match(api, /requireActiveDatabaseOfficer/);
assert.match(api, /requireSameOriginRequest/);
assert.match(api, /Cache-Control/);
const collectionApi = read('app/api/admin/content/[contentType]/route.ts');
assert.match(collectionApi, /createAdminContentDraft/);
assert.match(collectionApi, /requireSameOriginRequest/);
assert.match(collectionApi, /publicSource/);
const hubGuideUploadApi = read('app/api/admin/content/hub-guide/file-draft/route.ts');
assert.match(hubGuideUploadApi, /requireActiveDatabaseOfficer/);
assert.match(hubGuideUploadApi, /requireSameOriginRequest/);
assert.match(hubGuideUploadApi, /formData\(\)/);
assert.match(hubGuideUploadApi, /Cache-Control/);
assert.match(hubGuideUploadApi, /stageHubGuideFileDraft/);
assert.match(read('app/api/admin/content/directory/[id]/logo-draft/route.ts'), /stageDirectoryLogo/);
assert.match(read('app/api/admin/news/sync/route.ts'), /requireActiveDatabaseOfficer/);
assert.match(read('lib/admin-surface-registry.ts'), /publicHrefs/);

const ui = read('components/admin/AdminContentWorkspace.tsx');
assert.match(ui, /AdminDrawer/);
assert.match(ui, /AdminModal/);
assert.match(ui, /AdminActionMenu/);
assert.match(ui, /action=publish/);
assert.match(ui, /router\.push/);
assert.match(ui, /router\.back/);
assert.match(ui, /if \(isCreating\) \{\s*router\.replace/);
assert.match(ui, /Browse PDF/);
assert.match(ui, /onDrop=\{dropHubGuideFile\}/);
assert.match(ui, /Uploading PDF/);
assert.match(ui, /useSearchParams/);
assert.doesNotMatch(ui, /studentEmail|trackingToken|submitterEmail/);

for (const route of ['app/api/news/route.ts', 'app/api/config/links/route.ts', 'app/api/hub/guides/route.ts']) {
    assert.match(read(route), /resolvePublicContentSource/);
}

console.log('Admin content contract checks passed.');
