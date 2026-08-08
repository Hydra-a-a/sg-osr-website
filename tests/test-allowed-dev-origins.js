const fs = require('fs');
const path = require('path');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const nextConfigSource = fs.readFileSync(
  path.join(__dirname, '..', 'next.config.mjs'),
  'utf8'
);

assert(
  nextConfigSource.includes('allowedDevOrigins'),
  'next.config.mjs should declare allowedDevOrigins for alternate local dev hosts.'
);

assert(
  nextConfigSource.includes("'127.0.0.1'") || nextConfigSource.includes('"127.0.0.1"'),
  'allowedDevOrigins should include 127.0.0.1 so dev-only assets work when the app is opened on that host.'
);

console.log('test-allowed-dev-origins: PASS');
