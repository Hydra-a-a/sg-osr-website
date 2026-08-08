const fs = require('fs');
const path = require('path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const grievancePageSource = read(path.join('app', 'services', 'grievance', 'page.tsx'));

assert(grievancePageSource.includes('pendingSubmitWithoutProof'), 'Grievance page should track pending no-proof submissions.');
assert(grievancePageSource.includes('Submit without proof?'), 'Grievance page should render an explicit no-proof warning modal.');
assert(grievancePageSource.includes('prima facie case'), 'Grievance no-proof warning should explain the evidence risk.');
assert(grievancePageSource.includes('Continue without proof'), 'Grievance no-proof warning should let the student proceed intentionally.');
assert(grievancePageSource.includes('createPortal('), 'Grievance no-proof warning should render through a portal so it stays centered on screen.');
assert(grievancePageSource.includes('<X size={18} />'), 'Grievance no-proof warning should use the X icon for the close control.');
assert(!grievancePageSource.includes('window.confirm('), 'Grievance page should not rely on a browser confirm for no-proof submission.');

console.log('test-grievance-no-proof-warning: PASS');
