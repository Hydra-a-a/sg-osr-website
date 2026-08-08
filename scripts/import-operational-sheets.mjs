import process from 'node:process';
import { google } from 'googleapis';
import { loadDotEnvLocal } from './load-env-local.mjs';
import {
  collectProposalIds,
  collectTicketIds,
  parseNotificationRows,
  parseProposalCommentRows,
  parseProposalRows,
  parseTicketCommentRows,
  parseTicketRows,
  summarizeParsed,
} from './operational-import-parser.mjs';

loadDotEnvLocal();

const requestedDomains = new Set(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith('--domain='))
    .flatMap((arg) => arg.slice('--domain='.length).split(','))
    .map((value) => value.trim())
    .filter(Boolean),
);

const domains = requestedDomains.size
  ? requestedDomains
  : new Set(['tickets', 'ticket-comments', 'proposals', 'proposal-comments', 'notifications']);

const supportedDomains = new Set(['tickets', 'ticket-comments', 'proposals', 'proposal-comments', 'notifications']);
const unknownDomains = [...domains].filter((domain) => !supportedDomains.has(domain));
if (unknownDomains.length) {
  console.error(`import-operational-sheets: unknown domain(s): ${unknownDomains.join(', ')}`);
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

function requiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`${name} is required for operational import dry-run`);
  return value;
}

function proposalsSpreadsheetId() {
  return String(process.env.PROPOSALS_SPREADSHEET_ID || process.env.TICKET_SPREADSHEET_ID || '').trim();
}

async function readValues(sheets, spreadsheetId, range) {
  const response = await sheets.spreadsheets.values.get(
    { spreadsheetId, range },
    { timeout: 10_000 },
  );
  return response.data.values || [];
}

function resultSummary(sourceTab, result) {
  return {
    sourceTab,
    ...summarizeParsed(result),
  };
}

function shapeSummary(rows) {
  const rowLengths = {};
  const populatedColumns = {};
  rows.forEach((row) => {
    const lengthKey = String(row.length);
    rowLengths[lengthKey] = (rowLengths[lengthKey] || 0) + 1;
    row.forEach((value, index) => {
      if (!String(value ?? '').trim()) return;
      const columnKey = String(index);
      populatedColumns[columnKey] = (populatedColumns[columnKey] || 0) + 1;
    });
  });
  return { rowLengths, populatedColumns };
}

async function main() {
  const sheets = getSheetsClient();
  const summaries = {};
  const ticketSpreadsheetId = requiredEnv('TICKET_SPREADSHEET_ID');
  const proposalSpreadsheetId = proposalsSpreadsheetId();
  const ticketRows = new Map();
  const proposalRows = new Map();

  if (domains.has('tickets') || domains.has('ticket-comments') || domains.has('notifications')) {
    const rows = await readValues(sheets, ticketSpreadsheetId, 'Tickets!A2:AF');
    ticketRows.set('Tickets', rows);
    const parsed = parseTicketRows(rows);
    summaries.tickets = resultSummary('Tickets', parsed);
  }

  if (domains.has('proposals') || domains.has('proposal-comments') || domains.has('notifications')) {
    if (!proposalSpreadsheetId) throw new Error('PROPOSALS_SPREADSHEET_ID or TICKET_SPREADSHEET_ID is required for proposal import dry-run');
    const rows = await readValues(sheets, proposalSpreadsheetId, 'Project_Proposals!A2:M');
    proposalRows.set('Project_Proposals', rows);
    const parsed = parseProposalRows(rows);
    summaries.proposals = resultSummary('Project_Proposals', parsed);
  }

  if (domains.has('ticket-comments')) {
    const rows = await readValues(sheets, ticketSpreadsheetId, 'Ticket_Comments_Appeals!A2:H');
    summaries['ticket-comments'] = resultSummary('Ticket_Comments_Appeals', parseTicketCommentRows(rows, collectTicketIds(ticketRows.get('Tickets') || [])));
  }

  if (domains.has('proposal-comments')) {
    const rows = await readValues(sheets, proposalSpreadsheetId, 'Project_Proposal_Discussions!A2:G');
    summaries['proposal-comments'] = resultSummary('Project_Proposal_Discussions', parseProposalCommentRows(rows, collectProposalIds(proposalRows.get('Project_Proposals') || [])));
  }

  if (domains.has('notifications')) {
    const ticketQueueTab = String(process.env.TICKET_NOTIFICATION_QUEUE_SHEET_TAB || 'Ticket_Notification_Queue').trim();
    const proposalQueueTab = String(process.env.PROPOSAL_NOTIFICATION_QUEUE_SHEET_TAB || 'Project_Proposal_Notification_Queue').trim();
    const [ticketQueueRows, proposalQueueRows] = await Promise.all([
      readValues(sheets, ticketSpreadsheetId, `${ticketQueueTab}!A2:N`),
      readValues(sheets, proposalSpreadsheetId, `${proposalQueueTab}!A2:N`),
    ]);
    const ticketQueue = parseNotificationRows(ticketQueueRows, {
      entityType: 'ticket',
      entityIds: collectTicketIds(ticketRows.get('Tickets') || []),
    });
    const proposalQueue = parseNotificationRows(proposalQueueRows, {
      entityType: 'proposal',
      entityIds: collectProposalIds(proposalRows.get('Project_Proposals') || []),
    });
    summaries.notifications = {
      sourceTabs: [ticketQueueTab, proposalQueueTab],
      sourceShapes: {
        ticketQueue: shapeSummary(ticketQueueRows),
        proposalQueue: shapeSummary(proposalQueueRows),
      },
      ticketQueue: summarizeParsed(ticketQueue),
      proposalQueue: summarizeParsed(proposalQueue),
      statusHistory: {
        dedicatedSourceFound: false,
        note: 'No dedicated status-history Sheet source was imported; status events require an explicit source or controlled derivation before writes.',
      },
    };
  }

  console.log(JSON.stringify({
    tool: 'import-operational-sheets',
    dryRun: true,
    writeApplied: false,
    domains: [...domains],
    summaries,
    note: 'Dry run only. No DB writes were attempted and no row content was logged.',
  }));
}

main().catch((error) => {
  console.error(`import-operational-sheets: ${error instanceof Error ? error.message : 'failed'}`);
  process.exit(1);
});
