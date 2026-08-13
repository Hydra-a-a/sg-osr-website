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
const adminNavigationSource = fs.readFileSync(
  path.join(__dirname, '..', 'components', 'admin', 'admin-navigation.ts'),
  'utf8'
);

assert(adminNavigationSource.includes('/services/admin/grievances'), 'Admin navigation should still expose grievance controls.');
assert(adminNavigationSource.includes('/services/admin/proposals'), 'Admin navigation should still expose proposal controls.');
assert(adminNavigationSource.includes('/services/admin/routes'), 'Admin navigation should still expose route moderation.');
assert(adminNavigationSource.includes('/services/admin/users'), 'Admin navigation should expose the restored access-management controls.');
assert(adminNavigationSource.includes('Access Management'), 'Admin navigation should label the restored access-management controls.');
assert(adminHubSource.includes('adminNavigationItems'), 'Admin hub should consume the shared navigation registry.');
assert(!adminHubSource.includes('System Settings'), 'Admin hub should not expose system settings controls.');
assert(!adminHubSource.includes('Configuration'), 'Admin hub should not advertise configuration from the admin hub.');

console.log('test-admin-hub-backend-only-controls: PASS');
