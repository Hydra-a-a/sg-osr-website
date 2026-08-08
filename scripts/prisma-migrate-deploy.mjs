import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDotEnvLocal } from './load-env-local.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const prismaCli = path.join(root, 'node_modules', 'prisma', 'build', 'index.js');

loadDotEnvLocal(root);

if (!process.env.DIRECT_URL) {
  console.error('db:migrate:deploy: DIRECT_URL is required for Prisma migrations.');
  process.exit(1);
}

if (!existsSync(prismaCli)) {
  console.error('db:migrate:deploy: Prisma CLI is not installed. Run npm install first.');
  process.exit(1);
}

const result = spawnSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
  cwd: root,
  env: process.env,
  stdio: 'inherit',
});

if (result.error) {
  console.error(`db:migrate:deploy: failed to start Prisma CLI: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
