const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'components', 'SlideParser.tsx'), 'utf8');

const rowMatch = source.match(/<div\s+ref=\{rowRef\}[\s\S]*?>/);

assert.ok(rowMatch, 'SlideParser should render a row container with rowRef.');

const rowOpeningTag = rowMatch[0];

assert.match(
  rowOpeningTag,
  /className=\{horizontal \? ['"]slide-parser-row['"] : ['"]space-y-8['"]\}/,
  'The row container should keep horizontal and vertical layout classes conditional.'
);

assert.match(
  rowOpeningTag,
  /tabIndex=\{horizontal \? 0 : undefined\}/,
  'The horizontal scroll row should be keyboard-focusable without changing vertical layout tab order.'
);

assert.match(
  rowOpeningTag,
  /role=\{horizontal \? ['"]region['"] : undefined\}/,
  'The focusable horizontal scroll row should expose a named region role.'
);

assert.match(
  rowOpeningTag,
  /aria-label=\{horizontal \? ['"]Announcement slides['"] : undefined\}/,
  'The focusable horizontal scroll row should have an accessible name.'
);

console.log('test-slide-parser-scroll-accessibility: PASS');
