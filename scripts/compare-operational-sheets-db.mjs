import process from 'node:process';
import { google } from 'googleapis';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
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
import { compareRecordSets } from './operational-parity.mjs';

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
  if (!value) throw new Error(`${name} is required for operational parity`);
  return value;
}

async function readValues(sheets, spreadsheetId, range) {
  const response = await sheets.spreadsheets.values.get(
    { spreadsheetId, range },
    { timeout: 10_000 },
  );
  return response.data.values || [];
}

const ticketFields = [
  'ticketId', 'submittedAt', 'status', 'studentId', 'studentName', 'studentEmail', 'campus', 'college',
  'category', 'subject', 'complaintNarrative', 'attachmentUrl', 'resolutionNotes', 'trackingTokenHash',
  'lastNotifiedSignature', 'lastNotifiedAt', 'officerStatusDraft', 'officerResolutionDraft',
  'officerSendControl', 'officerUpdatedBy', 'officerUpdatedAt', 'officerPublishNote',
  'officerLastPublishedAt', 'officerLastPublishedBy', 'optionalUpdateOptIn', 'optionalUpdateChannel',
  'optionalUpdateDestination', 'optionalUpdateDestinationStatus', 'optionalUpdateVerifiedAt',
  'optionalUpdateVerifiedBy', 'optionalUpdateLastNotifiedAt', 'optionalUpdateNotes', 'legacySheetRow',
].map((name) => ({ name }));

const proposalFields = [
  'proposalId', 'submittedAt', 'submitterEmail', 'submitterName', 'category', 'title', 'status',
  'attachmentUrl', 'description', 'projectType', 'reviewNotes', 'updatedBy', 'updatedAt',
  'trackingTokenHash', 'legacySheetRow',
].map((name) => ({ name }));

const ticketCommentFields = [
  'commentId', 'ticketId', 'timestamp', 'authorEmail', 'authorRole', 'message', 'attachmentUrl', 'isAppeal',
].map((name) => ({ name }));

const proposalCommentFields = [
  'commentId', 'proposalId', 'timestamp', 'authorEmail', 'authorRole', 'message', 'attachmentUrl',
].map((name) => ({ name }));

const notificationFields = [
  'notificationId', 'eventName', 'entityType', 'entityId', 'recipientEmail', 'routeId', 'templateId',
  { name: 'payloadJson', sourceField: 'payloadJson', dbField: 'payloadJson' },
  'dedupeKey', 'status', 'attempts', 'createdAt', 'processedAt', 'error',
].map((field) => typeof field === 'string' ? { name: field } : field);

async function main() {
  const sheets = getSheetsClient();
  const ticketSpreadsheetId = requiredEnv('TICKET_SPREADSHEET_ID');
  const proposalSpreadsheetId = String(process.env.PROPOSALS_SPREADSHEET_ID || ticketSpreadsheetId).trim();
  const ticketQueueTab = String(process.env.TICKET_NOTIFICATION_QUEUE_SHEET_TAB || 'Ticket_Notification_Queue').trim();
  const proposalQueueTab = String(process.env.PROPOSAL_NOTIFICATION_QUEUE_SHEET_TAB || 'Project_Proposal_Notification_Queue').trim();
  const databaseUrl = requiredEnv('DATABASE_URL');

  const [ticketRows, ticketCommentRows, ticketQueueRows, proposalRows, proposalCommentRows, proposalQueueRows] = await Promise.all([
    readValues(sheets, ticketSpreadsheetId, 'Tickets!A2:AF'),
    readValues(sheets, ticketSpreadsheetId, 'Ticket_Comments_Appeals!A2:H'),
    readValues(sheets, ticketSpreadsheetId, `${ticketQueueTab}!A2:N`),
    readValues(sheets, proposalSpreadsheetId, 'Project_Proposals!A2:M'),
    readValues(sheets, proposalSpreadsheetId, 'Project_Proposal_Discussions!A2:G'),
    readValues(sheets, proposalSpreadsheetId, `${proposalQueueTab}!A2:N`),
  ]);

  const sourceTickets = parseTicketRows(ticketRows);
  const sourceProposals = parseProposalRows(proposalRows);
  const sourceTicketComments = parseTicketCommentRows(ticketCommentRows, collectTicketIds(ticketRows));
  const sourceProposalComments = parseProposalCommentRows(proposalCommentRows, collectProposalIds(proposalRows));
  const sourceTicketNotifications = parseNotificationRows(ticketQueueRows, {
    entityType: 'ticket',
    entityIds: collectTicketIds(ticketRows),
  });
  const sourceProposalNotifications = parseNotificationRows(proposalQueueRows, {
    entityType: 'proposal',
    entityIds: collectProposalIds(proposalRows),
  });

  const prisma = new PrismaClient({
    adapter: new PrismaNeon({ connectionString: databaseUrl }),
  });

  try {
    const [dbTickets, dbProposals, dbTicketComments, dbProposalComments, dbNotifications, dbTicketStatusEvents, dbProposalStatusEvents] = await Promise.all([
      prisma.ticket.findMany(),
      prisma.proposal.findMany(),
      prisma.ticketComment.findMany(),
      prisma.proposalComment.findMany(),
      prisma.notificationJob.findMany(),
      prisma.ticketStatusEvent.findMany({ select: { id: true } }),
      prisma.proposalStatusEvent.findMany({ select: { id: true } }),
    ]);

    const dbTicketNotifications = dbNotifications.filter((row) => row.entityType === 'ticket');
    const dbProposalNotifications = dbNotifications.filter((row) => row.entityType === 'proposal');
    const report = {
      tickets: {
        source: summarizeParsed(sourceTickets),
        comparison: compareRecordSets(sourceTickets.records, dbTickets, { key: 'ticketId', fields: ticketFields }),
      },
      ticketComments: {
        source: summarizeParsed(sourceTicketComments),
        comparison: compareRecordSets(sourceTicketComments.records, dbTicketComments, { key: 'commentId', fields: ticketCommentFields }),
      },
      proposals: {
        source: summarizeParsed(sourceProposals),
        comparison: compareRecordSets(sourceProposals.records, dbProposals, { key: 'proposalId', fields: proposalFields }),
      },
      proposalComments: {
        source: summarizeParsed(sourceProposalComments),
        comparison: compareRecordSets(sourceProposalComments.records, dbProposalComments, { key: 'commentId', fields: proposalCommentFields }),
      },
      notifications: {
        ticketQueue: {
          source: summarizeParsed(sourceTicketNotifications),
          comparison: compareRecordSets(sourceTicketNotifications.records, dbTicketNotifications, { key: 'notificationId', fields: notificationFields }),
        },
        proposalQueue: {
          source: summarizeParsed(sourceProposalNotifications),
          comparison: compareRecordSets(sourceProposalNotifications.records, dbProposalNotifications, { key: 'notificationId', fields: notificationFields }),
        },
      },
      statusHistory: {
        sourceDedicatedRows: 0,
        dbTicketRows: dbTicketStatusEvents.length,
        dbProposalRows: dbProposalStatusEvents.length,
        comparable: false,
        note: 'Status history has no dedicated Sheet source; it requires an explicit source or controlled derivation before cutover.',
      },
    };

    console.log(JSON.stringify({
      tool: 'compare-operational-sheets-db',
      readOnly: true,
      writeApplied: false,
      report,
      note: 'Aggregate parity report only. No identifiers, row content, credentials, or private fields were logged.',
    }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`compare-operational-sheets-db: ${error instanceof Error ? error.message : 'failed'}`);
  process.exit(1);
});
