const TICKET_COLS = {
  ticketId: 0,
  submittedAt: 1,
  status: 2,
  studentId: 3,
  studentName: 4,
  studentEmail: 5,
  campus: 6,
  college: 7,
  category: 8,
  subject: 9,
  complaintNarrative: 10,
  attachmentUrl: 11,
  resolutionNotes: 12,
  trackingTokenHash: 13,
  lastNotifiedSignature: 14,
  lastNotifiedAt: 15,
  officerStatusDraft: 16,
  officerResolutionDraft: 17,
  officerSendControl: 18,
  officerUpdatedBy: 19,
  officerUpdatedAt: 20,
  officerPublishNote: 21,
  officerLastPublishedAt: 22,
  officerLastPublishedBy: 23,
  optionalUpdateOptIn: 24,
  optionalUpdateChannel: 25,
  optionalUpdateDestination: 26,
  optionalUpdateDestinationStatus: 27,
  optionalUpdateVerifiedAt: 28,
  optionalUpdateVerifiedBy: 29,
  optionalUpdateLastNotifiedAt: 30,
  optionalUpdateNotes: 31,
};

export function collectTicketIds(rows) {
  return new Set(
    rows
      .filter((row) => !isEmptyRow(row))
      .map((row) => cell(row, TICKET_COLS.ticketId).toUpperCase())
      .filter(Boolean),
  );
}

export function collectProposalIds(rows) {
  return new Set(
    rows
      .flatMap((row, index) => isEmptyRow(row) ? [] : [`PROP-${String(index + 2).padStart(5, '0')}`]),
  );
}

const TICKET_STATUS_MAP = new Map([
  ['open', 'Open'],
  ['in progress', 'InProgress'],
  ['in-progress', 'InProgress'],
  ['under review', 'InProgress'],
  ['resolved', 'Resolved'],
  ['done', 'Resolved'],
  ['closed', 'Closed'],
  ['appealed', 'Appealed'],
  ['appeal submitted', 'Appealed'],
]);

const PROPOSAL_STATUS_MAP = new Map([
  ['pending review', 'PendingReview'],
  ['under review', 'UnderReview'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
  ['needs revision', 'NeedsRevision'],
]);

const NOTIFICATION_STATUS_MAP = new Map([
  ['pending', 'pending'],
  ['retry', 'retry'],
  ['sent', 'sent'],
  ['skipped', 'skipped'],
  ['dead_letter', 'dead_letter'],
  ['dead letter', 'dead_letter'],
]);

function cell(row, index) {
  return String(row?.[index] ?? '').trim();
}

function normalizeEmail(value) {
  return cell([value], 0).toLowerCase();
}

function parseDateValue(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return null;

  if (/^\d+(?:\.\d+)?$/.test(normalized)) {
    const serial = Number(normalized);
    if (serial >= 20_000 && serial <= 100_000) {
      const timestamp = Date.UTC(1899, 11, 30) + Math.round(serial * 86_400_000);
      return Number.isFinite(timestamp) ? new Date(timestamp) : null;
    }
  }

  const phtMatch = normalized.match(/^(\d{4})-(\d{2})-(\d{2})[ ,]+(\d{2}):(\d{2}):(\d{2})\s*PHT$/i);
  if (phtMatch) {
    const [, year, month, day, hour, minute, second] = phtMatch;
    const timestamp = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour) - 8, Number(minute), Number(second));
    return Number.isFinite(timestamp) ? new Date(timestamp) : null;
  }

  const slashMatch = normalized.replace(',', '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)$/i);
  if (slashMatch) {
    const [, month, day, year, rawHour, minute, second, meridiem] = slashMatch;
    let hour = Number(rawHour);
    if (meridiem.toUpperCase() === 'PM' && hour !== 12) hour += 12;
    if (meridiem.toUpperCase() === 'AM' && hour === 12) hour = 0;
    const timestamp = Date.UTC(Number(year), Number(month) - 1, Number(day), hour - 8, Number(minute), Number(second));
    return Number.isFinite(timestamp) ? new Date(timestamp) : null;
  }

  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? new Date(parsed) : null;
}

function normalizeTicketStatus(value) {
  const normalized = cell([value], 0).replace(/^[^a-zA-Z]+/, '').toLowerCase();
  return TICKET_STATUS_MAP.get(normalized) || 'Open';
}

function normalizeProposalStatus(value) {
  const normalized = cell([value], 0).toLowerCase();
  return PROPOSAL_STATUS_MAP.get(normalized) || 'PendingReview';
}

function normalizeNotificationStatus(value) {
  return NOTIFICATION_STATUS_MAP.get(cell([value], 0).toLowerCase()) || 'pending';
}

function parseBoolean(value) {
  return ['1', 'true', 'yes', 'y', 'enabled'].includes(cell([value], 0).toLowerCase());
}

function isTrackingHash(value) {
  return /^[0-9a-f]{64}$/i.test(value);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function makeDiagnostics() {
  return {
    rawRows: 0,
    emptyRows: 0,
    validRows: 0,
    invalidRows: 0,
    duplicateIds: 0,
    missingRequiredFields: 0,
    invalidTimestamps: 0,
    invalidTrackingHashes: 0,
    invalidRoles: 0,
    invalidPayloads: 0,
    orphanReferences: 0,
    legacyRows: 0,
    unmappedRows: 0,
    invalidReasons: {},
  };
}

function finish(records, diagnostics) {
  diagnostics.validRows = records.length;
  return { records, diagnostics, blockedRows: [] };
}

function finishWithBlockedRows(records, diagnostics, blockedRows) {
  diagnostics.validRows = records.length;
  return { records, diagnostics, blockedRows };
}

function isEmptyRow(row) {
  return !Array.isArray(row) || row.every((value) => !String(value ?? '').trim());
}

function addInvalidReason(diagnostics, reason) {
  diagnostics.invalidReasons[reason] = (diagnostics.invalidReasons[reason] || 0) + 1;
}

export function parseTicketRows(rows) {
  const diagnostics = makeDiagnostics();
  const records = [];
  const blockedRows = [];
  const seen = new Set();
  diagnostics.rawRows = rows.length;

  rows.forEach((row, index) => {
    if (isEmptyRow(row)) {
      diagnostics.emptyRows += 1;
      return;
    }
    const rowNumber = index + 2;
    const ticketId = cell(row, TICKET_COLS.ticketId).toUpperCase();
    const submittedAt = parseDateValue(cell(row, TICKET_COLS.submittedAt));
    const trackingTokenHash = cell(row, TICKET_COLS.trackingTokenHash).toLowerCase();
    const requiredMissing = !ticketId || !submittedAt || !cell(row, TICKET_COLS.complaintNarrative) || !trackingTokenHash;
    const invalidHash = Boolean(trackingTokenHash) && !isTrackingHash(trackingTokenHash);

    if (seen.has(ticketId) && ticketId) diagnostics.duplicateIds += 1;
    if (ticketId) seen.add(ticketId);
    if (!ticketId) addInvalidReason(diagnostics, 'missing_ticket_id');
    if (!submittedAt) {
      diagnostics.invalidTimestamps += 1;
      addInvalidReason(diagnostics, 'invalid_submitted_at');
    }
    if (!cell(row, TICKET_COLS.complaintNarrative)) addInvalidReason(diagnostics, 'missing_complaint_narrative');
    if (!trackingTokenHash) addInvalidReason(diagnostics, 'missing_tracking_hash');
    if (invalidHash) addInvalidReason(diagnostics, 'malformed_tracking_hash');
    if (!trackingTokenHash || invalidHash) diagnostics.invalidTrackingHashes += 1;
    if (requiredMissing) diagnostics.missingRequiredFields += 1;

    if (!ticketId || !submittedAt || !cell(row, TICKET_COLS.complaintNarrative) || !isTrackingHash(trackingTokenHash)) {
      const cells = [];
      const reasons = [];
      if (!ticketId) { cells.push('A'); reasons.push('missing_ticket_id'); }
      if (!submittedAt) { cells.push('B'); reasons.push('invalid_submitted_at'); }
      if (!cell(row, TICKET_COLS.complaintNarrative)) { cells.push('K'); reasons.push('missing_complaint_narrative'); }
      if (!trackingTokenHash || invalidHash) { cells.push('N'); reasons.push(!trackingTokenHash ? 'missing_tracking_hash' : 'malformed_tracking_hash'); }
      blockedRows.push({ rowNumber, cells, reasons });
      diagnostics.invalidRows += 1;
      return;
    }

    records.push({
      rowNumber,
      ticketId,
      submittedAt,
      status: normalizeTicketStatus(cell(row, TICKET_COLS.status)),
      studentId: cell(row, TICKET_COLS.studentId),
      studentName: cell(row, TICKET_COLS.studentName),
      studentEmail: normalizeEmail(cell(row, TICKET_COLS.studentEmail)),
      campus: cell(row, TICKET_COLS.campus),
      college: cell(row, TICKET_COLS.college),
      category: cell(row, TICKET_COLS.category),
      subject: cell(row, TICKET_COLS.subject),
      complaintNarrative: cell(row, TICKET_COLS.complaintNarrative),
      attachmentUrl: cell(row, TICKET_COLS.attachmentUrl),
      resolutionNotes: cell(row, TICKET_COLS.resolutionNotes),
      trackingTokenHash,
      lastNotifiedSignature: cell(row, TICKET_COLS.lastNotifiedSignature),
      lastNotifiedAt: parseDateValue(cell(row, TICKET_COLS.lastNotifiedAt)),
      officerStatusDraft: cell(row, TICKET_COLS.officerStatusDraft),
      officerResolutionDraft: cell(row, TICKET_COLS.officerResolutionDraft),
      officerSendControl: cell(row, TICKET_COLS.officerSendControl),
      officerUpdatedBy: normalizeEmail(cell(row, TICKET_COLS.officerUpdatedBy)),
      officerUpdatedAt: parseDateValue(cell(row, TICKET_COLS.officerUpdatedAt)),
      officerPublishNote: cell(row, TICKET_COLS.officerPublishNote),
      officerLastPublishedAt: parseDateValue(cell(row, TICKET_COLS.officerLastPublishedAt)),
      officerLastPublishedBy: normalizeEmail(cell(row, TICKET_COLS.officerLastPublishedBy)),
      optionalUpdateOptIn: parseBoolean(cell(row, TICKET_COLS.optionalUpdateOptIn)),
      optionalUpdateChannel: cell(row, TICKET_COLS.optionalUpdateChannel) || 'None',
      optionalUpdateDestination: normalizeEmail(cell(row, TICKET_COLS.optionalUpdateDestination)),
      optionalUpdateDestinationStatus: cell(row, TICKET_COLS.optionalUpdateDestinationStatus) || 'Unverified',
      optionalUpdateVerifiedAt: parseDateValue(cell(row, TICKET_COLS.optionalUpdateVerifiedAt)),
      optionalUpdateVerifiedBy: normalizeEmail(cell(row, TICKET_COLS.optionalUpdateVerifiedBy)),
      optionalUpdateLastNotifiedAt: parseDateValue(cell(row, TICKET_COLS.optionalUpdateLastNotifiedAt)),
      optionalUpdateNotes: cell(row, TICKET_COLS.optionalUpdateNotes),
      legacySheetRow: rowNumber,
    });
  });

  return finishWithBlockedRows(records, diagnostics, blockedRows);
}

function parseCommentRole(value, allowedRoles, diagnostics) {
  const role = cell([value], 0).toUpperCase();
  if (!allowedRoles.has(role)) {
    diagnostics.invalidRoles += 1;
    return null;
  }
  return role;
}

export function parseTicketCommentRows(rows, ticketIds = new Set()) {
  const diagnostics = makeDiagnostics();
  const records = [];
  const blockedRows = [];
  const seen = new Set();
  diagnostics.rawRows = rows.length;

  rows.forEach((row, index) => {
    if (isEmptyRow(row)) {
      diagnostics.emptyRows += 1;
      return;
    }
    const rowNumber = index + 2;
    const commentId = cell(row, 0);
    const ticketId = cell(row, 1).toUpperCase();
    const timestamp = parseDateValue(cell(row, 2));
    const authorRole = parseCommentRole(cell(row, 4), new Set(['STUDENT', 'LEADER', 'OFFICER']), diagnostics);
    const missing = !commentId || !ticketId || !timestamp || !cell(row, 5) || !authorRole;

    if (seen.has(commentId) && commentId) diagnostics.duplicateIds += 1;
    if (commentId) seen.add(commentId);
    if (!commentId) addInvalidReason(diagnostics, 'missing_comment_id');
    if (!ticketId) addInvalidReason(diagnostics, 'missing_ticket_id');
    if (!timestamp) {
      diagnostics.invalidTimestamps += 1;
      addInvalidReason(diagnostics, 'invalid_comment_timestamp');
    }
    if (!cell(row, 5)) addInvalidReason(diagnostics, 'missing_comment_message');
    if (ticketIds.size && !ticketIds.has(ticketId)) diagnostics.orphanReferences += 1;
    if (missing) diagnostics.missingRequiredFields += 1;

    if (missing || (ticketIds.size && !ticketIds.has(ticketId))) {
      const cells = [];
      const reasons = [];
      if (!commentId) { cells.push('A'); reasons.push('missing_comment_id'); }
      if (!ticketId) { cells.push('B'); reasons.push('missing_ticket_id'); }
      if (!timestamp) { cells.push('C'); reasons.push('invalid_comment_timestamp'); }
      if (!authorRole) { cells.push('E'); reasons.push('invalid_author_role'); }
      if (!cell(row, 5)) { cells.push('F'); reasons.push('missing_comment_message'); }
      if (ticketIds.size && !ticketIds.has(ticketId)) { cells.push('B'); reasons.push('orphan_ticket_reference'); }
      blockedRows.push({ rowNumber, cells: [...new Set(cells)], reasons: [...new Set(reasons)] });
      diagnostics.invalidRows += 1;
      return;
    }

    records.push({
      rowNumber,
      commentId,
      ticketId,
      timestamp,
      authorEmail: normalizeEmail(cell(row, 3)),
      authorRole,
      message: cell(row, 5),
      attachmentUrl: cell(row, 6),
      isAppeal: parseBoolean(cell(row, 7)),
    });
  });

  return finishWithBlockedRows(records, diagnostics, blockedRows);
}

export function parseProposalRows(rows) {
  const diagnostics = makeDiagnostics();
  const records = [];
  const blockedRows = [];
  const seen = new Set();
  diagnostics.rawRows = rows.length;

  rows.forEach((row, index) => {
    if (isEmptyRow(row)) {
      diagnostics.emptyRows += 1;
      return;
    }
    const rowNumber = index + 2;
    const proposalId = `PROP-${String(rowNumber).padStart(5, '0')}`;
    const submittedAt = parseDateValue(cell(row, 0));
    const submitterEmail = normalizeEmail(cell(row, 1));
    const trackingTokenHash = cell(row, 12).toLowerCase();
    const missing = !submittedAt || !submitterEmail || !cell(row, 4) || !cell(row, 7) || !trackingTokenHash;

    if (seen.has(proposalId)) diagnostics.duplicateIds += 1;
    seen.add(proposalId);
    if (!submittedAt) {
      diagnostics.invalidTimestamps += 1;
      addInvalidReason(diagnostics, 'invalid_submitted_at');
    }
    if (!submitterEmail) addInvalidReason(diagnostics, 'missing_submitter_email');
    if (!cell(row, 4)) addInvalidReason(diagnostics, 'missing_proposal_title');
    if (!cell(row, 7)) addInvalidReason(diagnostics, 'missing_proposal_description');
    if (!trackingTokenHash) addInvalidReason(diagnostics, 'missing_tracking_hash');
    if (trackingTokenHash && !isTrackingHash(trackingTokenHash)) addInvalidReason(diagnostics, 'malformed_tracking_hash');
    if (!trackingTokenHash || !isTrackingHash(trackingTokenHash)) diagnostics.invalidTrackingHashes += 1;
    if (missing) diagnostics.missingRequiredFields += 1;

    if (missing || !isTrackingHash(trackingTokenHash)) {
      const cells = [];
      const reasons = [];
      if (!submittedAt) { cells.push('A'); reasons.push('invalid_submitted_at'); }
      if (!submitterEmail) { cells.push('B'); reasons.push('missing_submitter_email'); }
      if (!cell(row, 4)) { cells.push('E'); reasons.push('missing_proposal_title'); }
      if (!cell(row, 7)) { cells.push('H'); reasons.push('missing_proposal_description'); }
      if (!trackingTokenHash || !isTrackingHash(trackingTokenHash)) { cells.push('M'); reasons.push(!trackingTokenHash ? 'missing_tracking_hash' : 'malformed_tracking_hash'); }
      blockedRows.push({ rowNumber, cells, reasons });
      diagnostics.invalidRows += 1;
      return;
    }

    records.push({
      rowNumber,
      proposalId,
      submittedAt,
      submitterEmail,
      submitterName: cell(row, 2),
      category: cell(row, 3),
      title: cell(row, 4),
      status: normalizeProposalStatus(cell(row, 5)),
      attachmentUrl: cell(row, 6),
      description: cell(row, 7),
      projectType: cell(row, 8),
      reviewNotes: cell(row, 9),
      updatedBy: normalizeEmail(cell(row, 10)),
      updatedAt: parseDateValue(cell(row, 11)),
      trackingTokenHash,
      legacySheetRow: rowNumber,
    });
  });

  return finishWithBlockedRows(records, diagnostics, blockedRows);
}

export function parseProposalCommentRows(rows, proposalIds = new Set()) {
  const diagnostics = makeDiagnostics();
  const records = [];
  const blockedRows = [];
  const seen = new Set();
  diagnostics.rawRows = rows.length;

  rows.forEach((row, index) => {
    if (isEmptyRow(row)) {
      diagnostics.emptyRows += 1;
      return;
    }
    const rowNumber = index + 2;
    const commentId = cell(row, 0);
    const proposalId = cell(row, 1).toUpperCase();
    const timestamp = parseDateValue(cell(row, 2));
    const authorRole = parseCommentRole(cell(row, 4), new Set(['LEADER', 'OFFICER']), diagnostics);
    const missing = !commentId || !proposalId || !timestamp || !cell(row, 5) || !authorRole;

    if (seen.has(commentId) && commentId) diagnostics.duplicateIds += 1;
    if (commentId) seen.add(commentId);
    if (!commentId) addInvalidReason(diagnostics, 'missing_comment_id');
    if (!proposalId) addInvalidReason(diagnostics, 'missing_proposal_id');
    if (!timestamp) {
      diagnostics.invalidTimestamps += 1;
      addInvalidReason(diagnostics, 'invalid_comment_timestamp');
    }
    if (!cell(row, 5)) addInvalidReason(diagnostics, 'missing_comment_message');
    if (proposalIds.size && !proposalIds.has(proposalId)) diagnostics.orphanReferences += 1;
    if (missing) diagnostics.missingRequiredFields += 1;

    if (missing || (proposalIds.size && !proposalIds.has(proposalId))) {
      const cells = [];
      const reasons = [];
      if (!commentId) { cells.push('A'); reasons.push('missing_comment_id'); }
      if (!proposalId) { cells.push('B'); reasons.push('missing_proposal_id'); }
      if (!timestamp) { cells.push('C'); reasons.push('invalid_comment_timestamp'); }
      if (!authorRole) { cells.push('E'); reasons.push('invalid_author_role'); }
      if (!cell(row, 5)) { cells.push('F'); reasons.push('missing_comment_message'); }
      if (proposalIds.size && !proposalIds.has(proposalId)) { cells.push('B'); reasons.push('orphan_proposal_reference'); }
      blockedRows.push({ rowNumber, cells: [...new Set(cells)], reasons: [...new Set(reasons)] });
      diagnostics.invalidRows += 1;
      return;
    }

    records.push({
      rowNumber,
      commentId,
      proposalId,
      timestamp,
      authorEmail: normalizeEmail(cell(row, 3)),
      authorRole,
      message: cell(row, 5),
      attachmentUrl: cell(row, 6),
    });
  });

  return finishWithBlockedRows(records, diagnostics, blockedRows);
}

function parsePayload(value, diagnostics) {
  const raw = cell([value], 0);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('payload must be an object');
    return parsed;
  } catch {
    diagnostics.invalidPayloads += 1;
    addInvalidReason(diagnostics, 'malformed_payload');
    return null;
  }
}

function parseUnifiedNotificationRow(row, rowNumber, entityType, diagnostics) {
  const notificationId = cell(row, 0);
  const eventName = cell(row, 1);
  const rowEntityType = cell(row, 2) || entityType;
  const entityId = cell(row, 3);
  const createdAt = parseDateValue(cell(row, 11));
  const payload = parsePayload(cell(row, 7), diagnostics);
  const missing = !notificationId || !eventName || !entityId || !createdAt || !payload;

  if (!createdAt) {
    diagnostics.invalidTimestamps += 1;
    addInvalidReason(diagnostics, 'invalid_notification_created_at');
  }
  if (missing) diagnostics.missingRequiredFields += 1;
  if (missing) {
    diagnostics.invalidRows += 1;
    return null;
  }

  return {
    rowNumber,
    notificationId,
    eventName,
    entityType: rowEntityType,
    entityId,
    recipientEmail: normalizeEmail(cell(row, 4)),
    routeId: cell(row, 5),
    templateId: cell(row, 6),
    payloadJson: payload,
    dedupeKey: cell(row, 8) || `legacy:${rowEntityType}:${notificationId}`,
    status: normalizeNotificationStatus(cell(row, 9)),
    attempts: Number.isFinite(Number.parseInt(cell(row, 10), 10)) ? Number.parseInt(cell(row, 10), 10) : 0,
    createdAt,
    processedAt: parseDateValue(cell(row, 12)),
    error: cell(row, 13),
    legacy: false,
  };
}

function parseLegacyTicketNotificationRow(row, rowNumber, diagnostics) {
  const notificationId = cell(row, 0);
  const entityId = cell(row, 1).toUpperCase();
  const createdAt = parseDateValue(cell(row, 3));
  const missing = !notificationId || !entityId || !createdAt;
  diagnostics.legacyRows += 1;
  if (!createdAt) {
    diagnostics.invalidTimestamps += 1;
    addInvalidReason(diagnostics, 'invalid_notification_created_at');
  }
  if (missing) diagnostics.missingRequiredFields += 1;
  if (missing) {
    diagnostics.invalidRows += 1;
    return null;
  }

  return {
    rowNumber,
    notificationId,
    eventName: 'legacy.ticket.update.v1',
    entityType: 'ticket',
    entityId,
    recipientEmail: '',
    routeId: cell(row, 4) || 'legacy',
    templateId: 'legacy',
    payloadJson: {},
    dedupeKey: `legacy:ticket:${notificationId}`,
    status: normalizeNotificationStatus(cell(row, 5)),
    attempts: Number.isFinite(Number.parseInt(cell(row, 7), 10)) ? Number.parseInt(cell(row, 7), 10) : 0,
    createdAt,
    processedAt: parseDateValue(cell(row, 6)),
    error: cell(row, 8),
    legacy: true,
  };
}

function parseLegacyProposalNotificationRow(row, rowNumber, diagnostics) {
  const notificationId = cell(row, 0);
  const entityId = cell(row, 1).toUpperCase();
  const createdAt = parseDateValue(cell(row, 6));
  const missing = !notificationId || !entityId || !createdAt;
  diagnostics.legacyRows += 1;
  if (!createdAt) {
    diagnostics.invalidTimestamps += 1;
    addInvalidReason(diagnostics, 'invalid_notification_created_at');
  }
  if (missing) diagnostics.missingRequiredFields += 1;
  const payload = parsePayload(cell(row, 5), diagnostics);
  if (missing || !payload) {
    diagnostics.invalidRows += 1;
    return null;
  }

  const type = cell(row, 3) === 'comment' ? 'comment' : 'status_update';
  return {
    rowNumber,
    notificationId,
    eventName: type === 'comment' ? 'proposal.comment.added.v1' : 'proposal.status.changed.v1',
    entityType: 'proposal',
    entityId,
    recipientEmail: normalizeEmail(cell(row, 2)),
    routeId: 'legacy',
    templateId: 'legacy',
    payloadJson: payload,
    dedupeKey: `legacy:proposal:${notificationId}`,
    status: normalizeNotificationStatus(cell(row, 4)),
    attempts: 0,
    createdAt,
    processedAt: parseDateValue(cell(row, 7)),
    error: cell(row, 8),
    legacy: true,
  };
}

export function parseNotificationRows(rows, { entityType, entityIds = new Set() } = {}) {
  const diagnostics = makeDiagnostics();
  const records = [];
  const blockedRows = [];
  const seenIds = new Set();
  const seenDedupeKeys = new Set();
  diagnostics.rawRows = rows.length;

  rows.forEach((row, index) => {
    if (isEmptyRow(row)) {
      diagnostics.emptyRows += 1;
      return;
    }
    const rowNumber = index + 2;
    const isUnified = ['ticket', 'proposal'].includes(cell(row, 2).toLowerCase())
      && cell(row, 1).includes('.')
      && Boolean(cell(row, 3));
    const beforeInvalidTimestamps = diagnostics.invalidTimestamps;
    const beforeInvalidPayloads = diagnostics.invalidPayloads;
    const record = isUnified
      ? parseUnifiedNotificationRow(row, rowNumber, entityType, diagnostics)
      : entityType === 'proposal'
        ? parseLegacyProposalNotificationRow(row, rowNumber, diagnostics)
        : parseLegacyTicketNotificationRow(row, rowNumber, diagnostics);

    const entityCell = isUnified ? 'D' : 'B';
    if (!record) {
      const cells = [];
      const reasons = [];
      if (!cell(row, 0)) { cells.push('A'); reasons.push('missing_notification_id'); }
      if (!cell(row, isUnified ? 1 : 3)) { cells.push(isUnified ? 'B' : 'D'); reasons.push('missing_notification_event_or_timestamp'); }
      if (!cell(row, isUnified ? 3 : 1)) { cells.push(entityCell); reasons.push('missing_notification_entity_id'); }
      if (diagnostics.invalidTimestamps > beforeInvalidTimestamps) {
        cells.push(isUnified ? 'L' : 'D');
        reasons.push('invalid_notification_created_at');
      }
      if (diagnostics.invalidPayloads > beforeInvalidPayloads) {
        cells.push(isUnified ? 'H' : 'F');
        reasons.push('malformed_payload');
      }
      blockedRows.push({ rowNumber, cells: [...new Set(cells)], reasons: [...new Set(reasons)] });
      return;
    }

    const duplicateReasons = [];
    const duplicateCells = [];
    if (seenIds.has(record.notificationId)) {
      diagnostics.duplicateIds += 1;
      duplicateCells.push('A');
      duplicateReasons.push('duplicate_notification_id');
    }
    if (seenDedupeKeys.has(record.dedupeKey)) {
      diagnostics.duplicateIds += 1;
      duplicateCells.push(isUnified ? 'I' : 'A');
      duplicateReasons.push('duplicate_dedupe_key');
    }
    if (entityIds.size && !entityIds.has(record.entityId)) {
      diagnostics.orphanReferences += 1;
      duplicateCells.push(entityCell);
      duplicateReasons.push(`orphan_${entityType}_reference`);
    }
    seenIds.add(record.notificationId);
    seenDedupeKeys.add(record.dedupeKey);
    if (duplicateReasons.length) {
      blockedRows.push({ rowNumber, cells: [...new Set(duplicateCells)], reasons: [...new Set(duplicateReasons)] });
      diagnostics.invalidRows += 1;
      return;
    }
    records.push(record);
  });

  return finishWithBlockedRows(records, diagnostics, blockedRows);
}

export function summarizeParsed(result) {
  return { ...result.diagnostics };
}
