import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import { loadDotEnvLocal } from './load-env-local.mjs';
import { parseDirectorySheets, summarizeDirectoryImport } from './directory-import-parser.mjs';

const args = process.argv.slice(2);
const fixtureArg = args.find((arg) => arg.startsWith('--fixture='));
const fixturePath = fixtureArg?.slice('--fixture='.length).trim() || '';
const dryRun = !args.includes('--write');

if (!fixturePath) loadDotEnvLocal();

function credentials() {
  const privateKey = String(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  return {
    type: process.env.GOOGLE_SERVICE_ACCOUNT_TYPE,
    project_id: process.env.GOOGLE_SERVICE_ACCOUNT_PROJECT_ID,
    private_key_id: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID,
    private_key: privateKey,
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_ID,
    auth_uri: process.env.GOOGLE_SERVICE_ACCOUNT_AUTH_URI,
    token_uri: process.env.GOOGLE_SERVICE_ACCOUNT_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.GOOGLE_SERVICE_ACCOUNT_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_X509_CERT_URL,
    universe_domain: process.env.GOOGLE_SERVICE_ACCOUNT_UNIVERSE_DOMAIN,
  };
}

function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({ credentials: credentials(), scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'] });
  return google.sheets({ version: 'v4', auth });
}

async function readRange(sheets, spreadsheetId, range) {
  try {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId, range, valueRenderOption: 'FORMULA' }, { timeout: 10_000 });
    return response.data.values || [];
  } catch {
    return [];
  }
}

function readFixture() {
  const resolved = path.resolve(process.cwd(), fixturePath);
  const payload = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  if (!payload || typeof payload !== 'object') throw new Error('Directory fixture must be an object.');
  return payload;
}

async function readSheets() {
  const spreadsheetId = String(process.env.GOOGLE_SHEETS_DIRECTORY_ID || process.env.GOOGLE_SHEETS_INFO_ID || '').trim();
  if (!spreadsheetId) throw new Error('GOOGLE_SHEETS_DIRECTORY_ID or GOOGLE_SHEETS_INFO_ID is required.');

  const sheets = getSheetsClient();
  const organizationConfigs = [
    ['Organizations', 'Organizations!A1:H', 'Academic Organization'],
    ['Institutes', 'Institutes!A1:H', 'College / Institute Organization'],
    ['Central Student Councils', "'Central Student Councils'!A1:H", 'Central Student Council'],
    ['Supreme Student Council', "'Supreme Student Council'!A1:H", 'Supreme Student Council'],
    ['Non-Academic Organization', "'Non-Academic Organization'!A1:H", 'Non-Academic Organization'],
    ['Officers', 'Officers!A1:J', 'Supreme Student Council'],
  ];
  const officeConfigs = [
    ['University Offices', "'University Offices'!A1:H", 'University Office'],
    ['Offices', 'Offices!A1:G', 'University Office'],
  ];

  const organizations = [];
  for (const [sourceLabel, range, fallbackCategory] of organizationConfigs) {
    const rows = await readRange(sheets, spreadsheetId, range);
    if (rows.length) organizations.push({ sourceLabel, rows, fallbackCategory, startRow: 1 });
  }

  const offices = [];
  for (const [sourceLabel, range, fallbackCategory] of officeConfigs) {
    const rows = await readRange(sheets, spreadsheetId, range);
    if (rows.length) offices.push({ sourceLabel, rows, fallbackCategory, startRow: 1 });
  }

  return { organizations, offices };
}

function assertWriteSafe(result) {
  if (!result.entries.length) throw new Error('No directory entries parsed; refusing to write.');
  if (result.blockers.length) throw new Error('Directory blockers were found; review the dry-run before writing.');
}

async function writeDatabase(entries) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required when --write is used.');
  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });
  try {
    await prisma.$transaction(async (transaction) => {
      for (const entry of entries) {
        const saved = await transaction.directoryEntry.upsert({
          where: { directoryKey: entry.directoryKey },
          create: {
            directoryKey: entry.directoryKey,
            entryType: entry.entryType,
            name: entry.name,
            roleOrOffice: entry.roleOrOffice,
            councilOrUnit: entry.councilOrUnit,
            email: entry.email,
            imageUrl: entry.imageUrl,
            profileUrl: '',
            publicDataJson: entry.publicDataJson,
            enabled: true,
            sortOrder: entry.sortOrder,
          },
          update: {
            entryType: entry.entryType,
            name: entry.name,
            roleOrOffice: entry.roleOrOffice,
            councilOrUnit: entry.councilOrUnit,
            email: entry.email,
            imageUrl: entry.imageUrl,
            publicDataJson: entry.publicDataJson,
            enabled: true,
            sortOrder: entry.sortOrder,
          },
        });

        if (entry.driveFileId) {
          await transaction.directoryLogo.upsert({
            where: { directoryEntryId: saved.id },
            create: {
              directoryEntryId: saved.id,
              driveFileId: entry.driveFileId,
              resourceKey: entry.resourceKey,
              fileName: 'legacy-sheet-logo',
              mimeType: 'image/png',
              sizeBytes: 0,
              uploadedBy: 'sheets-import',
            },
            update: {
              driveFileId: entry.driveFileId,
              resourceKey: entry.resourceKey,
              fileName: 'legacy-sheet-logo',
              mimeType: 'image/png',
              sizeBytes: 0,
              uploadedBy: 'sheets-import',
            },
          });
        }
      }

      await transaction.directoryExportState.upsert({
        where: { id: 'directory' },
        create: { id: 'directory', status: 'pending', requestedBy: 'sheets-import', updatedAt: new Date() },
        update: { status: 'pending', lastError: '', requestedBy: 'sheets-import' },
      });
    }, { timeout: 120_000 });
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const source = fixturePath ? readFixture() : await readSheets();
  const result = parseDirectorySheets(source);
  const summary = summarizeDirectoryImport(result);
  console.log(JSON.stringify({ tool: 'import-directory-to-db', dryRun, ...summary }));

  for (const blocker of result.blockers) {
    console.log(JSON.stringify({ source: blocker.source, row: blocker.row, code: blocker.code }));
  }

  if (!dryRun) {
    assertWriteSafe(result);
    await writeDatabase(result.entries);
    console.log(JSON.stringify({ tool: 'import-directory-to-db', status: 'written', entries: result.entries.length }));
  }
}

main().catch((error) => {
  console.error(`import-directory-to-db: ${error instanceof Error ? error.message : 'failed'}`);
  process.exitCode = 1;
});
