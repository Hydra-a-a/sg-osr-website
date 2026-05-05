const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  assert.ok(fs.existsSync(absolutePath), `Expected file to exist: ${relativePath}`);
  return fs.readFileSync(absolutePath, 'utf8');
}

function assertContainsOneOf(source, patterns, message) {
  const matched = patterns.some((pattern) => pattern.test(source));
  assert.ok(matched, message);
}

module.exports = {
  assert,
  read,
  assertContainsOneOf,
};
