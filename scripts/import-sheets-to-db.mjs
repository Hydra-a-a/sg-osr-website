import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { google } from 'googleapis';
import { loadDotEnvLocal } from './load-env-local.mjs';

const INSTITUTIONAL_EMAIL_DOMAIN = 'rtu.edu.ph';
const ENABLED_TRUE_VALUES = new Set(['true', '1', 'yes', 'y', 'active', 'enabled']);
const ENABLED_FALSE_VALUES = new Set(['false', '0', 'no', 'n', 'inactive', 'disabled', 'revoked', 'blocked']);

const args = process.argv.slice(2);
const fixtureArg = args.find((arg) => arg.startsWith('--fixture='));
const fixturePath = fixtureArg ? fixtureArg.slice('--fixture='.length).trim() : '';
const usingFixture = Boolean(fixturePath);

if (!usingFixture) {
  loadDotEnvLocal();
}

const domains = new Set(
  args
    .flatMap((arg) => arg.startsWith('--domain=') ? arg.slice('--domain='.length).split(',') : [])
    .map((value) => value.trim())
    .filter(Boolean),
);

const dryRun = !args.includes('--write');
const disableMissing = args.includes('--disable-missing');

const supportedDomains = [
  'auth',
  'tickets',
  'ticket-comments',
  'proposals',
  'proposal-comments',
  'notifications',
  'commute',
  'public-content',
];

const requestedDomains = domains.size ? [...domains] : supportedDomains;
const unknownDomains = requestedDomains.filter((domain) => !supportedDomains.includes(domain));

if (unknownDomains.length) {
  console.error(`import-sheets-to-db: unknown domain(s): ${unknownDomains.join(', ')}`);
  process.exit(1);
}

function serviceAccountCredentials() {
  const privateKey = String(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n');

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
  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccountCredentials(),
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function getValues(spreadsheetId, range) {
  const sheets = getSheetsClient();
  const response = await sheets.spreadsheets.values.get(
    { spreadsheetId, range },
    { timeout: 10_000 },
  );
  return response.data.values || [];
}

function readFixtureRows() {
  const resolved = path.resolve(process.cwd(), fixturePath);
  const payload = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload.rows)) {
    return payload.rows;
  }
  throw new Error('--fixture must point to a JSON array of rows or an object with rows.');
}

function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function parseRangeStartRow(range) {
  const match = range.match(/![A-Za-z]+(\d+)/);
  const startRow = Number(match?.[1] || '1');
  return Number.isFinite(startRow) && startRow > 0 ? startRow : 1;
}

function columnIndexToLetter(index) {
  let n = index + 1;
  let letters = '';
  while (n > 0) {
    const mod = (n - 1) % 26;
    letters = String.fromCharCode(65 + mod) + letters;
    n = Math.floor((n - mod) / 26);
  }
  return letters || 'D';
}

function detectHeaderMap(rows) {
  if (!rows.length) return null;
  const map = new Map();
  (rows[0] || []).forEach((cell, index) => {
    const key = normalizeHeader(cell);
    if (key) map.set(key, index);
  });
  const hasEmailHeader = [
    'email',
    'email_address',
    'rtu_email',
    'rtu_email_address',
    'school_email',
    'school_email_address',
    'account_email',
    'institutional_email',
    'institutional_email_address',
  ].some((key) => map.has(key));
  return hasEmailHeader ? map : null;
}

function firstExistingIndex(headerMap, keys, fallback) {
  for (const key of keys) {
    const index = headerMap.get(key);
    if (typeof index === 'number') return index;
  }
  return fallback;
}

function isInstitutionalEmail(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) && normalized.endsWith(`@${INSTITUTIONAL_EMAIL_DOMAIN}`);
}

function authColumnIndexes(rows) {
  const headerMap = detectHeaderMap(rows);

  return {
    emailIndex: headerMap ? firstExistingIndex(headerMap, ['email', 'email_address', 'rtu_email'], 0) : 0,
    nameIndex: headerMap ? firstExistingIndex(headerMap, ['name', 'full_name', 'user_name'], 1) : 1,
    councilIndex: headerMap ? firstExistingIndex(headerMap, ['council', 'unit', 'department', 'council_name'], 2) : 2,
    lastAccessIndex: headerMap ? firstExistingIndex(headerMap, ['last_login', 'last_access'], 3) : 3,
    enabledIndex: headerMap ? firstExistingIndex(headerMap, ['access_enabled', 'enabled'], 4) : 4,
    roleIndex: headerMap ? firstExistingIndex(headerMap, ['role', 'access_level', 'position'], 5) : 5,
    approvedByIndex: headerMap ? firstExistingIndex(headerMap, ['approved_by', 'approvedby'], 6) : 6,
    officerAccessIndex: headerMap ? firstExistingIndex(headerMap, ['officer_access', 'is_officer'], -1) : -1,
  };
}

function classifyEnabledValue(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return { status: 'blank', enabled: true };
  if (ENABLED_TRUE_VALUES.has(normalized)) return { status: 'known', enabled: true };
  if (ENABLED_FALSE_VALUES.has(normalized)) return { status: 'known', enabled: false };
  return { status: 'unknown', enabled: true };
}

function parseOfficerAccessFlag(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return false;
  return ['1', 'true', 'yes', 'y', 'enabled', 'allow', 'allowed', 'officer', 'admin'].includes(normalized);
}

function classifyUserRole(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return { status: 'blank', role: 'leader' };
  if (
    normalized.includes('officer')
    || normalized.includes('admin')
    || normalized.includes('grievance officer')
    || normalized.includes('grievance_officer')
  ) {
    return { status: 'known', role: 'officer' };
  }
  if (
    normalized.includes('leader')
    || normalized.includes('student_leader')
    || normalized.includes('student leader')
    || normalized.includes('student leader access')
    || normalized.includes('leader access')
    || normalized === 'sl'
  ) {
    return { status: 'known', role: 'leader' };
  }
  if (normalized === 'student' || normalized === 'general student' || normalized === 'no access') {
    return { status: 'known', role: 'student' };
  }
  return { status: 'unknown', role: 'student' };
}

function inferUserRoleFromRow(row) {
  const normalized = row.join(' ').trim().toLowerCase();
  if (!normalized) return 'leader';
  if (normalized.includes('officer') || normalized.includes('admin')) return 'officer';
  if (normalized.includes('leader')) return 'leader';
  return 'leader';
}

function parseAuthRows(rawRows, range) {
  const rows = rawRows.map((row) => row.map((cell) => String(cell ?? '').trim()));
  const startRow = parseRangeStartRow(range);
  const {
    emailIndex,
    nameIndex,
    councilIndex,
    lastAccessIndex,
    enabledIndex,
    roleIndex,
    approvedByIndex,
    officerAccessIndex,
  } = authColumnIndexes(rows);
  const lastAccessColumnLetter = columnIndexToLetter(lastAccessIndex >= 0 ? lastAccessIndex : 3);

  return rows.flatMap((row, i) => {
    if (i < 1) return [];
    const email = String(row[emailIndex] || '').trim().toLowerCase();
    if (!email) return [];
    if (!isInstitutionalEmail(email)) return [];

    const enabledClassification = enabledIndex < 0
      ? { status: 'missing', enabled: true }
      : classifyEnabledValue(row[enabledIndex]);
    const accessEnabled = enabledClassification.enabled;
    const rawRole = roleIndex >= 0 ? row[roleIndex] : '';
    const roleClassification = rawRole
      ? classifyUserRole(rawRole)
      : { status: 'blank', role: inferUserRoleFromRow(row) };
    let role = roleClassification.role;
    if (officerAccessIndex >= 0 && parseOfficerAccessFlag(row[officerAccessIndex])) {
      role = 'officer';
    }

    return [{
      email,
      name: String(row[nameIndex] || '').trim(),
      council: String(row[councilIndex] || '').trim(),
      role,
      accessEnabled,
      enabledValueStatus: enabledClassification.status,
      roleValueStatus: roleClassification.status,
      approvedBy: approvedByIndex >= 0 ? String(row[approvedByIndex] || '').trim() : '',
      legacySheetRow: startRow + i,
      lastAccessColumnLetter,
    }];
  });
}

function rolePriority(role) {
  if (role === 'officer') return 2;
  if (role === 'leader') return 1;
  return 0;
}

function consolidateAuthRows(rows) {
  const byEmail = new Map();

  for (const row of rows) {
    const existing = byEmail.get(row.email);
    if (!existing) {
      byEmail.set(row.email, row);
      continue;
    }

    const currentActivePriority = existing.accessEnabled ? rolePriority(existing.role) : -1;
    const nextActivePriority = row.accessEnabled ? rolePriority(row.role) : -1;
    if (nextActivePriority > currentActivePriority) {
      byEmail.set(row.email, row);
    }
  }

  return [...byEmail.values()];
}

function duplicateAuthStats(rows) {
  const byEmail = new Map();
  let duplicateEmailRows = 0;
  const conflictEmails = new Set();

  for (const row of rows) {
    const existingRows = byEmail.get(row.email) || [];
    if (existingRows.length > 0) {
      duplicateEmailRows += 1;
      if (existingRows.some((existing) => existing.accessEnabled !== row.accessEnabled || existing.role !== row.role)) {
        conflictEmails.add(row.email);
      }
    }
    existingRows.push(row);
    byEmail.set(row.email, existingRows);
  }

  return {
    duplicateEmailRows,
    duplicateEmailConflicts: conflictEmails.size,
  };
}

function summarizeAuthRows(rawRows, parsedRows, consolidatedRows) {
  const rows = rawRows.map((row) => row.map((cell) => String(cell ?? '').trim()));
  const { emailIndex } = authColumnIndexes(rows);
  const emailCells = rows.slice(1).map((row) => String(row[emailIndex] || '').trim().toLowerCase());
  const sheetRowsWithEmail = emailCells.filter(Boolean).length;
  const invalidEmailRows = emailCells.filter((email) => email && !isInstitutionalEmail(email)).length;
  const elevated = consolidatedRows.filter((row) => row.accessEnabled && row.role !== 'student');
  const rawDataRows = Math.max(0, rawRows.length - 1);
  const duplicateStats = duplicateAuthStats(parsedRows);

  return {
    rawDataRows,
    sheetRowsWithEmail,
    validEmailRows: parsedRows.length,
    invalidEmailRows,
    unknownAccessEnabledRows: parsedRows.filter((row) => row.enabledValueStatus === 'unknown').length,
    unknownRoleRows: parsedRows.filter((row) => row.roleValueStatus === 'unknown').length,
    duplicateEmailRows: duplicateStats.duplicateEmailRows,
    duplicateEmailConflicts: duplicateStats.duplicateEmailConflicts,
    emptyOrNoEmailRows: Math.max(0, rawDataRows - sheetRowsWithEmail),
    parsedUniqueEmails: consolidatedRows.length,
    activeElevatedUsers: elevated.length,
    activeLeaders: elevated.filter((row) => row.role === 'leader').length,
    activeOfficers: elevated.filter((row) => row.role === 'officer').length,
    disabledOrStudentRows: consolidatedRows.filter((row) => !row.accessEnabled || row.role === 'student').length,
    lowestSheetRow: consolidatedRows.length ? Math.min(...consolidatedRows.map((row) => row.legacySheetRow)) : null,
    highestSheetRow: consolidatedRows.length ? Math.max(...consolidatedRows.map((row) => row.legacySheetRow)) : null,
  };
}

function assertAuthWriteSafe(summary) {
  if (summary.validEmailRows === 0) {
    throw new Error('No valid auth rows parsed; refusing to write.');
  }
  if (summary.invalidEmailRows > 0) {
    throw new Error('Invalid or non-RTU auth email rows were found; fix the Sheet before writing.');
  }
  if (summary.unknownAccessEnabledRows > 0) {
    throw new Error('Unknown AccessEnabled values were found; fix the Sheet before writing.');
  }
  if (summary.unknownRoleRows > 0) {
    throw new Error('Unknown auth role values were found; fix the Sheet before writing.');
  }
  if (summary.duplicateEmailConflicts > 0) {
    throw new Error('Conflicting duplicate auth email rows were found; fix the Sheet before writing.');
  }
}

function getAuthSheetConfig() {
  const spreadsheetId = String(process.env.GOOGLE_SHEETS_AUTH_ID || '').trim();
  const envTab = String(process.env.GOOGLE_SHEETS_AUTH_TAB || 'SL Access').trim();
  const tabName = envTab.split('!')[0] || 'SL Access';
  const range = `${tabName}!A1:Z`;

  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEETS_AUTH_ID is required for --domain=auth');
  }

  return { spreadsheetId, tabName, range };
}

async function upsertAuthRows(rows) {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required when --write is used');
  }
  if (rows.length === 0) {
    throw new Error('No valid auth rows parsed; refusing to write.');
  }

  const [{ PrismaNeon }, { PrismaClient }] = await Promise.all([
    import('@prisma/adapter-neon'),
    import('@prisma/client'),
  ]);
  const prisma = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const operations = rows.map((row) => (
      prisma.authorizedUser.upsert({
        where: { email: row.email },
        create: {
          email: row.email,
          name: row.name,
          council: row.council,
          role: row.role,
          accessEnabled: row.accessEnabled && row.role !== 'student',
          approvedBy: row.approvedBy,
          legacySheetRow: row.legacySheetRow,
        },
        update: {
          name: row.name,
          council: row.council,
          role: row.role,
          accessEnabled: row.accessEnabled && row.role !== 'student',
          approvedBy: row.approvedBy,
          legacySheetRow: row.legacySheetRow,
        },
      })
    ));

    if (disableMissing) {
      const importedEmails = rows.map((row) => row.email);
      operations.push(
        prisma.authorizedUser.updateMany({
          where: { email: { notIn: importedEmails } },
          data: { accessEnabled: false },
        }),
      );
    }

    await prisma.$transaction(operations);
  } finally {
    await prisma.$disconnect();
  }
}

async function importAuthAccess() {
  const config = usingFixture
    ? { spreadsheetId: 'fixture', tabName: 'fixture-auth-access', range: 'fixture-auth-access!A1:Z' }
    : getAuthSheetConfig();
  const rawRows = usingFixture ? readFixtureRows() : await getValues(config.spreadsheetId, config.range);
  const parsedRows = parseAuthRows(rawRows, config.range);
  const consolidatedRows = consolidateAuthRows(parsedRows);
  const summary = summarizeAuthRows(rawRows, parsedRows, consolidatedRows);

  if (!dryRun) {
    assertAuthWriteSafe(summary);
    await upsertAuthRows(consolidatedRows);
  }

  console.log(JSON.stringify({
    tool: 'import-sheets-to-db',
    domain: 'auth',
    dryRun,
    writeApplied: !dryRun,
    disableMissing,
    sourceTab: config.tabName,
    summary,
    note: dryRun
      ? 'Dry run only. No DB writes were attempted.'
      : 'Auth access rows were upserted without logging private email addresses.',
  }));
}

if (requestedDomains.length === 1 && requestedDomains[0] === 'auth') {
  await importAuthAccess();
  process.exit(0);
}

if (!dryRun) {
  console.error('import-sheets-to-db: --write currently supports only --domain=auth.');
  process.exit(1);
}

console.log(JSON.stringify({
  tool: 'import-sheets-to-db',
  dryRun,
  requestedDomains,
  status: 'planned',
  note: 'Use --domain=auth for the implemented auth access importer. Other domain importers remain scaffolded.',
}));
