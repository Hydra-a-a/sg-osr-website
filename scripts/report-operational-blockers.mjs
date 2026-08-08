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
  if (!value) throw new Error(`${name} is required for blocker report`);
  return value;
}

async function readValues(sheets, spreadsheetId, range) {
  const response = await sheets.spreadsheets.values.get(
    { spreadsheetId, range },
    { timeout: 10_000 },
  );
  return response.data.values || [];
}

function blockerSummary(sourceTab, result) {
  return {
    sourceTab,
    summary: summarizeParsed(result),
    blockedRows: result.blockedRows.map(({ rowNumber, cells, reasons }) => ({
      rowNumber,
      cellRefs: cells.map((cell) => `${sourceTab}!${cell}${rowNumber}`),
      reasons,
    })),
  };
}

async function main() {
  const sheets = getSheetsClient();
  const ticketSpreadsheetId = requiredEnv('TICKET_SPREADSHEET_ID');
  const proposalSpreadsheetId = String(process.env.PROPOSALS_SPREADSHEET_ID || ticketSpreadsheetId).trim();
  const ticketQueueTab = String(process.env.TICKET_NOTIFICATION_QUEUE_SHEET_TAB || 'Ticket_Notification_Queue').trim();
  const proposalQueueTab = String(process.env.PROPOSAL_NOTIFICATION_QUEUE_SHEET_TAB || 'Project_Proposal_Notification_Queue').trim();

  const [ticketRows, ticketCommentRows, ticketQueueRows, proposalRows, proposalCommentRows, proposalQueueRows] = await Promise.all([
    readValues(sheets, ticketSpreadsheetId, 'Tickets!A2:AF'),
    readValues(sheets, ticketSpreadsheetId, 'Ticket_Comments_Appeals!A2:H'),
    readValues(sheets, ticketSpreadsheetId, `${ticketQueueTab}!A2:N`),
    readValues(sheets, proposalSpreadsheetId, 'Project_Proposals!A2:M'),
    readValues(sheets, proposalSpreadsheetId, 'Project_Proposal_Discussions!A2:G'),
    readValues(sheets, proposalSpreadsheetId, `${proposalQueueTab}!A2:N`),
  ]);

  const tickets = parseTicketRows(ticketRows);
  const proposals = parseProposalRows(proposalRows);
  const ticketComments = parseTicketCommentRows(ticketCommentRows, collectTicketIds(ticketRows));
  const proposalComments = parseProposalCommentRows(proposalCommentRows, collectProposalIds(proposalRows));
  const ticketNotifications = parseNotificationRows(ticketQueueRows, {
    entityType: 'ticket',
    entityIds: collectTicketIds(ticketRows),
  });
  const proposalNotifications = parseNotificationRows(proposalQueueRows, {
    entityType: 'proposal',
    entityIds: collectProposalIds(proposalRows),
  });

  console.log(JSON.stringify({
    tool: 'report-operational-blockers',
    readOnly: true,
    writeApplied: false,
    reports: {
      tickets: blockerSummary('Tickets', tickets),
      ticketComments: blockerSummary('Ticket_Comments_Appeals', ticketComments),
      proposals: blockerSummary('Project_Proposals', proposals),
      proposalComments: blockerSummary('Project_Proposal_Discussions', proposalComments),
      ticketNotifications: blockerSummary(ticketQueueTab, ticketNotifications),
      proposalNotifications: blockerSummary(proposalQueueTab, proposalNotifications),
    },
    note: 'Row references and reason codes only. Cell contents, identifiers, emails, narratives, payloads, hashes, and credentials were not logged.',
  }));
}

main().catch((error) => {
  console.error(`report-operational-blockers: ${error instanceof Error ? error.message : 'failed'}`);
  process.exit(1);
});
