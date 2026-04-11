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

const directoryApiSource = read(path.join('app', 'api', 'directory', 'route.ts'));
assert(directoryApiSource.includes('function cleanOrganizationLogoUrl'), 'Directory API should normalize organization logo URLs.');
assert(directoryApiSource.includes('extractGoogleDriveFileId'), 'Directory API should parse Google Drive logo links.');
assert(directoryApiSource.includes('/api/directory/logos/'), 'Directory API should route Drive logos through an internal proxy URL.');
assert(directoryApiSource.includes('logoIndex'), 'Directory API workbook parser should support a logo column index.');
assert(directoryApiSource.includes("{ index: 8, key: 'logoUrl', transform: cleanOrganizationLogoUrl }"), 'Directory API legacy parser should map logoUrl when available.');
assert(directoryApiSource.includes('fetchAllAvailableRangesWithLinksSafe(WORKBOOK_OFFICES_RANGE_CANDIDATES)'), 'Directory API should fetch office workbook rows with hyperlink-aware parsing.');
assert(directoryApiSource.includes("{ index: 6, key: 'logoUrl', transform: cleanOrganizationLogoUrl }"), 'Directory API legacy offices parser should map logoUrl when available.');

const logoProxyRouteSource = read(path.join('app', 'api', 'directory', 'logos', '[fileId]', 'route.ts'));
assert(logoProxyRouteSource.includes('getDriveImageStreamById'), 'Directory logo proxy should stream images from Google Drive.');
assert(logoProxyRouteSource.includes('getOrganizationLogosFolderId'), 'Directory logo proxy should enforce the configured shared logos folder.');
assert(logoProxyRouteSource.includes("'Content-Type': contentType"), 'Directory logo proxy should return image content type.');
assert(logoProxyRouteSource.includes("'ETag': etag"), 'Directory logo proxy should expose ETag caching headers.');

const schemaSource = read(path.join('schemas', 'directory.ts'));
assert(schemaSource.includes('logoUrl: z.string()'), 'Directory officer schema should include optional logoUrl.');
assert(schemaSource.includes(".refine((value) => isSafeLogoUrl(value)"), 'Directory officer schema should validate logoUrl values.');
assert(schemaSource.includes("'Logo URL is too long'"), 'Directory schema should validate logo URL length constraints.');

const heroSource = read(path.join('components', 'Hero.tsx'));
assert(heroSource.includes("useSWR('/api/directory'"), 'Hero should load directory data for dynamic logo overrides.');
assert(heroSource.includes('applyCouncilLogoOverrides'), 'Hero should apply dynamic council logo overrides.');

const aboutSource = read(path.join('app', 'about', 'page.tsx'));
assert(aboutSource.includes("useSWR('/api/directory'"), 'About page should load directory data for dynamic logo overrides.');
assert(aboutSource.includes('resolvedCouncils'), 'About page should use resolved council logos.');

const directoryPageSource = read(path.join('app', 'directory', 'page.tsx'));
assert(directoryPageSource.includes('logoUrl?: string;'), 'Directory page officer type should include logoUrl.');
assert(directoryPageSource.includes('src={getSafeExternalHref(officer.logoUrl) as string}'), 'Directory page should render organization logos when available.');
assert(directoryPageSource.includes('src={getSafeExternalHref(office.logoUrl) as string}'), 'Directory page should render office logos when available.');

console.log('test-directory-logo-pipeline: PASS');
