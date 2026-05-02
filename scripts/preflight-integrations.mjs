import fs from 'node:fs';
import dns from 'node:dns/promises';
import path from 'node:path';
import process from 'node:process';
import nodemailer from 'nodemailer';
import { google } from 'googleapis';

const NEWS_SOURCE_HEADERS = ['pageId', 'pageName', 'pageSlug', 'enabled', 'defaultTargetPages', 'tokenAlias', 'defaultSection', 'syncLimit', 'notes'];
const NEWS_ROUTING_HEADERS = ['hashtag', 'targetPages', 'enabled', 'priority', 'newsSection', 'notes'];
const NEWS_POST_HEADERS = [
  'id',
  'source',
  'sourcePageId',
  'sourcePageName',
  'caption',
  'articleTitle',
  'manualTitle',
  'articleSlug',
  'articleBody',
  'manualBody',
  'imageUrl',
  'imageAlt',
  'publishedAt',
  'fbLink',
  'hashtags',
  'routeTargets',
  'primaryTag',
  'visible',
  'featured',
  'sortOrder',
  'ingestedAt',
  'updatedAt',
  'syncStatus',
  'syncNotes',
];

function loadDotEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return false;

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }

  return true;
}

function normalizeHeader(value) {
  return String(value || '').trim();
}

function hasAllHeaders(actual, expected) {
  const normalizedActual = actual.map(normalizeHeader);
  return expected.every((header, index) => normalizedActual[index] === header);
}

function missingHeaders(actual, expected) {
  const normalizedActual = actual.map(normalizeHeader);
  return expected.filter((header, index) => normalizedActual[index] !== header);
}

function statusLine(kind, label, detail = '') {
  const suffix = detail ? ` - ${detail}` : '';
  console.log(`[${kind}] ${label}${suffix}`);
}

function serviceAccountCredentials() {
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

function requiredEnvPresent(keys) {
  return keys.every((key) => String(process.env[key] || '').trim());
}

function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: serviceAccountCredentials(),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function getValues(sheets, spreadsheetId, range) {
  const response = await sheets.spreadsheets.values.get(
    {
      spreadsheetId,
      range,
    },
    {
      timeout: 10_000,
    },
  );

  return response.data.values || [];
}

async function checkNewsSheets(results) {
  const requiredKeys = [
    'GOOGLE_SHEETS_INFO_ID',
    'GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL',
    'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY',
  ];

  if (!requiredEnvPresent(requiredKeys)) {
    results.fail += 1;
    statusLine('FAIL', 'Google Sheets config', `missing one of: ${requiredKeys.join(', ')}`);
    return [];
  }

  const spreadsheetId = process.env.GOOGLE_SHEETS_INFO_ID;
  const sheets = getSheetsClient();
  const checks = [
    { label: 'News Sources', range: 'News Sources!A1:I1', expected: NEWS_SOURCE_HEADERS },
    { label: 'News Routing Rules', range: 'News Routing Rules!A1:F1', expected: NEWS_ROUTING_HEADERS },
    { label: 'News Posts', range: 'News Posts!A1:X1', expected: NEWS_POST_HEADERS },
  ];

  for (const check of checks) {
    try {
      const rows = await getValues(sheets, spreadsheetId, check.range);
      const header = rows[0] || [];

      if (hasAllHeaders(header, check.expected)) {
        results.pass += 1;
        statusLine('PASS', `${check.label} headers`);
      } else {
        results.fail += 1;
        statusLine('FAIL', `${check.label} headers`, `missing/mismatched: ${missingHeaders(header, check.expected).join(', ')}`);
      }
    } catch (error) {
      results.fail += 1;
      statusLine('FAIL', `${check.label} tab`, error instanceof Error ? error.message : String(error));
    }
  }

  try {
    return await getValues(sheets, spreadsheetId, 'News Sources!A2:I');
  } catch (error) {
    results.warn += 1;
    statusLine('WARN', 'News Sources rows', error instanceof Error ? error.message : String(error));
    return [];
  }
}

function parseSourceRow(row) {
  return {
    pageId: String(row[0] || '').trim(),
    pageName: String(row[1] || '').trim(),
    enabled: String(row[3] || '').trim().toLowerCase(),
    tokenAlias: String(row[5] || '').trim(),
  };
}

async function checkFacebookTokens(sourceRows, results) {
  if (!String(process.env.NEWS_SYNC_SECRET || process.env.CRON_SECRET || '').trim()) {
    results.warn += 1;
    statusLine('WARN', 'NEWS_SYNC_SECRET', 'not configured locally; required in production/GitHub Actions');
  } else {
    results.pass += 1;
    statusLine('PASS', 'NEWS_SYNC_SECRET configured');
  }

  const enabledSources = sourceRows.map(parseSourceRow).filter((source) => source.enabled === 'yes');
  if (enabledSources.length === 0) {
    results.warn += 1;
    statusLine('WARN', 'Facebook sources', 'no enabled rows in News Sources yet');
    return;
  }

  for (const source of enabledSources) {
    if (!source.pageId || source.pageId.startsWith('REPLACE_')) {
      results.warn += 1;
      statusLine('WARN', `${source.pageName || 'Facebook source'} pageId`, 'placeholder or blank');
      continue;
    }

    if (!source.tokenAlias) {
      results.warn += 1;
      statusLine('WARN', `${source.pageName || source.pageId} tokenAlias`, 'blank tokenAlias');
      continue;
    }

    const token = String(process.env[source.tokenAlias] || '').trim();
    if (!token) {
      results.warn += 1;
      statusLine('WARN', `${source.pageName || source.pageId} token`, `${source.tokenAlias} is not configured locally`);
      continue;
    }

    try {
      const version = String(process.env.META_GRAPH_API_VERSION || 'v20.0').replace(/^\/+|\/+$/g, '');
      const url = new URL(`https://graph.facebook.com/${version}/${encodeURIComponent(source.pageId)}/posts`);
      url.searchParams.set('fields', 'id,message,created_time,permalink_url');
      url.searchParams.set('limit', '1');
      url.searchParams.set('access_token', token);

      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        results.fail += 1;
        statusLine('FAIL', `${source.pageName || source.pageId} Meta posts fetch`, `HTTP ${response.status}`);
        continue;
      }

      const payload = await response.json();
      const count = Array.isArray(payload.data) ? payload.data.length : 0;
      results.pass += 1;
      statusLine('PASS', `${source.pageName || source.pageId} Meta posts fetch`, `${count} post(s) returned`);
    } catch (error) {
      results.fail += 1;
      statusLine('FAIL', `${source.pageName || source.pageId} Meta posts fetch`, error instanceof Error ? error.message : String(error));
    }
  }
}

async function checkEmailSmtp(results) {
  if (!requiredEnvPresent(['EMAIL_USER', 'EMAIL_APP_PASSWORD'])) {
    results.warn += 1;
    statusLine('WARN', 'Gmail SMTP config', 'EMAIL_USER or EMAIL_APP_PASSWORD missing');
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 10000,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  });

  try {
    await transporter.verify();
    results.pass += 1;
    statusLine('PASS', 'Gmail SMTP verify', 'authenticated and reachable; no email sent');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('ETIMEOUT') && !message.includes('queryA')) {
      results.fail += 1;
      statusLine('FAIL', 'Gmail SMTP verify', message);
      return;
    }

    try {
      const lookupResult = await dns.lookup('smtp.gmail.com', { family: 4 });
      const fallbackTransporter = nodemailer.createTransport({
        host: lookupResult.address,
        port: 465,
        secure: true,
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 10000,
        tls: {
          servername: 'smtp.gmail.com',
        },
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_APP_PASSWORD,
        },
      });

      await fallbackTransporter.verify();
      results.pass += 1;
      statusLine('PASS', 'Gmail SMTP verify', 'verified through dns.lookup fallback; no email sent');
    } catch (fallbackError) {
      results.fail += 1;
      statusLine('FAIL', 'Gmail SMTP verify', fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
    }
  }
}

async function main() {
  loadDotEnvLocal();
  const results = { pass: 0, warn: 0, fail: 0 };

  statusLine('INFO', 'Integration preflight', 'secret values are never printed');
  const sourceRows = await checkNewsSheets(results);
  await checkFacebookTokens(sourceRows, results);
  await checkEmailSmtp(results);

  console.log(`\nSummary: ${results.pass} passed, ${results.warn} warning(s), ${results.fail} failed.`);
  if (results.fail > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  statusLine('FAIL', 'Integration preflight crashed', error instanceof Error ? error.message : String(error));
  process.exit(1);
});
