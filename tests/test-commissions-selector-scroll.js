const fs = require('fs');
const path = require('path');
const assert = require('assert');

const source = fs.readFileSync(
  path.join(process.cwd(), 'app', 'student-government', 'commissions', 'page.tsx'),
  'utf8',
);

assert.match(
  source,
  /scrollIntoView/,
  'Expected the commission selector enhancement to scroll the featured commission section back into view.',
);

assert.match(
  source,
  /prefers-reduced-motion/,
  'Expected the commission selector scroll enhancement to respect reduced-motion preferences.',
);

console.log('Commission selector scroll enhancement is present.');
