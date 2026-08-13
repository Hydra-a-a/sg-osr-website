const { assert, read } = require('./_security-baseline-helpers');

const overlay = read('components/admin/AdminOverlay.tsx');
for (const marker of ['role="dialog"', 'aria-modal="true"', 'Escape', 'document.body.style.overflow', 'previouslyFocused?.focus']) {
  assert(overlay.includes(marker), `Admin overlays should include ${marker}.`);
}
const actionMenu = read('components/admin/AdminActionMenu.tsx');
for (const marker of ['role="menu"', 'role="menuitem"', 'ArrowDown', 'Escape']) {
  assert(actionMenu.includes(marker), `Admin action menus should include ${marker}.`);
}
const tabs = read('components/admin/AdminTabs.tsx');
assert(tabs.includes('role="tablist"') && tabs.includes('role="tabpanel"'), 'Admin tabs should expose tab semantics.');
assert(read('components/admin/useAdminUnsavedChanges.ts').includes('beforeunload'), 'Unsaved admin changes should guard browser exits.');

for (const page of [
  'app/services/admin/grievances/page.tsx',
  'app/services/admin/proposals/page.tsx',
  'app/services/admin/routes/page.tsx',
  'app/services/admin/lost-found/page.tsx',
  'app/services/admin/users/page.tsx',
  'app/services/admin/directory/page.tsx',
]) {
  assert(read(page).replace(/\s+/g, ' ').includes('<AdminInspector mode="drawer"'), `${page} should open record actions in a drawer.`);
}

const dataGrid = read('components/admin/AdminDataGrid.tsx');
assert(dataGrid.includes('max-h-[50dvh]') && dataGrid.includes('overscroll-contain'), 'Admin data grids should use bounded inner scrolling.');
console.log('test-admin-overlay-contract: PASS');
