import process from 'node:process';
import { google } from 'googleapis';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import { loadDotEnvLocal } from './load-env-local.mjs';

loadDotEnvLocal();

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required for public content parity`);
  return value;
}

function sheetsClient() {
  const privateKey = String(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const auth = new google.auth.GoogleAuth({
    credentials: {
      type: process.env.GOOGLE_SERVICE_ACCOUNT_TYPE,
      project_id: process.env.GOOGLE_SERVICE_ACCOUNT_PROJECT_ID,
      private_key_id: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID,
      private_key: privateKey,
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
      client_id: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_ID,
      auth_uri: process.env.GOOGLE_SERVICE_ACCOUNT_AUTH_URI,
      token_uri: process.env.GOOGLE_SERVICE_ACCOUNT_TOKEN_URI,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function readRange(client, spreadsheetId, range) {
  try {
    const response = await client.spreadsheets.values.get({ spreadsheetId, range }, { timeout: 10_000 });
    return response.data.values || [];
  } catch {
    return [];
  }
}

async function main() {
  const spreadsheetId = required('GOOGLE_SHEETS_INFO_ID');
  const databaseUrl = required('DATABASE_URL');
  const sheets = sheetsClient();
  const [news, links, guides] = await Promise.all([
    readRange(sheets, spreadsheetId, 'News Posts!A2:X'),
    readRange(sheets, spreadsheetId, 'QuickLinks!A2:E'),
    readRange(sheets, spreadsheetId, 'Student Hub Control!A2:Z'),
  ]);
  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: databaseUrl }) });
  try {
    const [dbNews, dbLinks, dbGuides] = await Promise.all([
      prisma.newsPost.count(),
      prisma.quickLink.count(),
      prisma.hubGuide.count(),
    ]);
    console.log(JSON.stringify({
      tool: 'compare-public-content',
      readOnly: true,
      writeApplied: false,
      collections: {
        news: { sheetsRows: news.length, neonRows: dbNews },
        quickLinks: { sheetsRows: links.length, neonRows: dbLinks },
        hubGuides: { sheetsRows: guides.length, neonRows: dbGuides },
      },
      note: 'Aggregate counts only; no URLs, labels, identifiers, or private fields are emitted.',
    }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`compare-public-content: ${error instanceof Error ? error.message : 'failed'}`);
  process.exit(1);
});
