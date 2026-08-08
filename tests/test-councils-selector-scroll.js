const fs = require('fs');
const path = require('path');
const assert = require('assert');

const source = fs.readFileSync(
  path.join(process.cwd(), 'app', 'student-government', 'councils', 'page.tsx'),
  'utf8',
);

assert.match(
  source,
  /scrollIntoView/,
  'Expected the council selector enhancement to scroll the featured council section back into view.',
);

assert.match(
  source,
  /prefers-reduced-motion/,
  'Expected the selector scroll enhancement to respect reduced-motion preferences.',
);

console.log('Council selector scroll enhancement is present.');
