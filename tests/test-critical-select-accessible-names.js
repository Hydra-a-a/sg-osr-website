const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function assertLabelForAndSelectId(source, id, label) {
  assert.match(
    source,
    new RegExp(`<label[^>]+htmlFor=["']${id}["']`),
    `${label} should have a label associated with ${id}.`
  );

  assert.match(
    source,
    new RegExp(`<select[\\s\\S]*?id=["']${id}["']`),
    `${label} should set id="${id}" on its select.`
  );
}

const grievanceSource = read(path.join('app', 'services', 'grievance', 'page.tsx'));
const loginSource = read(path.join('app', 'login', 'page.tsx'));

assertLabelForAndSelectId(grievanceSource, 'grievance-campus', 'Grievance campus');
assertLabelForAndSelectId(grievanceSource, 'grievance-college', 'Grievance college');
assertLabelForAndSelectId(grievanceSource, 'grievance-category', 'Grievance category');
assertLabelForAndSelectId(grievanceSource, 'grievance-reference-format', 'Grievance reference format');
assertLabelForAndSelectId(loginSource, 'local-dev-role', 'Local development role');

console.log('test-critical-select-accessible-names: PASS');
