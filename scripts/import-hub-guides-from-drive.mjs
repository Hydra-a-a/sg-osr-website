import { google } from 'googleapis';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import { loadDotEnvLocal } from './load-env-local.mjs';
import { parseHubGuideDriveFiles, summarizeHubGuideDriveImport } from './hub-guide-drive-import-parser.mjs';

const args = process.argv.slice(2);
const folderId = (args.find((arg) => arg.startsWith('--folder=')) || '').slice('--folder='.length).trim();
const dryRun = !args.includes('--write');

if (!folderId) throw new Error('A Drive folder ID is required: --folder=<id>');
loadDotEnvLocal();

function credentials() {
  return {
    type: process.env.GOOGLE_SERVICE_ACCOUNT_TYPE,
    project_id: process.env.GOOGLE_SERVICE_ACCOUNT_PROJECT_ID,
    private_key_id: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY_ID,
    private_key: String(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL,
    client_id: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_ID,
    auth_uri: process.env.GOOGLE_SERVICE_ACCOUNT_AUTH_URI,
    token_uri: process.env.GOOGLE_SERVICE_ACCOUNT_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.GOOGLE_SERVICE_ACCOUNT_AUTH_PROVIDER_X509_CERT_URL,
    client_x509_cert_url: process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_X509_CERT_URL,
    universe_domain: process.env.GOOGLE_SERVICE_ACCOUNT_UNIVERSE_DOMAIN,
  };
}

async function listFolderFiles() {
  const auth = new google.auth.GoogleAuth({ credentials: credentials(), scopes: ['https://www.googleapis.com/auth/drive.readonly'] });
  const drive = google.drive({ version: 'v3', auth });
  const files = [];
  let pageToken;
  do {
    const response = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'nextPageToken,files(id,name,mimeType,webViewLink,webContentLink,resourceKey)',
      pageSize: 1000,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      corpora: 'allDrives',
    });
    files.push(...(response.data.files || []));
    pageToken = response.data.nextPageToken || undefined;
  } while (pageToken);
  return files;
}

async function writeGuides(guides) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for --write.');
  const prisma = new PrismaClient({ adapter: new PrismaNeon({ connectionString: process.env.DATABASE_URL }) });
  try {
    let created = 0;
    let skippedExisting = 0;
    await prisma.$transaction(async (transaction) => {
      for (const guide of guides) {
        const existing = await transaction.hubGuide.findFirst({ where: { driveFileId: guide.driveFileId } });
        if (existing) {
          skippedExisting += 1;
          continue;
        }
        await transaction.hubGuide.create({ data: guide });
        created += 1;
      }
    });
    return { created, skippedExisting };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const files = await listFolderFiles();
  const guides = parseHubGuideDriveFiles(files);
  const summary = summarizeHubGuideDriveImport(files, guides);
  console.log(JSON.stringify({ tool: 'import-hub-guides-from-drive', dryRun, ...summary }));
  if (dryRun) return;
  if (!guides.length) throw new Error('No PDFs found; refusing to write.');
  console.log(JSON.stringify({ tool: 'import-hub-guides-from-drive', dryRun, ...await writeGuides(guides) }));
}

main().catch((error) => {
  console.error(`import-hub-guides-from-drive: ${error instanceof Error ? error.message : 'failed'}`);
  process.exitCode = 1;
});
