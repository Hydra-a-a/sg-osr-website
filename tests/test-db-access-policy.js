const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const packageJson = JSON.parse(read('package.json'));
const envExample = read('.env.example');
const prismaClient = read('lib/prisma.ts');
const accessPolicy = read('lib/db-access-policy.ts');
const schema = read('prisma/schema.prisma');
const prismaConfig = read('prisma.config.ts');
const migration = read('prisma/migrations/20260802000000_neon_prisma_foundation/migration.sql');
const docs = read('docs/database/neon-prisma-migration.md');
const exporter = read('scripts/export-public-sheets.mjs');
const importer = read('scripts/import-sheets-to-db.mjs');
const preflight = read('scripts/preflight-db.mjs');
const prismaGenerate = read('scripts/prisma-generate.mjs');
const prismaMigrateDeploy = read('scripts/prisma-migrate-deploy.mjs');

assert.ok(packageJson.dependencies['@prisma/client'], '@prisma/client should be a runtime dependency.');
assert.ok(packageJson.dependencies['@prisma/adapter-neon'], '@prisma/adapter-neon should be a runtime dependency.');
assert.ok(packageJson.devDependencies.prisma, 'prisma CLI should be a devDependency.');
assert.strictEqual(packageJson.scripts['db:generate'], 'node scripts/prisma-generate.mjs', 'db:generate should use the safe local generate wrapper.');
assert.strictEqual(packageJson.scripts['db:migrate:deploy'], 'node scripts/prisma-migrate-deploy.mjs', 'db:migrate:deploy should use the safe local migrate wrapper.');
assert.ok(packageJson.scripts['preflight:db'], 'preflight:db script should exist.');

assert.match(envExample, /^DATABASE_URL=""/m, '.env.example should document DATABASE_URL.');
assert.match(envExample, /^DIRECT_URL=""/m, '.env.example should document DIRECT_URL.');
assert.match(envExample, /^AUTH_ACCESS_SOURCE="sheets"/m, '.env.example should default auth role source to Sheets.');
assert.match(envExample, /^SHEETS_EXPORT_ENABLED="false"/m, '.env.example should default Sheets export off.');
assert.match(envExample, /^SHEETS_EXPORT_SECRET=""/m, '.env.example should document Sheets export secret.');
assert.ok(!envExample.includes('NEXT_PUBLIC_DATABASE_URL'), 'database credentials must not be public env vars.');

assert.ok(prismaClient.includes("import 'server-only'"), 'Prisma client must be server-only.');
assert.ok(prismaClient.includes('@prisma/adapter-neon'), 'Prisma client should use the Neon adapter.');
assert.ok(prismaClient.includes('process.env.DATABASE_URL'), 'Runtime Prisma client should use DATABASE_URL.');
assert.ok(!prismaClient.includes('process.env.DIRECT_URL'), 'Runtime Prisma client must not use DIRECT_URL.');

assert.ok(!schema.includes('env("DATABASE_URL")'), 'Prisma 7 schema should not hold runtime DATABASE_URL.');
assert.ok(!schema.includes('directUrl'), 'Prisma 7 schema should not hold DIRECT_URL.');
assert.ok(prismaConfig.includes("url: env('DIRECT_URL')"), 'Prisma config should reserve DIRECT_URL for migrations.');
assert.ok(prismaGenerate.includes('placeholder URL for client generation only'), 'db:generate should avoid requiring real DIRECT_URL for client generation.');
assert.ok(prismaGenerate.includes("spawnSync(process.execPath, [prismaCli, 'generate']"), 'db:generate wrapper should still run prisma generate.');
assert.ok(prismaMigrateDeploy.includes('loadDotEnvLocal'), 'db:migrate:deploy wrapper should load local maintainer env vars.');
assert.ok(prismaMigrateDeploy.includes('DIRECT_URL is required'), 'db:migrate:deploy wrapper should require DIRECT_URL.');
assert.ok(prismaMigrateDeploy.includes("'migrate', 'deploy'"), 'db:migrate:deploy wrapper should still deploy migrations.');
assert.ok(schema.includes('model AuthorizedUser'), 'schema should model auth access.');
assert.ok(migration.includes('"AuthorizedUser_email_lowercase_check"'), 'migration should enforce lowercase authorized-user emails.');
assert.ok(migration.includes('"AuthorizedUser_email_lower_unique"'), 'migration should enforce case-insensitive authorized-user uniqueness.');
assert.ok(schema.includes('model Ticket'), 'schema should model tickets.');
assert.ok(schema.includes('model Proposal'), 'schema should model proposals.');
assert.ok(schema.includes('model NotificationJob'), 'schema should model unified notification jobs.');
assert.ok(schema.includes('model CommuteRoute'), 'schema should model commute routes.');
assert.ok(schema.includes('model NewsPost'), 'schema should model public content.');
assert.ok(schema.includes('dedupeKey      String                 @unique'), 'notification dedupe key should be unique.');

const privateTerms = [
  'studentId',
  'studentEmail',
  'complaintNarrative',
  'trackingTokenHash',
  'optionalUpdateDestination',
  'payloadJson',
  'recipientEmail',
  'submitterEmail',
];

for (const term of privateTerms) {
  assert.ok(accessPolicy.includes(term), `blocked export policy should include ${term}.`);
}

const viewNames = [
  'public_sheet_news_posts',
  'public_sheet_commute_routes',
  'public_sheet_directory_entries',
  'public_sheet_quick_links',
  'public_sheet_hub_guides',
];

for (const view of viewNames) {
  assert.ok(accessPolicy.includes(view), `access policy should list ${view}.`);
  assert.ok(migration.includes(`CREATE VIEW ${view}`), `migration should create ${view}.`);
  assert.ok(exporter.includes(view), `exporter should target ${view}.`);
}

const viewBlocks = migration
  .split(/\n(?=CREATE VIEW public_sheet_)/)
  .filter((block) => block.startsWith('CREATE VIEW public_sheet_'));
assert.strictEqual((migration.match(/CREATE VIEW public_sheet_/g) || []).length, viewNames.length, 'migration should define only the expected sanitized public Sheet views.');

for (const block of viewBlocks) {
  for (const term of privateTerms) {
    assert.ok(!block.includes(`"${term}"`), `sanitized export view must not expose ${term}.`);
  }
}

assert.ok(importer.includes("--write currently supports only --domain=auth"), 'Sheets importer should only allow reviewed auth writes for now.');
assert.ok(importer.includes('requestedDomains[0] === \'auth\''), 'Sheets importer should gate implemented writes to the auth domain.');
assert.ok(importer.includes('sheetRowsWithEmail'), 'auth importer should report non-empty email row counts for dry-run review.');
assert.ok(importer.includes('emptyOrNoEmailRows'), 'auth importer should report blank/no-email row counts for dry-run review.');
assert.ok(importer.includes('invalidEmailRows'), 'auth importer should report invalid email row counts for dry-run review.');
assert.ok(importer.includes('No valid auth rows parsed; refusing to write.'), 'auth importer should refuse empty parsed writes.');
assert.ok(importer.includes('prisma.$transaction'), 'auth importer should write auth rows transactionally.');
assert.ok(preflight.includes('loadDotEnvLocal'), 'DB preflight should load local maintainer env vars without printing them.');
assert.ok(preflight.includes('missing core table(s)'), 'DB preflight should fail when migrations have not created core tables.');
assert.ok(preflight.includes('missing sanitized export view(s)'), 'DB preflight should fail when sanitized views are missing.');
assert.ok(preflight.includes('case-colliding authorized user emails'), 'DB preflight should check case-colliding auth emails.');
assert.ok(preflight.includes('can create schema objects'), 'DB preflight should reject DDL-capable runtime roles.');
assert.ok(exporter.includes('loadDotEnvLocal'), 'Sheets exporter should load local maintainer env vars without printing them.');
assert.ok(exporter.includes('DIRECTORY_EXPORT_HEADERS'), 'Sheets exporter should define the stable Directory Export columns.');
assert.ok(exporter.includes('values.clear'), 'Sheets exporter should clear stale Directory Export rows before writing.');
assert.ok(exporter.includes('public_sheet_directory_entries'), 'Sheets exporter should read the sanitized directory view.');
assert.ok(docs.includes('osr_app_rw'), 'migration docs should describe runtime DB role.');
assert.ok(docs.includes('osr_migrator'), 'migration docs should describe migration DB role.');
assert.ok(docs.includes('public_sheet_*'), 'migration docs should document export view policy.');

console.log('test-db-access-policy: PASS');
