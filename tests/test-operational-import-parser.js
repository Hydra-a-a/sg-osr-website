const assert = require('node:assert/strict');

async function main() {
  const parser = await import('../scripts/operational-import-parser.mjs');
  const tokenHash = 'a'.repeat(64);
  const ticketRows = [[
    'TKT-2608-ABC123', '2026-08-04 10:00:00 PHT', 'In Progress', '20201234', 'Synthetic Student',
    'student@rtu.edu.ph', 'Boni', 'College of Engineering (CEng)', 'Academics', 'Synthetic subject',
    'Synthetic complaint', '', 'Pending review', tokenHash,
  ]];
  const tickets = parser.parseTicketRows(ticketRows);
  assert.equal(tickets.diagnostics.validRows, 1);
  assert.equal(tickets.records[0].status, 'InProgress');
  assert.equal(tickets.records[0].submittedAt.toISOString(), '2026-08-04T02:00:00.000Z');

  const serialDate = parser.parseTicketRows([[
    'TKT-2608-SERIAL', '46238.5', 'Open', '20201234', 'Synthetic Student', 'student@rtu.edu.ph',
    'Boni', 'College of Engineering (CEng)', 'Academics', 'Synthetic subject', 'Synthetic complaint', '', '', tokenHash,
  ]]);
  assert.equal(serialDate.diagnostics.validRows, 1);

  const comments = parser.parseTicketCommentRows([[
    'C-2608-ABC', 'TKT-2608-ABC123', '2026-08-04 11:00:00 PHT', 'student@rtu.edu.ph', 'STUDENT', 'Synthetic comment', '', 'TRUE',
  ]], new Set(['TKT-2608-ABC123']));
  assert.equal(comments.diagnostics.validRows, 1);
  assert.equal(comments.records[0].isAppeal, true);

  const proposals = parser.parseProposalRows([[
    '2026-08-04 12:00:00 PHT', 'leader@rtu.edu.ph', 'Synthetic Leader', 'Campus', 'Synthetic proposal',
    'Needs Revision', '', 'Synthetic description', 'Project', '', 'officer@rtu.edu.ph', '2026-08-04 13:00:00 PHT', tokenHash,
  ]]);
  assert.equal(proposals.diagnostics.validRows, 1);
  assert.equal(proposals.records[0].proposalId, 'PROP-00002');
  assert.equal(proposals.records[0].status, 'NeedsRevision');

  const notifications = parser.parseNotificationRows([[
    'N-1', 'proposal.comment.added.v1', 'proposal', 'PROP-00002', 'leader@rtu.edu.ph', 'STU-PRIMARY',
    'proposal.comment.reply.v1', '{"eventId":"N-1"}', 'dedupe-1', 'pending', '0', '2026-08-04T04:00:00.000Z', '', '',
  ]], { entityType: 'proposal', entityIds: new Set(['PROP-00002']) });
  assert.equal(notifications.diagnostics.validRows, 1);
  assert.equal(notifications.records[0].dedupeKey, 'dedupe-1');

  const orphan = parser.parseProposalCommentRows([[
    'PC-1', 'PROP-99999', '2026-08-04 12:00:00 PHT', 'leader@rtu.edu.ph', 'LEADER', 'Synthetic orphan', '',
  ]], new Set(['PROP-00002']));
  assert.equal(orphan.diagnostics.orphanReferences, 1);
  assert.equal(orphan.diagnostics.validRows, 0);

  const blockedParentRows = [[], ['2026-08-04 12:00:00 PHT', 'leader@rtu.edu.ph', 'Synthetic Leader', 'Campus', 'Synthetic proposal', 'Pending Review', '', 'Synthetic description', 'Project', '', '', '', '']];
  const blockedParentComment = parser.parseProposalCommentRows([[
    'PC-2', 'PROP-00003', '2026-08-04 12:00:00 PHT', 'leader@rtu.edu.ph', 'LEADER', 'Synthetic blocked-parent comment', '',
  ]], parser.collectProposalIds(blockedParentRows));
  assert.equal(blockedParentComment.diagnostics.orphanReferences, 0);
  assert.equal(blockedParentComment.diagnostics.validRows, 1);

  const malformedQueue = parser.parseNotificationRows([[
    'N-2', 'proposal.comment.added.v1', 'proposal', 'PROP-00002', '', 'route', 'template', '{bad', 'dedupe-2', 'pending', '0', 'bad-date', '', '',
  ]], { entityType: 'proposal', entityIds: new Set(['PROP-00002']) });
  assert.equal(malformedQueue.diagnostics.invalidPayloads, 1);
  assert.equal(malformedQueue.diagnostics.invalidRows, 1);

  const emptyRows = parser.parseTicketRows([[], ['', '', '']]);
  assert.equal(emptyRows.diagnostics.emptyRows, 2);
  assert.equal(emptyRows.diagnostics.invalidRows, 0);

  console.log('test-operational-import-parser: PASS');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
