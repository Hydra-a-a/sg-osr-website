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

const apiSource = read(path.join('app', 'api', 'hub', 'guides', 'route.ts'));
assert(apiSource.includes("const RANGE = 'Transparency Hub!A2:F'"), 'Hub guides API should read from Transparency Hub sheet range.');
assert(apiSource.includes('getSheetDataWithHyperlinks'), 'Hub guides API should read hyperlink-aware sheet data.');
assert(apiSource.includes('extractGoogleDriveFileId'), 'Hub guides API should parse Google Drive file IDs.');
assert(apiSource.includes("metadata.mimeType !== 'application/pdf'"), 'Hub guides API should strictly reject non-PDF Drive files.');
assert(apiSource.includes("!parsed.pathname.toLowerCase().endsWith('.pdf')"), 'Hub guides API should strictly reject non-PDF direct links.');
assert(apiSource.includes('/api/hub/guides/preview/'), 'Hub guides API should route Drive embeds through internal preview proxy endpoint.');
assert(apiSource.includes('TransparencyGuideSchema.safeParse'), 'Hub guides API should validate output records with schema.');

const previewRouteSource = read(path.join('app', 'api', 'hub', 'guides', 'preview', '[fileId]', 'route.ts'));
assert(previewRouteSource.includes('getDrivePdfStreamById'), 'Preview proxy route should stream PDFs from Drive through backend.');
assert(previewRouteSource.includes("'Content-Type': 'application/pdf'"), 'Preview proxy route should respond with application/pdf content type.');

const hubPageSource = read(path.join('app', 'hub', 'page.tsx'));
assert(hubPageSource.includes("useSWR('/api/hub/guides'"), 'Student Hub page should load guides from the hub guides API.');
assert(hubPageSource.includes('Student Handbooks &amp; Guides'), 'Student Hub page should render Student Handbooks & Guides section.');
assert(hubPageSource.includes('PDF-only enforcement is active. Non-PDF links are ignored automatically.'), 'Student Hub page should communicate PDF-only enforcement.');
assert(hubPageSource.includes('src={selectedGuideEmbedUrl}'), 'Student Hub page should render selected guide PDF preview.');

console.log('test-hub-guides-pdf-gating: PASS');
