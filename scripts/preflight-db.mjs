import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import { loadDotEnvLocal } from './load-env-local.mjs';

loadDotEnvLocal();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('preflight-db: FAIL missing DATABASE_URL');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

try {
  await prisma.$queryRaw`SELECT 1`;
  const roleChecks = await prisma.$queryRaw`
    SELECT
      current_user::text AS current_user,
      has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_schema
  `;
  const roleCheck = roleChecks[0] || {};
  const currentUser = String(roleCheck.current_user || '');
  const canCreateSchema = roleCheck.can_create_schema === true
    || String(roleCheck.can_create_schema || '').toLowerCase() === 'true';

  if (currentUser === 'osr_migrator') {
    console.error('preflight-db: FAIL DATABASE_URL is using the migration role osr_migrator');
    process.exitCode = 1;
  }
  if (canCreateSchema) {
    console.error(`preflight-db: FAIL DATABASE_URL role ${currentUser || 'unknown'} can create schema objects`);
    process.exitCode = 1;
  }

  const tableChecks = await prisma.$queryRaw`
    SELECT table_name::text AS table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name IN ('_prisma_migrations', 'AuthorizedUser', 'Ticket', 'Proposal', 'NotificationJob', 'LostFoundItem', 'LostFoundAttachment', 'LostFoundComment', 'DirectoryEntry', 'DirectoryLogo', 'DirectoryExportState')
    ORDER BY table_name
  `;
  const expectedTables = ['_prisma_migrations', 'AuthorizedUser', 'DirectoryEntry', 'DirectoryExportState', 'DirectoryLogo', 'LostFoundAttachment', 'LostFoundComment', 'LostFoundItem', 'NotificationJob', 'Proposal', 'Ticket'];
  const visibleTables = new Set(tableChecks.map((row) => row.table_name));
  const missingTables = expectedTables.filter((tableName) => !visibleTables.has(tableName));

  if (missingTables.length) {
    console.error(`preflight-db: FAIL missing core table(s): ${missingTables.join(', ')}`);
    process.exitCode = 1;
  }

  const viewChecks = await prisma.$queryRaw`
    SELECT table_name::text AS table_name
    FROM information_schema.views
    WHERE table_schema = 'public'
      AND table_name IN (
        'public_sheet_news_posts',
        'public_sheet_commute_routes',
        'public_sheet_directory_entries',
        'public_sheet_quick_links',
        'public_sheet_hub_guides'
      )
    ORDER BY table_name
  `;
  const expectedViews = [
    'public_sheet_commute_routes',
    'public_sheet_directory_entries',
    'public_sheet_hub_guides',
    'public_sheet_news_posts',
    'public_sheet_quick_links',
  ];
  const visibleViews = new Set(viewChecks.map((row) => row.table_name));
  const missingViews = expectedViews.filter((viewName) => !visibleViews.has(viewName));
  let lostFoundCounts = [];

  if (missingViews.length) {
    console.error(`preflight-db: FAIL missing sanitized export view(s): ${missingViews.join(', ')}`);
    process.exitCode = 1;
  }

  if (!missingTables.length) {
    lostFoundCounts = await prisma.$queryRaw`
      SELECT
        (SELECT COUNT(*)::int FROM "LostFoundItem") AS items,
        (SELECT COUNT(*)::int FROM "LostFoundAttachment") AS attachments,
        (SELECT COUNT(*)::int FROM "LostFoundComment") AS comments
    `;
    const migrationChecks = await prisma.$queryRaw`
      SELECT migration_name::text AS migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      WHERE migration_name IN ('20260802000000_neon_prisma_foundation', '20260806000000_directory_logo_management')
    `;
    const migrationByName = new Map(migrationChecks.map((migration) => [migration.migration_name, migration]));
    const requiredMigrations = ['20260802000000_neon_prisma_foundation', '20260806000000_directory_logo_management'];
    const missingMigrations = requiredMigrations.filter((name) => {
      const migration = migrationByName.get(name);
      return !migration || !migration.finished_at || migration.rolled_back_at;
    });
    if (missingMigrations.length) {
      console.error(`preflight-db: FAIL required Prisma migration(s) are not deployed cleanly: ${missingMigrations.join(', ')}`);
      process.exitCode = 1;
    }
  }

  if (!missingTables.length) {
    const collisionChecks = await prisma.$queryRaw`
      SELECT lower("email")::text AS normalized_email, COUNT(*)::int AS row_count
      FROM "AuthorizedUser"
      GROUP BY lower("email")
      HAVING COUNT(*) > 1
      LIMIT 1
    `;
    if (collisionChecks.length) {
      console.error('preflight-db: FAIL case-colliding authorized user emails found');
      process.exitCode = 1;
    }
  }

  if (!process.exitCode) {
    const counts = lostFoundCounts?.[0] || {};
    console.log(`preflight-db: PASS connected; core tables visible=${tableChecks.length}; sanitized views visible=${viewChecks.length}; lost-found rows=${counts.items ?? 0}/${counts.attachments ?? 0}/${counts.comments ?? 0}; runtime role=${currentUser}`);
  }
} catch (error) {
  console.error('preflight-db: FAIL', error instanceof Error ? error.message : 'Unknown database error');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
