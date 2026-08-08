const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const missingTargets = [];

for (const [scriptName, command] of Object.entries(packageJson.scripts)) {
  const match = command.match(/node(?: --no-warnings)?\s+([^\s]+)/);
  if (!match) continue;

  const target = match[1];
  if (!fs.existsSync(path.join(root, target))) {
    missingTargets.push(`${scriptName} -> ${target}`);
  }
}

assert.deepStrictEqual(
  missingTargets,
  [],
  `package.json should not advertise missing node-script targets:\n${missingTargets.join('\n')}`,
);

console.log('test-package-script-targets: PASS');
