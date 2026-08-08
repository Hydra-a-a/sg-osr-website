const fs = require('fs');
const path = require('path');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const adminHubSource = fs.readFileSync(
  path.join(__dirname, '..', 'app', 'services', 'admin', 'page.tsx'),
  'utf8'
);

assert(adminHubSource.includes('/services/admin/grievances'), 'Admin hub should still expose grievance controls.');
assert(adminHubSource.includes('/services/admin/proposals'), 'Admin hub should still expose proposal controls.');
assert(adminHubSource.includes('/services/admin/routes'), 'Admin hub should still expose route moderation.');
assert(adminHubSource.includes('/services/admin/users'), 'Admin hub should expose the restored access-management controls.');
assert(adminHubSource.includes('Access Management'), 'Admin hub should label the restored access-management controls.');
assert(!adminHubSource.includes('System Settings'), 'Admin hub should not expose system settings controls.');
assert(!adminHubSource.includes('Configuration'), 'Admin hub should not advertise configuration from the admin hub.');

console.log('test-admin-hub-backend-only-controls: PASS');
