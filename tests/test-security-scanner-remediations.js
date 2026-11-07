const fs = require('fs');
const path = require('path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const security = read('lib/security.ts');
const newsSchema = read('schemas/news.ts');
const unfurl = read('lib/unfurl.ts');

assert(security.includes('export function isOfficialFacebookUrl'), 'Facebook URLs must use a hostname-aware validator.');
assert(!newsSchema.includes("url.includes('facebook.com')"), 'News URLs must not use substring hostname validation.');
assert(!security.includes('.replace(/<[^>]+>/g'), 'Plain-text normalization must not rely on the vulnerable tag-stripping regex.');
assert(unfurl.includes("redirect: 'manual'"), 'News unfurling must validate every redirect.');
assert(unfurl.includes('isOfficialFacebookUrl(redirectedUrl)'), 'News unfurling must reject cross-domain redirects.');
assert(unfurl.includes('timeout: 3_000'), 'News unfurling must use the provider timeout budget.');

for (const file of ['lib/tickets.ts', 'lib/proposal-notifications.ts', 'lib/proposals.ts', 'lib/grievance-notifications.ts']) {
  const source = read(file);
  assert(source.includes('randomInt('), `${file} must use unbiased cryptographic selection.`);
  assert(!source.includes('% TICKET_ID_ALPHABET.length') && !source.includes('% ID_ALPHABET.length') && !source.includes('% RANDOM_ALPHABET.length'), `${file} must not introduce modulo bias.`);
}

console.log('test-security-scanner-remediations: PASS');
