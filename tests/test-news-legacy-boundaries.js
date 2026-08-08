const fs = require('fs');
const path = require('path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const newsRoute = read(path.join('app', 'api', 'news', 'route.ts'));

assert(
  newsRoute.includes(".filter((row) => [0, 1, 2, 4].every((index) => String(row[index] || '').trim()))"),
  'Legacy news fallback should ignore rows without an ID, source, caption, or published timestamp.',
);
assert(
  newsRoute.includes("source: String(row[1] || '')"),
  'Legacy news fallback should not synthesize a source for incomplete rows.',
);
assert(
  newsRoute.includes("publishedAt: String(row[4] || '')"),
  'Legacy news fallback should not synthesize a current timestamp for incomplete rows.',
);

console.log('test-news-legacy-boundaries: PASS');
