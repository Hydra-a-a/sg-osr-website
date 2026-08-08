import { google } from 'googleapis';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import process from 'node:process';
import { loadDotEnvLocal } from './load-env-local.mjs';

loadDotEnvLocal();

const DIRECTORY_EXPORT_HEADERS = [
  'Directory Key',
  'Entry Type',
  'Name',
  'Role / Office',
  'Category / Unit',
  'Logo URL',
  'Profile URL',
  'Sort Order',
];

const sanitizedExportViews = [
  'public_sheet_news_posts',
  'public_sheet_commute_routes',
  'public_sheet_directory_entries',
  'public_sheet_quick_links',
  'public_sheet_hub_guides',
];

const dryRun = !process.argv.includes('--write');

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function normalizePrivateKey(value) {
  return String(value || '')
    .trim()
    .replace(/^"|"$/g, '')
    .replace(/\\n/g, '\n');
}

function getCredentials() {
  return {
    client_email: requiredEnv('GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL'),
    private_key: normalizePrivateKey(requiredEnv('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')),
  };
}

function getSpreadsheetId() {
  return String(process.env.GOOGLE_SHEETS_DIRECTORY_ID || process.env.GOOGLE_SHEETS_INFO_ID || '').trim();
}

function getTabTitle() {
  return String(process.env.DIRECTORY_EXPORT_SHEET_TAB || 'Directory Export').trim() || 'Directory Export';
}

function quoteSheetTitle(title) {
  return `'${title.replace(/'/g, "''")}'`;
}

function getPublicAppUrl() {
  return String(process.env.NEXT_PUBLIC_APP_URL || process.env.AUTH_URL || process.env.NEXTAUTH_URL || 'https://osr.rtu.edu.ph')
    .trim()
    .replace(/\/$/, '');
}

function sanitizeProxyLogoUrl(value) {
  const relativeUrl = String(value || '').trim();
  if (!/^\/api\/directory\/logos\/[a-zA-Z0-9_-]+(?:\?resourcekey=[^\s&]+)?$/i.test(relativeUrl)) return '';
  return `${getPublicAppUrl()}${relativeUrl}`;
}

function sanitizePublicUrl(value) {
  const candidate = String(value || '').trim();
  if (!candidate) return '';
  try {
    const parsed = new URL(candidate, getPublicAppUrl());
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : '';
  } catch {
    return '';
  }
}

async function loadRows(prisma) {
  const rows = await prisma.$queryRaw`
    SELECT
      "directoryKey",
      "entryType",
      "name",
      "roleOrOffice",
      "councilOrUnit",
      "imageUrl",
      "profileUrl",
      "sortOrder"
    FROM public_sheet_directory_entries
    ORDER BY "sortOrder" ASC, "entryType" ASC, lower("name") ASC, "directoryKey" ASC
  `;

  return rows.map((row) => [
    String(row.directoryKey || ''),
    String(row.entryType || ''),
    String(row.name || ''),
    String(row.roleOrOffice || ''),
    String(row.councilOrUnit || ''),
    sanitizeProxyLogoUrl(row.imageUrl),
    sanitizePublicUrl(row.profileUrl),
    String(Number.isFinite(Number(row.sortOrder)) ? Number(row.sortOrder) : 0),
  ]);
}

function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: getCredentials(),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function ensureTab(sheets, spreadsheetId, title) {
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets(properties(title))',
  });
  const titles = (response.data.sheets || []).map((sheet) => sheet.properties?.title || '');
  if (titles.includes(title)) return;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });
}

async function updateExportState(prisma, data) {
  await prisma.directoryExportState.upsert({
    where: { id: 'directory' },
    create: {
      id: 'directory',
      status: data.status,
      lastAttemptAt: data.lastAttemptAt || null,
      lastSucceededAt: data.lastSucceededAt || null,
      lastError: data.lastError || '',
      requestedBy: data.requestedBy,
      updatedAt: new Date(),
    },
    update: {
      status: data.status,
      lastAttemptAt: data.lastAttemptAt,
      lastSucceededAt: data.lastSucceededAt,
      lastError: data.lastError || '',
      requestedBy: data.requestedBy,
    },
  });
}

if (process.env.SHEETS_EXPORT_ENABLED !== 'true') {
  console.log('export-public-sheets: SKIP SHEETS_EXPORT_ENABLED is not true');
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error('export-public-sheets: missing DATABASE_URL');
  process.exit(1);
}

if (!dryRun && !process.env.SHEETS_EXPORT_SECRET) {
  console.error('export-public-sheets: missing SHEETS_EXPORT_SECRET');
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });

try {
  const rows = await loadRows(prisma);
  const summary = {
    tool: 'export-public-sheets',
    dryRun,
    tab: getTabTitle(),
    views: sanitizedExportViews,
    rowCount: rows.length,
    columns: DIRECTORY_EXPORT_HEADERS,
    status: dryRun ? 'ready' : 'pending',
  };

  if (dryRun) {
    console.log(JSON.stringify(summary));
    process.exit(0);
  }

  const spreadsheetId = getSpreadsheetId();
  if (!spreadsheetId) throw new Error('Missing GOOGLE_SHEETS_DIRECTORY_ID or GOOGLE_SHEETS_INFO_ID');

  const startedAt = new Date();
  await updateExportState(prisma, {
    status: 'running',
    lastAttemptAt: startedAt,
    lastSucceededAt: null,
    lastError: '',
    requestedBy: 'cli',
  });

  const sheets = getSheetsClient();
  const tab = getTabTitle();
  const range = `${quoteSheetTitle(tab)}!A:Z`;
  await ensureTab(sheets, spreadsheetId, tab);
  await sheets.spreadsheets.values.clear({ spreadsheetId, range, requestBody: {} });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${quoteSheetTitle(tab)}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [DIRECTORY_EXPORT_HEADERS, ...rows] },
  });

  const completedAt = new Date();
  await updateExportState(prisma, {
    status: 'succeeded',
    lastAttemptAt: startedAt,
    lastSucceededAt: completedAt,
    lastError: '',
    requestedBy: 'cli',
  });
  console.log(JSON.stringify({ ...summary, status: 'succeeded', exportedAt: completedAt.toISOString() }));
} catch (error) {
  try {
    await updateExportState(prisma, {
      status: 'failed',
      lastAttemptAt: new Date(),
      lastSucceededAt: null,
      lastError: 'Export failed; retry required.',
      requestedBy: 'cli',
    });
  } catch {
  }
  console.error('export-public-sheets: failed');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
