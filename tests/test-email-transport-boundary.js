const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const emailSource = fs.readFileSync(path.join(root, 'lib/email.ts'), 'utf8');
const preflightSource = fs.readFileSync(path.join(root, 'scripts/preflight-integrations.mjs'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  packageJson.dependencies['nodemailer-patched'] === 'npm:nodemailer@^9.0.5',
  'production mail transport must resolve to the patched Nodemailer 9 alias.'
);
assert(
  !packageJson.dependencies.nodemailer,
  'the vulnerable direct nodemailer package name must not be installed as an Auth.js peer.'
);
assert(
  packageJson.devDependencies['@types/nodemailer'],
  'Nodemailer declarations belong in devDependencies.'
);
assert(
  emailSource.includes("from 'nodemailer-patched'")
    && preflightSource.includes("from 'nodemailer-patched'"),
  'runtime email and SMTP preflight paths must use the patched transport alias.'
);

console.log('test-email-transport-boundary: PASS');
